#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {load} from '../src/core.mjs';
import {buildDemoReport,currentSurface,loadMetrics,makePilotLauncher,recordMetric,recoveryFor,reportMarkdown,requiredHumanAction} from '../src/demo-state.mjs';

const argv=process.argv.slice(2);
const command=argv.shift();
const opt=(n,d)=>{const i=argv.indexOf(n);return i>=0?argv[i+1]:d;};
const has=n=>argv.includes(n);
const sourceRoot=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const self=fileURLToPath(import.meta.url);
const shq=s=>"'"+String(s).replace(/'/g,"'\\''")+"'";


function child(script,args=[]){
  const r=spawnSync(process.execPath,[new URL(script,import.meta.url).pathname,...args],{encoding:'utf8',timeout:60000});
  if(r.status!==0){
    const raw=(r.stderr||r.stdout||'').trim();
    const recovery=recoveryFor(raw);
    console.error(JSON.stringify({status:'BLOCKED',error:raw,recovery},null,2));
    process.exit(1);
  }
  const raw=r.stdout.trim();
  try{return JSON.parse(raw);}catch{throw new Error('CHILD_OUTPUT_NOT_JSON: '+raw);}
}

function pilot(dir){
  if(!dir)throw new Error('PILOT_REQUIRED');
  const root=path.resolve(dir);
  const p=JSON.parse(fs.readFileSync(path.join(root,'pilot.json'),'utf8'));
  return {root,p};
}

function snapshot(p){
  if(!p.snapshot||!fs.existsSync(p.snapshot))return null;
  return JSON.parse(fs.readFileSync(p.snapshot,'utf8'));
}

function statusPayload(root,p){
  const task=load(p.store,p.task_id),snap=snapshot(p);
  return {
    task_id:task.id,state:task.state,owner:task.owner,
    current_surface:currentSurface(task,snap),
    required_human_action:requiredHumanAction(task,snap),
    independent_review:task.review?.status??null,
    packet_lineage:(snap?.packets||[]).map(x=>({seq:x.seq,packet_id:x.packet_id,stage:x.stage,from:x.source_surface,to:x.target_surface,parent:x.parent_packet_id})),
    ui_url:'http://127.0.0.1:4317/?task='+encodeURIComponent(task.id),
    ui_command:'cd '+shq(sourceRoot)+' && RELAY_STORE='+shq(p.store)+' npm run ui',
    measured_demo_commands:loadMetrics(root).events.filter(e=>e.kind==='DEMO_COMMAND').length
  };
}

try {
  if(command==='prepare'){
    const issue=opt('--issue','');if(!issue)throw new Error('ISSUE_REQUIRED');
    const repo=opt('--repo','pzy19-prog/relay-continuity-lab');
    const args=['--issue',issue,'--repo',repo];if(has('--publish-work'))args.push('--publish-work');
    const out=child('./g5-pilot-prepare.mjs',args);
    recordMetric(out.pilot_dir,{kind:'DEMO_COMMAND',command:'prepare'});
    const launcher=makePilotLauncher(out.pilot_dir,self);
    console.log(JSON.stringify({...out,
      demo_command:'prepare',
      launcher,
      ui_command:'cd '+shq(sourceRoot)+' && RELAY_STORE='+shq(out.store)+' npm run ui',
      next_human_action:'Open the generated demo-repo in the authorized local coding Agent and execute AGENT_TASK.md. No JSON copying is required.',
      status_command:shq(launcher)+' status',
      finish_command:shq(launcher)+' finish --publish-receipt'
    },null,2));
  } else if(command==='status'){
    const {root,p}=pilot(opt('--pilot',''));
    recordMetric(root,{kind:'DEMO_COMMAND',command:'status'});
    console.log(JSON.stringify(statusPayload(root,p),null,2));
  } else if(command==='finish'){
    const {root,p}=pilot(opt('--pilot',''));
    const args=[root];if(has('--publish-receipt'))args.push('--publish-receipt');
    const out=child('./g5-pilot-finish.mjs',args);
    recordMetric(root,{kind:'DEMO_COMMAND',command:'finish'});
    console.log(JSON.stringify({...out,
      demo_command:'finish',
      next_human_action:'Review the published receipt in Chat. If accepted, run the explicit demo approve command.',
      approve_command:shq(path.join(root,'relay-demo'))+' approve --decision APPROVE',
      status:statusPayload(root,p)
    },null,2));
  } else if(command==='approve'){
    const {root,p}=pilot(opt('--pilot',''));
    const decision=opt('--decision','');
    if(!['APPROVE','REJECT'].includes(decision))throw new Error('EXPLICIT_DECISION_REQUIRED');
    const run=(...args)=>{
      const r=spawnSync(process.execPath,[p.entry,...args],{cwd:p.repo,encoding:'utf8',timeout:30000});
      if(r.status!==0)throw new Error(r.stderr||r.stdout);
      return JSON.parse(r.stdout);
    };
    const decided=run('decide',p.task_id,'--decision',decision);
    const resumed=run('resume',p.task_id);
    recordMetric(root,{kind:'DEMO_COMMAND',command:'approve',decision});
    console.log(JSON.stringify({decision,decided_state:decided.state,resume:resumed,status:statusPayload(root,p),next:'Run '+shq(path.join(root,'relay-demo'))+' report to produce the sanitized demo report.'},null,2));
  } else if(command==='report'){
    const {root,p}=pilot(opt('--pilot',''));
    recordMetric(root,{kind:'DEMO_COMMAND',command:'report'});
    const task=load(p.store,p.task_id),snap=snapshot(p),metrics=loadMetrics(root);
    const report=buildDemoReport(task,snap,metrics);
    const jsonFile=path.join(root,'demo-report.json'),mdFile=path.join(root,'demo-report.md');
    fs.writeFileSync(jsonFile,JSON.stringify(report,null,2)+'\n',{mode:0o600});
    fs.writeFileSync(mdFile,reportMarkdown(report)+'\n',{mode:0o600});
    console.log(JSON.stringify({report,json_file:jsonFile,markdown_file:mdFile},null,2));
  } else if(command==='recover'){
    const error=opt('--error','');
    console.log(JSON.stringify(recoveryFor(error),null,2));
  } else {
    throw new Error('USAGE: npm run demo -- prepare --issue N [--publish-work] | status --pilot DIR | finish --pilot DIR [--publish-receipt] | approve --pilot DIR --decision APPROVE|REJECT | report --pilot DIR | recover --error TEXT');
  }
} catch(e){
  console.error(JSON.stringify({status:'BLOCKED',error:e.message,recovery:recoveryFor(e.message)},null,2));
  process.exitCode=1;
}
