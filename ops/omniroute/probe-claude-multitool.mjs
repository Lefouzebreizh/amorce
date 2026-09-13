// Real Write -> Edit -> Read round trip in an isolated runtime folder.
import fs from 'node:fs'; import path from 'node:path'; import {spawn,spawnSync} from 'node:child_process';
const root=path.resolve(process.argv[2]||''); if(!root) throw Error('pilot root required');
const work=path.join(root,'.runtime','codex-work'), file=path.join(work,'omniroute-multitool-test.txt');
fs.mkdirSync(work,{recursive:true}); try{fs.unlinkSync(file)}catch{}
const prompt=`Dans ${file}, utilise exactement Write puis Edit puis Read. Ecris OLD_VALUE, remplace-le par FINAL_VALUE, lis le fichier, puis reponds uniquement FINAL_VALUE. Aucun autre outil ni fichier.`;
const args=[path.join(root,'claude-via-omniroute.mjs'),root,'--print','--tools','Write,Edit,Read','--allowedTools','Write,Edit,Read','--strict-mcp-config','--no-session-persistence','--setting-sources','','--max-turns','5','--output-format','stream-json','--verbose',prompt];
const child=spawn(process.execPath,args,{cwd:work,stdio:['ignore','pipe','pipe']}); let out='',err='',timedOut=false;
child.stdout.on('data',b=>out+=b); child.stderr.on('data',b=>err+=b);
const timer=setTimeout(()=>{timedOut=true; process.platform==='win32'?spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'}):child.kill('SIGTERM')},120000);
child.on('close',code=>{ clearTimeout(timer);
 fs.writeFileSync(path.join(root,'.runtime','claude-multitool-stream.jsonl'),out,{mode:0o600});
 const events=out.split('\n').flatMap(l=>{try{return[JSON.parse(l)]}catch{return[]}});
 const result=events.findLast(x=>x.type==='result'), blocks=events.flatMap(x=>x.message?.content??[]);
 const tools=blocks.filter(x=>x.type==='tool_use').map(x=>x.name), toolResults=blocks.filter(x=>x.type==='tool_result').length;
 const actual=fs.existsSync(file)?fs.readFileSync(file,'utf8').trim():null;
 const valid=code===0&&!timedOut&&result?.is_error===false&&result.result?.trim()==='FINAL_VALUE'&&actual==='FINAL_VALUE'&&tools.join(',')==='Write,Edit,Read'&&toolResults===3;
 const report={at:new Date().toISOString(),valid,exit:code,timedOut,is_error:result?.is_error,result:result?.result,actual,tools,toolResults,turns:result?.num_turns,stderr:err.slice(-500)};
 fs.writeFileSync(path.join(root,'.runtime','claude-multitool-validation.json'),JSON.stringify(report,null,2),{mode:0o600});
 console.log(JSON.stringify(report)); process.exitCode=valid?0:1;
});