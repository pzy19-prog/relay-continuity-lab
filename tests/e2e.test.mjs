import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {create,handoff,receipt,verify,resume,decide,load,list} from '../src/core.mjs';
import crypto from 'node:crypto';

function setup(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'relay-e2e-'));
  const repo=path.join(dir,'repo'),store=path.join(dir,'state');fs.mkdirSync(repo);
  const g=(...args)=>{const x=spawnSync('git',['-C',repo,...args],{encoding:'utf8'});assert.equal(x.status,0,x.stderr);return x.stdout.trim();};
  g('init','-q');g('config','user.email','demo@example.invalid');g('config','user.name','Demo');
  fs.copyFileSync('benchmark/fixture/calc.mjs',path.join(repo,'calc.mjs'));
  fs.copyFileSync('benchmark/fixture/calc.test.mjs',path.join(repo,'calc.test.mjs'));
  g('add','.');g('commit','-qm','baseline failing');
  const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,p))).digest('hex');
  return {dir,repo,store,g,sha};
}
function fixed(f){
  const p=path.join(f.repo,'calc.mjs');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('a - b','a + b'));
  f.g('add','.');f.g('commit','-qm','fix');return f.g('rev-parse','HEAD');
}
function packet(t,head,f,over={}){return {receipt_id:'demo-001',task_id:t.id,actor:'local-executor',status:'PASS',base_commit:t.base,head_commit:head,evidence:[{kind:'file_hash',path:'calc.mjs',sha256:f.sha('calc.mjs')}],...over};}
test('full manual handoff + independently verified fix + human approval + restart resume',t=>{
 const f=setup();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
 const task=create(f.store,{goal:'Fix addition',repo:f.repo,allowed:['calc.mjs'],testFile:'calc.test.mjs'});
 assert.equal(task.state,'CREATED');
 const prep=handoff(f.store,task.id);assert.equal(prep.target_actor,'local-executor');assert.equal(prep.base_commit,task.base);
 const cleanEnv={...process.env};delete cleanEnv.NODE_TEST_CONTEXT;const red=spawnSync(process.execPath,['--test','calc.test.mjs'],{cwd:f.repo,env:cleanEnv});assert.notEqual(red.status,0);
 const head=fixed(f);const rec=packet(task,head,f);receipt(f.store,task.id,rec);
 assert.equal(receipt(f.store,task.id,rec).receipts.length,1);
 assert.throws(()=>receipt(f.store,task.id,{...rec,status:'UNKNOWN'}),/CONFLICTING_RECEIPT/);
 const checked=verify(f.store,task.id);assert.equal(checked.state,'VERIFIED_PENDING_DECISION');
 assert.equal(checked.review.status,'INDEPENDENT_CHECKS_PASS');
 assert.equal(resume(f.store,task.id).environment_match,true);
 assert.equal(decide(f.store,task.id,'APPROVE').state,'COMPLETED');
 assert.equal(load(f.store,task.id).events.at(-1).kind,'HUMAN_DECISION');
 assert.equal(list(f.store).length,1);
});
test('missing evidence blocks and no automatic retry',t=>{
 const f=setup();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
 const task=create(f.store,{goal:'Fix addition',repo:f.repo,allowed:['calc.mjs'],testFile:'calc.test.mjs'});handoff(f.store,task.id);
 const head=fixed(f);receipt(f.store,task.id,packet(task,head,f,{evidence:[]}));
 assert.equal(verify(f.store,task.id).review.reason,'MISSING_EVIDENCE');
 assert.equal(load(f.store,task.id).state,'BLOCKED');
 assert.equal(resume(f.store,task.id).state,'BLOCKED');
 assert.throws(()=>decide(f.store,task.id,'APPROVE'),/DECISION_STATE_INVALID/);
});
test('wrong actor blocked',t=>{
 const f=setup();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
 const task=create(f.store,{goal:'Fix addition',repo:f.repo,allowed:['calc.mjs'],testFile:'calc.test.mjs'});handoff(f.store,task.id);
 const head=fixed(f);receipt(f.store,task.id,packet(task,head,f,{actor:'other'}));
 assert.equal(verify(f.store,task.id).review.reason,'ACTOR_MISMATCH');
});
test('stale base blocked',t=>{
 const f=setup();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
 const task=create(f.store,{goal:'Fix addition',repo:f.repo,allowed:['calc.mjs'],testFile:'calc.test.mjs'});handoff(f.store,task.id);
 const head=fixed(f);receipt(f.store,task.id,packet(task,head,f,{base_commit:'0'.repeat(40)}));
 assert.equal(verify(f.store,task.id).review.reason,'STALE_BASE');
});
test('unknown outcome requires reconciliation, not silent retry',t=>{
 const f=setup();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
 const task=create(f.store,{goal:'Fix addition',repo:f.repo,allowed:['calc.mjs'],testFile:'calc.test.mjs'});handoff(f.store,task.id);
 receipt(f.store,task.id,packet(task,task.base,f,{status:'UNKNOWN',evidence:[]}));
 assert.equal(load(f.store,task.id).state,'WAITING_RECONCILIATION');
 assert.throws(()=>verify(f.store,task.id),/VERIFY_STATE_INVALID/);
});
test('out-of-scope edits blocked even if test passes',t=>{
 const f=setup();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
 const task=create(f.store,{goal:'Fix addition',repo:f.repo,allowed:['calc.mjs'],testFile:'calc.test.mjs'});handoff(f.store,task.id);
 fixed(f);fs.writeFileSync(path.join(f.repo,'side-effect.txt'),'wrong');f.g('add','.');f.g('commit','-qm','side effect');
 const head=f.g('rev-parse','HEAD');receipt(f.store,task.id,packet(task,head,f));
 assert.equal(verify(f.store,task.id).review.reason,'OUT_OF_SCOPE');
});
test('no independent test configured never claims verified',t=>{
 const f=setup();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
 const task=create(f.store,{goal:'Fix addition',repo:f.repo,allowed:['calc.mjs']});handoff(f.store,task.id);
 const head=fixed(f);receipt(f.store,task.id,packet(task,head,f));
 assert.equal(verify(f.store,task.id).review.reason,'NO_INDEPENDENT_TEST_CONFIGURED');
});
test('reject invalid filenames and cannot create from dirty repo',t=>{
 const f=setup();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
 assert.throws(()=>create(f.store,{goal:'x',repo:f.repo,allowed:['../secret']}),/INVALID_RELATIVE_PATH/);
 fs.writeFileSync(path.join(f.repo,'unclean.txt'),'uncommitted');
 assert.throws(()=>create(f.store,{goal:'x',repo:f.repo,allowed:['calc.mjs']}),/REPO_MUST_BE_CLEAN/);
});
test('self-reported PASS and matching hash cannot bypass failing independent test',t=>{
 const f=setup();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
 const task=create(f.store,{goal:'Fix addition',repo:f.repo,allowed:['calc.mjs'],testFile:'calc.test.mjs'});handoff(f.store,task.id);
 const p=path.join(f.repo,'calc.mjs');fs.writeFileSync(p,"export function add(a,b){return a*b;}\n");f.g('add','calc.mjs');f.g('commit','-qm','wrong logic');
 const head=f.g('rev-parse','HEAD');receipt(f.store,task.id,packet(task,head,f));
 assert.equal(verify(f.store,task.id).review.reason,'INDEPENDENT_TEST_FAILED_OR_SKIPPED');
});
test('dirty post-receipt worktree blocks proof and resume reports mismatch',t=>{
 const f=setup();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
 const task=create(f.store,{goal:'Fix addition',repo:f.repo,allowed:['calc.mjs'],testFile:'calc.test.mjs'});handoff(f.store,task.id);
 const head=fixed(f);receipt(f.store,task.id,packet(task,head,f));
 fs.writeFileSync(path.join(f.repo,'calc.test.mjs'),"import {test} from 'node:test';test('fake',()=>{});\n");
 assert.equal(resume(f.store,task.id).environment_match,false);
 assert.equal(verify(f.store,task.id).review.reason,'DIRTY_WORKTREE');
});
test('untracked new files block even when actor claims PASS',t=>{
 const f=setup();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
 const task=create(f.store,{goal:'Fix addition',repo:f.repo,allowed:['calc.mjs'],testFile:'calc.test.mjs'});handoff(f.store,task.id);
 const head=fixed(f);receipt(f.store,task.id,packet(task,head,f));
 fs.writeFileSync(path.join(f.repo,'sneaky.txt'),'untracked');
 assert.equal(verify(f.store,task.id).review.reason,'DIRTY_WORKTREE');
});
test('symlink changes cannot carry an approved file hash even if target is in repo',t=>{
 const f=setup();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
 const task=create(f.store,{goal:'Fix addition',repo:f.repo,allowed:['calc.mjs'],testFile:'calc.test.mjs'});handoff(f.store,task.id);
 f.g('rm','calc.mjs');fs.symlinkSync('calc.test.mjs',path.join(f.repo,'calc.mjs'));
 f.g('add','calc.mjs');f.g('commit','-qm','replace implementation with symlink');
 const head=f.g('rev-parse','HEAD');receipt(f.store,task.id,packet(task,head,f));
 assert.equal(verify(f.store,task.id).review.reason,'NON_REGULAR_FILE');
});
test('a new task cannot use a symlink as its independent test file',t=>{
 const f=setup();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
 fs.symlinkSync('calc.test.mjs',path.join(f.repo,'test-link.mjs'));f.g('add','.');f.g('commit','-qm','add test symlink');
 assert.throws(()=>create(f.store,{goal:'Fix',repo:f.repo,allowed:['calc.mjs'],testFile:'test-link.mjs'}),/NON_REGULAR_FILE/);
});
