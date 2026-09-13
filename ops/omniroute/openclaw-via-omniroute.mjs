// Isolated OpenClaw profile using only dedicated local secrets.
import {readFileSync} from 'node:fs'; import {join,resolve} from 'node:path'; import {spawn} from 'node:child_process';
if(!process.argv[2]||!process.env.LOCALAPPDATA) throw Error('Usage: node openclaw-via-omniroute.mjs <omniroute-root> [OpenClaw arguments]');
const omniRoot=resolve(process.argv[2]), openRoot=join(process.env.LOCALAPPDATA,'OpenClawPilot');
const cli=join(openRoot,'node_modules','openclaw','openclaw.mjs');
let key,token; try{({key}=JSON.parse(readFileSync(join(omniRoot,'.runtime','client-key.json'),'utf8')));token=readFileSync(join(openRoot,'.runtime','gateway-token'),'utf8').trim()}catch{throw Error('Cannot read dedicated local secrets')}
if(typeof key!=='string'||!/^[\x21-\x7e]{16,4096}$/.test(key)) throw Error('Invalid dedicated OmniRoute client key');
if(!/^[a-f0-9]{64}$/.test(token)) throw Error('Invalid OpenClaw gateway token');
const allow=new Set('PATH SYSTEMROOT WINDIR TEMP TMP LOCALAPPDATA APPDATA USERPROFILE HOMEDRIVE HOMEPATH COMSPEC PATHEXT PROGRAMFILES PROGRAMFILES(X86) COMMONPROGRAMFILES OS NUMBER_OF_PROCESSORS PROCESSOR_ARCHITECTURE COMPUTERNAME USERNAME USERDOMAIN'.split(' '));
const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>allow.has(name.toUpperCase())));
Object.assign(env,{OMNIROUTE_API_KEY:key,OPENCLAW_GATEWAY_TOKEN:token,OPENCLAW_WORKSPACE:join(openRoot,'workspace')});
const child=spawn(process.execPath,[cli,'--profile','omni-pilot',...process.argv.slice(3)],{env,stdio:'inherit'});
child.on('error',()=>{console.error('Unable to start isolated OpenClaw');process.exitCode=1});
child.on('exit',(code,signal)=>{process.exitCode=code??(signal==='SIGINT'?130:1)});