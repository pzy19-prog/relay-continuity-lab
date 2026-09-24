import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve('.'), installer=path.join(root,'scripts/install-skill.mjs');
function sh(cmd,args,options={}){const env={...process.env,...(options.env||{})};delete env.NODE_TEST_CONTEXT;return spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:30000,...options,env});}
function repo(dir){
 const p=path.join(dir,'repo');fs.mkdirSync(p);
 function g(...args){const r=sh('git',['-C',p,...args]);assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
 g('init','-q');g('config','user.email','test@example.invalid');g('config','user.name','Test');
 fs.copyFileSync(path.join(root,'benchmark/fixture/calc.mjs'),path.join(p,'calc.mjs'));
 fs.copyFileSync(path.join(root,'benchmark/fixture/calc.test.mjs'),path.join(p,'calc.test.mjs'));
 g('add','.');g('commit','-qm','broken baseline');return {p,g};
}
test('install/status/uninstall only a managed Skill, without touching global home',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'relay-skill-test-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const rootDir=path.join(temp,'skills');
 let r=sh(process.execPath,[installer,'--target-root',rootDir,'--status']);assert.notEqual(r.status,0);
 r=sh(process.execPath,[installer,'--target-root',rootDir]);assert.equal(r.status,0,r.stderr);
 const data=JSON.parse(r.stdout);assert.ok(fs.existsSync(data.entry));
 r=sh(process.execPath,[installer,'--target-root',rootDir,'--status']);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).clean,true);
 r=sh(process.execPath,[installer,'--target-root',rootDir]);assert.notEqual(r.status,0,'install must not silently overwrite even a clean managed Skill');
 r=sh(process.execPath,[installer,'--target-root',rootDir,'--uninstall']);assert.equal(r.status,0,r.stderr);
 assert.equal(fs.existsSync(data.dest),false);
});
test('preserve unknown and locally modified Skills without force; refuse unknown even with force',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'relay-skill-conflict-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const target=path.join(temp,'skills'),dest=path.join(target,'relay-lab');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'SKILL.md'),'CUSTOM');
 for(const args of [[],['--force'],['--uninstall'],['--uninstall','--force']]){
   const x=sh(process.execPath,[installer,'--target-root',target,...args]);assert.notEqual(x.status,0);
 }
 assert.equal(fs.readFileSync(path.join(dest,'SKILL.md'),'utf8'),'CUSTOM');
 fs.rmSync(dest,{recursive:true});
 assert.equal(sh(process.execPath,[installer,'--target-root',target]).status,0);
 fs.appendFileSync(path.join(dest,'SKILL.md'),'\nCUSTOMIZED');
 assert.notEqual(sh(process.execPath,[installer,'--target-root',target,'--uninstall']).status,0);
 assert.equal(sh(process.execPath,[installer,'--target-root',target,'--force']).status,0,'explicit force may replace an identified modified installation');
});
test('installed CLI uses isolated store for create/handoff/show/resume without changing the Git fixture',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'relay-skill-wrapper-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const target=path.join(temp,'skills'),{p}=repo(temp);
 const install=sh(process.execPath,[installer,'--target-root',target]);assert.equal(install.status,0,install.stderr);
 const entry=JSON.parse(install.stdout).entry,store=path.join(temp,'state');
 const call=(...args)=>sh(process.execPath,[entry,'--store',store,...args]);
 let r=call('create','--goal','Synthetic test','--repo',p,'--actor','local-agent','--allowed','calc.mjs','--test','calc.test.mjs');assert.equal(r.status,0,r.stderr);const task=JSON.parse(r.stdout);
 r=call('handoff',task.id);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).task_id,task.id);
 r=call('show',task.id);assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).state,'HANDED_OFF');
 r=call('resume',task.id);assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).environment_match,true);
 assert.notEqual(call('show','wrong-id').status,0);
 assert.notEqual(call('verify',task.id).status,0);
 assert.equal(sh('git',['-C',p,'status','--porcelain']).stdout.trim(),'');
});
test('project install is discoverable under .agents/skills and the test fixture is committed clean',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'relay-skill-project-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const {p,g}=repo(temp),r=sh(process.execPath,[installer,'--scope','project','--host','cursor','--project-dir',p]);assert.equal(r.status,0,r.stderr);
 const file=path.join(p,'.agents','skills','relay-lab','SKILL.md');assert.ok(fs.existsSync(file));
 assert.match(fs.readFileSync(file,'utf8'),/name: relay-lab/);
 assert.ok(fs.existsSync(path.join(p,'.agents','skills','relay-lab','vendor','service-client.mjs')));
 assert.match(fs.readFileSync(file,'utf8'),/service-show/);
 g('add','.');g('commit','-qm','fixture: installed Skill');
 assert.equal(g('status','--porcelain'),'');
});
test('skill pilot scripts provide new isolated fixture; synthetic stand-in does not count as real Agent',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'relay-skill-synthetic-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const home=path.join(temp,'pilot'),env={...process.env,RELAY_SKILL_PILOT_DIR:home};
 let r=sh(process.execPath,['scripts/skill-pilot-prepare.mjs'],{env});assert.equal(r.status,0,r.stderr);const prep=JSON.parse(r.stdout);
 assert.ok(fs.existsSync(prep.skill_entry));const f=path.join(prep.repo,'calc.mjs');
 assert.equal(sh(process.execPath,['--test','calc.test.mjs'],{cwd:prep.repo}).status!==0,true);
 fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('a - b','a + b'));
 const g=(...args)=>{const res=sh('git',['-C',prep.repo,...args]);assert.equal(res.status,0,res.stderr);};
 g('add','calc.mjs');g('commit','-qm','synthetic stand-in: fix');
 r=sh(process.execPath,['scripts/skill-pilot-finish.mjs',home]);assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);
 assert.equal(result.state,'VERIFIED_PENDING_DECISION');assert.equal(result.environment_match,true);
 const approve=sh(process.execPath,[prep.skill_entry,'--store',prep.store,'decide',prep.task_id,'--decision','APPROVE']);assert.equal(approve.status,0,approve.stderr);
 const resume=sh(process.execPath,[prep.skill_entry,'--store',prep.store,'resume',prep.task_id]);assert.equal(resume.status,0,resume.stderr);
 assert.equal(JSON.parse(resume.stdout).state,'COMPLETED');
});
test('installed Skill rejects a stale HEAD receipt rather than trusting self-reported PASS',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'relay-skill-stale-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const target=path.join(temp,'skills'),{p,g}=repo(temp);
 const install=sh(process.execPath,[installer,'--target-root',target]);assert.equal(install.status,0,install.stderr);
 const entry=JSON.parse(install.stdout).entry,store=path.join(temp,'state');
 const call=(...args)=>sh(process.execPath,[entry,'--store',store,...args]);
 let r=call('create','--goal','Fix addition','--repo',p,'--actor','local-agent','--allowed','calc.mjs','--test','calc.test.mjs');assert.equal(r.status,0,r.stderr);
 const task=JSON.parse(r.stdout);assert.equal(call('handoff',task.id).status,0);
 fs.writeFileSync(path.join(p,'calc.mjs'),'export function add(a,b){return a+b;}\n');g('add','calc.mjs');g('commit','-qm','fix');
 const receipt={receipt_id:'stale-1',task_id:task.id,actor:'local-agent',status:'PASS',base_commit:task.base,
  head_commit:task.base,evidence:[{kind:'file_hash',path:'calc.mjs',sha256:'self-report-not-trusted'}]};
 const file=path.join(temp,'receipt.json');fs.writeFileSync(file,JSON.stringify(receipt));
 assert.equal(call('receipt',task.id,'--file',file).status,0);
 r=call('verify',task.id);assert.equal(r.status,0,r.stderr);
 assert.equal(JSON.parse(r.stdout).review.reason,'STALE_HEAD');
 assert.equal(JSON.parse(call('resume',task.id).stdout).state,'BLOCKED');
});
