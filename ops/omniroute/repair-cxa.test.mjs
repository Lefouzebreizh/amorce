// Run: node --experimental-vm-modules --test ops/omniroute/repair-cxa.test.mjs
// For the upstream integration test, set OMNIROUTE_TEST_UPSTREAM to an unmodified
// v3.8.50 source/package directory. It never opens sockets or calls a provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { repairPackage, repairText, MARKER } from './repair-cxa.mjs';

const original = 'const executors={codex:new CodexExecutor(),"codex-app-server":new CodexAppServerExecutor({},"codex-app-server")};';
function fixture(t, version = '3.8.50') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-cxa-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'omniroute', version }));
  const file = path.join(root, 'dist/.build/next/server/chunks/open-sse_test.js');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, original);
  return { root, file };
}

test('repair is limited to cxa, including minified and namespaced constructors', () => {
  const variants = [original, '"codex-app-server":new a.b({},"codex-app-server")',
    "'codex-app-server': new $x ( { }, 'codex-app-server' )"];
  for (const source of variants) {
    const result = repairText(source);
    assert.equal(result.count, 1);
    assert.ok(result.text.includes(MARKER));
    assert.equal(repairText(result.text).text, result.text);
  }
  assert.equal(repairText(original).text.split(',"codex-app-server":')[0],
    original.split(',"codex-app-server":')[0]);
  assert.equal(repairText('new Other({},"different-provider")').count, 0);
});

test('check writes nothing; apply, repeat, restore preserve exact original', (t) => {
  const { root, file } = fixture(t);
  assert.equal(repairPackage(root).files.length, 1);
  assert.equal(fs.existsSync(path.join(root, '.omniroute-repairs')), false);
  repairPackage(root, '--apply');
  const first = fs.readFileSync(file, 'utf8');
  repairPackage(root, '--apply');
  assert.equal(fs.readFileSync(file, 'utf8'), first);
  repairPackage(root, '--restore');
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  repairPackage(root, '--apply');
  assert.equal(fs.readFileSync(file, 'utf8'), first);
});

test('different version, unknown runtime and subsequent changes fail closed', (t) => {
  const wrong = fixture(t, '3.8.51');
  assert.throws(() => repairPackage(wrong.root, '--apply'), /3\.8\.50/);
  assert.equal(fs.readFileSync(wrong.file, 'utf8'), original);
  const absent = fixture(t);
  fs.writeFileSync(absent.file, 'const unrelated=1;');
  assert.throws(() => repairPackage(absent.root, '--apply'), /No compiled server/);
  const changed = fixture(t);
  repairPackage(changed.root, '--apply');
  fs.appendFileSync(changed.file, '\n// operator modification');
  assert.throws(() => repairPackage(changed.root, '--restore'), /differs/);
  assert.ok(fs.readFileSync(changed.file, 'utf8').includes('operator modification'));
});

test('symlinked runtime files are never rewritten', (t) => {
  const { root, file } = fixture(t);
  const target = path.join(root, 'outside.js');
  fs.writeFileSync(target, original); fs.unlinkSync(file); fs.symlinkSync(target, file);
  assert.throws(() => repairPackage(root, '--apply'), /symbolic link/);
  assert.equal(fs.readFileSync(target, 'utf8'), original);
});

test('explicit source-only mode patches the single root factory and retains rollback', (t) => {
  const { root, file } = fixture(t);
  fs.unlinkSync(file);
  const source = path.join(root, 'open-sse/executors/index.ts');
  fs.mkdirSync(path.dirname(source), { recursive: true }); fs.writeFileSync(source, original);
  assert.equal(repairPackage(root, '--apply', true).files.length, 1);
  assert.ok(fs.readFileSync(source, 'utf8').includes(MARKER));
  repairPackage(root, '--restore', true);
  assert.equal(fs.readFileSync(source, 'utf8'), original);
});

test('upstream executor receives transport and preserves a real error as response.failed',
  { skip: !process.env.OMNIROUTE_TEST_UPSTREAM }, async () => {
    assert.equal(typeof vm.SourceTextModule, 'function', 'Use --experimental-vm-modules');
    const upstream = path.resolve(process.env.OMNIROUTE_TEST_UPSTREAM);
    const modules = new Map();
    const requests = [];
    let handshakes = 0;
    const context = vm.createContext({ TextEncoder, TextDecoder, Response, ReadableStream,
      AbortController, AbortSignal, setTimeout, clearTimeout, setInterval, clearInterval,
      queueMicrotask, crypto: globalThis.crypto, console, process: { env: {} } });
    const socket = { onmessage: null, onerror: null, onclose: null,
      close() {}, send(raw) {
        const frame = JSON.parse(raw); requests.push(frame.method);
        queueMicrotask(() => {
          socket.onmessage?.({ data: JSON.stringify({ id: frame.id,
            result: frame.method === 'thread/start' ? { thread: { id: 'mock-thread' } } : {} }) });
          if (frame.method === 'turn/start') queueMicrotask(() => socket.onmessage?.({
            data: JSON.stringify({ method: 'error', params: {
              error: { message: 'MOCK_UPSTREAM_REFUSED' }, willRetry: false,
            } }),
          }));
        });
      } };
    const socketFactory = async (url, options) => {
      handshakes++;
      assert.equal(url, 'ws://127.0.0.1:1456');
      assert.equal(options.headers.Authorization, 'Bearer harmless-test-token');
      return socket;
    };
    function synthetic(id, values) {
      const module = new vm.SyntheticModule(Object.keys(values), function () {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value);
      }, { context, identifier: id });
      modules.set(id, module); return module;
    }
    synthetic('wreq-js', { websocket: socketFactory });
    synthetic('base', { BaseExecutor: class { constructor() {} } });
    synthetic('constants', { PROVIDERS: { codex: {}, 'codex-app-server': {} } });
    synthetic('sanitize', { sanitizeErrorMessage: value => String(value) });
    synthetic('config', {
      resolveAppServerConfig: () => ({ url: 'ws://127.0.0.1:1456', token: 'harmless-test-token', cwd: '/tmp' }),
      resolveThreadStartPolicy: () => ({ approvalPolicy: 'never', sandbox: 'workspace-write', autoApprove: false }),
    });
    synthetic('errors', {
      classifyError: (_status, type, message) => ({ type, message }),
      adapterFailureFromMessage: message => ({ httpStatus: 502, error: { type: 'provider_error', message } }),
    });
    synthetic('compaction', { encodeCompactionSummary: text => text });
    synthetic('reasoning', { encodeReasoningEnvelope: () => 'unused-test-envelope' });
    synthetic('stall', { resolveStallTimeoutSec: () => 10 });
    synthetic('totals', { usageDisplayTotalTokens: usage => usage.totalTokens });
    function resolve(specifier, referencing) {
      if (specifier === 'wreq-js') return 'wreq-js';
      if (specifier.endsWith('/base.ts')) return 'base';
      if (specifier.endsWith('/config/constants.ts')) return 'constants';
      if (specifier.endsWith('/utils/error.ts')) return 'sanitize';
      if (specifier.endsWith('/appServerConfig.ts')) return 'config';
      if (specifier === './lib/errors') return 'errors';
      if (specifier === './responses/compaction') return 'compaction';
      if (specifier === './responses/reasoning-envelope') return 'reasoning';
      if (specifier === './stall-timeout') return 'stall';
      if (specifier === './usage/totals') return 'totals';
      return path.posix.normalize(path.posix.join(path.posix.dirname(referencing.identifier), specifier));
    }
    async function get(id) {
      if (modules.has(id)) return modules.get(id);
      const source = fs.readFileSync(path.join(upstream, id), 'utf8');
      const module = new vm.SourceTextModule(stripTypeScriptTypes(source, { mode: 'transform' }), {
        context, identifier: id,
      });
      modules.set(id, module);
      await module.link((spec, ref) => get(resolve(spec, ref)));
      return module;
    }
    const executor = await get('open-sse/executors/codex-app-server.ts');
    await executor.evaluate();
    synthetic('executor', { CodexAppServerExecutor: executor.namespace.CodexAppServerExecutor });
    const factoryText = repairText('export const instance = new CodexAppServerExecutor({},"codex-app-server");').text;
    const factory = new vm.SourceTextModule('import {CodexAppServerExecutor} from "executor";\n' + factoryText, {
      context, identifier: 'factory', importModuleDynamically: async (spec) => {
        const module = modules.get(spec); assert.ok(module, 'Only existing wreq-js may load');
        if (module.status === 'unlinked') await module.link(() => { throw new Error('unexpected dependency'); });
        if (module.status !== 'evaluated') await module.evaluate();
        return module;
      },
    });
    await factory.link(spec => modules.get(spec)); await factory.evaluate();
    const result = await factory.namespace.instance.execute({ model: 'mock-model',
      credentials: {}, body: { input: 'Hello' }, stream: true });
    const output = await result.response.text();
    assert.equal(handshakes, 1);
    assert.deepEqual(requests.slice(0, 3), ['initialize', 'thread/start', 'turn/start']);
    assert.match(output, /event: response\.failed/);
    assert.match(output, /MOCK_UPSTREAM_REFUSED/);
    assert.match(output, /codex_app_server_turn_failed/);
    assert.doesNotMatch(output, /event: response\.completed/);
  });
