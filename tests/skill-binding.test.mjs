import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve('.'), installer=path.join(root,'scripts/install-skill.mjs');
function sh(cmd,args,options={}){const env={...process.env,...(options.env||{})};delete env.NODE_TEST_CONTEXT;return spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:30000,...options,env});}
function fixture(temp){
 const p=path.join(temp,'repo');fs.mkdirSync(p);const g=(...args)=>{const r=sh('git',['-C',p,...args]);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 g('init','-q');g('config','user.email','binding@example.invalid');g('config','user.name','Binding Test');
 fs.copyFileSync(path.join(root,'benchmark/fixture/calc.mjs'),path.join(p,'calc.mjs'));fs.copyFileSync(path.join(root,'benchmark/fixture/calc.test.mjs'),path.join(p,'calc.test.mjs'));
 return {p,g};
}
test('project Skill resolves committed project binding without manual --store',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'relay-binding-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const {p,g}=fixture(temp),store=path.join(temp,'relay-store');
 const install=sh(process.execPath,[installer,'--scope','project','--host','cursor','--project-dir',p]);assert.equal(install.status,0,install.stderr);const entry=JSON.parse(install.stdout).entry;
 fs.writeFileSync(path.join(p,'.relay-lab.json'),JSON.stringify({schema:1,id:'relay-continuity-lab/project-binding',store:'../relay-store'})+'\n');
 g('add','.');g('commit','-qm','fixture: bound project Skill');
 const create=sh(process.execPath,[entry,'--store',store,'create','--goal','Bound task','--repo',p,'--actor','local-agent','--allowed','calc.mjs','--test','calc.test.mjs'],{cwd:p});assert.equal(create.status,0,create.stderr);const task=JSON.parse(create.stdout);
 assert.equal(sh(process.execPath,[entry,'--store',store,'handoff',task.id],{cwd:p}).status,0);
 let r=sh(process.execPath,[entry,'show',task.id],{cwd:p,env:{HOME:path.join(temp,'empty-home')}});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).state,'HANDED_OFF');
 r=sh(process.execPath,[entry,'resume',task.id],{cwd:p,env:{HOME:path.join(temp,'empty-home')}});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).environment_match,true);
});
test('unbound project Skill fails closed instead of reading home default store',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'relay-unbound-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const {p}=fixture(temp);const install=sh(process.execPath,[installer,'--scope','project','--host','cursor','--project-dir',p]);assert.equal(install.status,0,install.stderr);const entry=JSON.parse(install.stdout).entry;
 const r=sh(process.execPath,[entry,'list'],{cwd:p,env:{HOME:path.join(temp,'fake-home')}});assert.equal(r.status,2);assert.match(r.stderr,/PROJECT_STORE_UNBOUND/);
});
