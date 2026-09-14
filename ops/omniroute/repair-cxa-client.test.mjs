import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {repairText, repairPackage, MARKER} from './repair-cxa-client.mjs';
const TEXT='class Client{constructor(e){this.websocketFn=e.websocketFn??null;this.defaultTimeoutMs=120000;}connect(){throw Error("Codex app-server websocket transport unavailable");}}';
const ROOT_CLIENT='open-sse/executors/codex/appServerClient.ts';
const CHUNK='dist/.build/next/server/chunks/open-sse_test._.js';
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'cxa-client-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'omniroute',version:'3.8.50'}));for(const p of [ROOT_CLIENT,CHUNK]){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),TEXT);}return root;}
test('source and explicit chunk repair is idempotent and reversible',t=>{const root=fixture(t);assert.equal(repairPackage(root,'--check',[CHUNK]).files.length,2);assert.equal(fs.existsSync(path.join(root,'.omniroute-repairs')),false);repairPackage(root,'--apply',[CHUNK]);const first=fs.readFileSync(path.join(root,CHUNK),'utf8');assert.ok(first.includes(MARKER));repairPackage(root,'--apply',[CHUNK]);assert.equal(fs.readFileSync(path.join(root,CHUNK),'utf8'),first);repairPackage(root,'--restore',[CHUNK]);for(const p of [ROOT_CLIENT,CHUNK])assert.equal(fs.readFileSync(path.join(root,p),'utf8'),TEXT);});
test('unknown or changed files refuse all mutation',t=>{const root=fixture(t);fs.writeFileSync(path.join(root,CHUNK),'unrelated');assert.throws(()=>repairPackage(root,'--apply',[CHUNK]),/Unexpected/);assert.equal(fs.readFileSync(path.join(root,ROOT_CLIENT),'utf8'),TEXT);fs.writeFileSync(path.join(root,CHUNK),TEXT);repairPackage(root,'--apply',[CHUNK]);fs.appendFileSync(path.join(root,CHUNK),'// user change');assert.throws(()=>repairPackage(root,'--restore',[CHUNK]),/Modified/);assert.ok(fs.readFileSync(path.join(root,ROOT_CLIENT),'utf8').includes(MARKER));});
test('version, symlink and path traversal guards',t=>{const root=fixture(t);assert.throws(()=>repairPackage(root,'--apply',['dist/../../outside.js']),/Unsafe/);const chunk=path.join(root,CHUNK);fs.unlinkSync(chunk);fs.symlinkSync(path.join(root,ROOT_CLIENT),chunk);assert.throws(()=>repairPackage(root,'--apply',[CHUNK]),/symbolic/);fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'omniroute',version:'3.8.51'}));assert.throws(()=>repairPackage(root,'--apply',[]),/3\.8\.50/);});
test('auto discovery repairs every compiled copy, ignores unrelated code, and rolls all back',t=>{
  const root=fixture(t),dir=path.dirname(path.join(root,CHUNK)),targets=[CHUNK];
  for(let i=0;i<13;i++){const name=`[root-of-the-server]__mock${i}._.js`;fs.writeFileSync(path.join(dir,name),TEXT);targets.push('dist/.build/next/server/chunks/'+name);}
  for(const name of ['vendor.js','route.js'])fs.writeFileSync(path.join(dir,name),TEXT);
  fs.writeFileSync(path.join(dir,'open-sse_unrelated.js'),'const unrelated="this.websocketFn=";');
  const check=repairPackage(root);assert.equal(check.files.length,15);assert.equal(fs.existsSync(path.join(root,'.omniroute-repairs')),false);
  repairPackage(root,'--apply');repairPackage(root,'--apply');
  for(const name of [ROOT_CLIENT,...targets])assert.ok(fs.readFileSync(path.join(root,name),'utf8').includes(MARKER));
  assert.equal(fs.readFileSync(path.join(dir,'vendor.js'),'utf8'),TEXT);
  repairPackage(root,'--restore');for(const name of [ROOT_CLIENT,...targets])assert.equal(fs.readFileSync(path.join(root,name),'utf8'),TEXT);
});
test('auto discovery refuses no compiled copies and symlinks before writing',t=>{
  const root=fixture(t),chunk=path.join(root,CHUNK);fs.writeFileSync(chunk,'unrelated');
  assert.throws(()=>repairPackage(root,'--apply'),/No compiled/);assert.equal(fs.readFileSync(path.join(root,ROOT_CLIENT),'utf8'),TEXT);
  fs.unlinkSync(chunk);fs.symlinkSync(path.join(root,ROOT_CLIENT),chunk);assert.throws(()=>repairPackage(root,'--apply'),/symbolic/);
});
test('auto repair reuses original backups written with Windows path separators',t=>{
  const root=fixture(t);repairPackage(root,'--apply',[CHUNK]);
  const key=name=>createHash('sha256').update(name).digest('hex')+'.original';
  const dir=path.join(root,'.omniroute-repairs/cxa-client-3.8.50-v1');
  fs.renameSync(path.join(dir,key(CHUNK)),path.join(dir,key(CHUNK.replaceAll('/','\\'))));
  repairPackage(root,'--apply');repairPackage(root,'--restore');
  assert.equal(fs.readFileSync(path.join(root,CHUNK),'utf8'),TEXT);
});
test('concurrent edit during backup aborts before any executable is patched',t=>{
  const root=fixture(t),chunk=path.join(root,CHUNK),originalWrite=fs.writeFileSync;let changed=false;
  fs.writeFileSync=function(file,...args){const result=originalWrite.call(this,file,...args);if(!changed&&String(file).endsWith('.original')){changed=true;originalWrite(chunk,TEXT+'// concurrent edit');}return result;};
  try{assert.throws(()=>repairPackage(root,'--apply'),/Concurrent modification/);}finally{fs.writeFileSync=originalWrite;}
  assert.equal(fs.readFileSync(path.join(root,ROOT_CLIENT),'utf8'),TEXT);assert.equal(fs.readFileSync(chunk,'utf8'),TEXT+'// concurrent edit');
});
test('concurrent edit just before rename is preserved and temporary file removed',t=>{
  const root=fixture(t),source=path.join(root,ROOT_CLIENT),originalWrite=fs.writeFileSync;let changed=false;
  fs.writeFileSync=function(file,...args){const result=originalWrite.call(this,file,...args);if(!changed&&String(file).endsWith('.tmp')){changed=true;originalWrite(source,TEXT+'// concurrent edit');}return result;};
  try{assert.throws(()=>repairPackage(root,'--apply'),/Concurrent modification/);}finally{fs.writeFileSync=originalWrite;}
  assert.equal(fs.readFileSync(source,'utf8'),TEXT+'// concurrent edit');assert.equal(fs.readFileSync(path.join(root,CHUNK),'utf8'),TEXT);assert.ok(!fs.readdirSync(path.dirname(source)).some(n=>n.endsWith('.tmp')));
});
test('real upstream client uses fallback, preserves injection and denies approvals', {skip:!process.env.OMNIROUTE_TEST_UPSTREAM},async()=>{
  assert.equal(typeof vm.SourceTextModule,'function','Run with --experimental-vm-modules');
  const original=fs.readFileSync(path.join(process.env.OMNIROUTE_TEST_UPSTREAM,ROOT_CLIENT),'utf8');
  const fixed=repairText(original);assert.equal(fixed.count,1);
  const sent=[];let fallbackCalls=0,injectedCalls=0;
  const socket={onmessage:null,onerror:null,onclose:null,close(){},send(raw){sent.push(JSON.parse(raw));}};
  const context=vm.createContext({setTimeout,clearTimeout,console});
  const transport=new vm.SyntheticModule(['websocket'],function(){this.setExport('websocket',async(url,options)=>{fallbackCalls++;assert.equal(url,'ws://127.0.0.1:1456');assert.equal(options.headers.Authorization,'Bearer test-capability');return socket;});},{context});
  await transport.link(()=>{throw Error('Unexpected import');});await transport.evaluate();
  const module=new vm.SourceTextModule(stripTypeScriptTypes(fixed.text,{mode:'transform'}),{context,importModuleDynamically:async spec=>{assert.equal(spec,'wreq-js');return transport;}});
  await module.link(()=>{throw Error('Unexpected static dependency');});await module.evaluate();
  const Client=module.namespace.CodexAppServerClient;
  const client=new Client();await client.connect('ws://127.0.0.1:1456','test-capability');assert.equal(fallbackCalls,1);
  socket.onmessage({data:JSON.stringify({id:42,method:'item/commandExecution/requestApproval',params:{}})});
  assert.equal(sent.at(-1).result.decision,'denied');
  const errors=[];client.onNotification((method,params)=>errors.push({method,params}));
  socket.onmessage({data:JSON.stringify({method:'error',params:{error:{message:'MOCK_REFUSED'},willRetry:false}})});
  assert.equal(errors[0].params.error.message,'MOCK_REFUSED');client.close();
  const injected=new Client({websocketFn:async()=>{injectedCalls++;return socket;}});await injected.connect('ws://127.0.0.1:1456','test-capability');assert.equal(injectedCalls,1);assert.equal(fallbackCalls,1);injected.close();
});
