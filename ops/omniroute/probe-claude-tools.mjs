// Real Read tool round trip. Uses only a dedicated harmless fixture; consumes model quota.
import fs from 'node:fs'; import path from 'node:path'; import {randomBytes} from 'node:crypto'; import {spawn,spawnSync} from 'node:child_process';
if (!process.argv[2]) throw Error('Usage: node probe-claude-tools.mjs <pilot-root>');
const root=path.resolve(process.argv[2]),data=path.join(root,'.runtime'),work=path.join(data,'codex-work');
fs.mkdirSync(work,{recursive:true});
const file=path.join(work,'omniroute-tool-test.txt'),expected='OMNI_TOOL_'+randomBytes(8).toString('hex');
fs.writeFileSync(file,expected,{mode:0o600});
const args=[path.join(root,'claude-via-omniroute.mjs'),root,'--print','--tools','Read','--allowedTools','Read','--strict-mcp-config','--no-session-persistence','--setting-sources','','--max-turns','3','--output-format','stream-json','--verbose','Utilise une seule fois ton outil Read pour lire '+file+'. Reponds uniquement par le contenu exact. Ne lis aucun autre fichier et n utilise aucun autre outil.'];
const child=spawn(process.execPath,args,{cwd:work,stdio:['ignore','pipe','pipe']});let out='',timedOut=false;
child.stdout.on('data',b=>out+=b);child.stderr.resume();
const timer=setTimeout(()=>{timedOut=true;if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});else child.kill('SIGTERM');},90000);
child.on('error',e=>{clearTimeout(timer);console.error(e.message);process.exitCode=1;});
child.on('close',code=>{
  clearTimeout(timer);const events=out.split('\n').flatMap(l=>{try{return[JSON.parse(l)]}catch{return[]}});
  const result=events.findLast(x=>x.type==='result'),blocks=events.flatMap(x=>x.message?.content??[]);
  const tools=blocks.filter(x=>x.type==='tool_use').map(x=>x.name),toolResults=blocks.filter(x=>x.type==='tool_result').length;
  const valid=code===0&&!timedOut&&result?.is_error===false&&result.result?.trim()===expected&&tools.length===1&&tools[0]==='Read'&&toolResults===1;
  const report={at:new Date().toISOString(),valid,exit:code,timedOut,is_error:result?.is_error,result:result?.result,expected,tools,toolResults,turns:result?.num_turns,subtype:result?.subtype};
  fs.writeFileSync(path.join(data,'claude-tool-validation.json'),JSON.stringify(report,null,2),{mode:0o600});
  console.log(JSON.stringify(report));process.exitCode=valid?0:1;
});
