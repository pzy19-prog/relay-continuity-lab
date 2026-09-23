// Isolated, single-user local prototype. NOT a secure execution sandbox.
// No Chat/Work/Codex integration; adapters are explicitly human-mediated.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const defaultStore = process.env.RELAY_STORE || path.join(os.homedir(), '.relay-lab-local');
const namePattern = /^[a-zA-Z0-9._-]+$/;
function req(ok, code) { if(!ok) throw new Error(code); }
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function git(repo, ...args) {
  const r=spawnSync('git', ['-C',repo,...args], {encoding:'utf8',timeout:15000});
  req(r.status===0, `GIT_ERROR: ${r.stderr?.trim() || 'unknown error'}`);
  return r.stdout.trim();
}
function verifyRepo(p) {
  const dir=fs.realpathSync(p);
  req(fs.statSync(dir).isDirectory(), 'INVALID_REPO');
  req(git(dir,'rev-parse','--show-toplevel')===dir, 'REPO_ROOT_REQUIRED');
  req(git(dir,'status','--porcelain').length===0, 'REPO_MUST_BE_CLEAN');
  return dir;
}
function goodPath(p) {
  req(typeof p==='string' && p.length>0 && p!==' .' && p!=='.' && !path.isAbsolute(p) &&
    !p.includes('\\') && !p.includes('\0') && !p.split('/').some(x=>x==='..'||x==='.'||x==='') &&
    path.posix.normalize(p)===p, 'INVALID_RELATIVE_PATH');
  return p;
}
function repoFile(repo, relative) {
  const name=goodPath(relative), file=path.resolve(repo,name);
  req(file.startsWith(repo+path.sep), 'PATH_ESCAPE');
  const st=fs.lstatSync(file);
  req(st.isFile() && !st.isSymbolicLink(), 'NON_REGULAR_FILE');
  req(fs.realpathSync(file).startsWith(repo+path.sep), 'PATH_ESCAPE');
  return file;
}
function assertClean(repo) {
  req(git(repo,'status','--porcelain','--untracked-files=all').length===0,'DIRTY_WORKTREE');
}
function taskPath(store,id) {req(namePattern.test(id), 'INVALID_ID');return path.join(store,'tasks',id+'.json');}
function emit(task,kind,detail={}) {
  task.events.push({seq:task.events.length+1, at:new Date().toISOString(),kind, detail});
  task.updated_at=new Date().toISOString();
}
function save(store,task) {
  const f=taskPath(store,task.id);fs.mkdirSync(path.dirname(f),{recursive:true,mode:0o700});
  const tmp=f+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(task,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,f);
}
export function load(store,id) { return JSON.parse(fs.readFileSync(taskPath(store,id),'utf8')); }
export function list(store) {
  const p=path.join(store,'tasks');if(!fs.existsSync(p))return [];
  return fs.readdirSync(p).filter(x=>x.endsWith('.json')).map(x=>load(store,x.slice(0,-5))).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
}
export function create(store,{goal,repo,actor='local-executor',allowed=[],testFile='',constraints=[]}) {
  req(typeof goal==='string'&&goal.trim(),'GOAL_REQUIRED');req(namePattern.test(actor),'INVALID_ACTOR');
  const root=verifyRepo(repo);const allowedPaths=[...new Set(allowed.map(goodPath))];req(allowedPaths.length,'ALLOWED_PATHS_REQUIRED');
  if(testFile) { repoFile(root,testFile); req(git(root,'ls-files','--error-unmatch','--',testFile)===testFile,'TEST_FILE_UNTRACKED'); }
  const id='R-'+crypto.randomUUID().slice(0,8),base=git(root,'rev-parse','HEAD');
  const task={schema:'relay-lab/v0',id,goal,repo:root,actor,allowed_paths:allowedPaths,test_file:testFile,constraints,
    base, state:'CREATED',owner:'human',next_action:'Generate explicit handoff',receipts:[],review:null,events:[],updated_at:''};
  emit(task,'TASK_CREATED',{base,actor,allowed_paths:allowedPaths});save(store,task);return task;
}
export function handoff(store,id) {
  const t=load(store,id);req(t.state==='CREATED','HANDOFF_STATE_INVALID');
  req(git(t.repo,'rev-parse','HEAD')===t.base,'BASE_DRIFT');
  t.state='HANDED_OFF';t.owner=t.actor;t.next_action='Executor works; return a structured receipt';
  emit(t,'HANDOFF_CREATED',{actor:t.actor,base:t.base});save(store,t);
  return {schema:'relay-lab/handoff-v0',task_id:t.id,goal:t.goal,source_actor:'human',target_actor:t.actor,base_commit:t.base,repo_local:t.repo,
    allowed_paths:t.allowed_paths,constraints:t.constraints,test_command:t.test_file?`node --test ${t.test_file}`:null,
    return_receipt:{receipt_id:'uuid/string',actor:t.actor,base_commit:t.base,head_commit:'git HEAD',status:'PASS | FAIL | UNKNOWN',evidence:[{kind:'file_hash',path:'...',sha256:'...'}]}};
}
export function receipt(store,id,packet) {
  const t=load(store,id);
  req(typeof packet==='object'&&packet!==null,'RECEIPT_REQUIRED');
  req(typeof packet.receipt_id==='string'&&namePattern.test(packet.receipt_id),'INVALID_RECEIPT_ID');
  req(['PASS','FAIL','UNKNOWN'].includes(packet.status),'INVALID_RECEIPT_STATUS');
  const prior=t.receipts.find(r=>r.receipt_id===packet.receipt_id);
  if(prior){req(JSON.stringify(prior)===JSON.stringify(packet),'CONFLICTING_RECEIPT');return t;}
  req(['HANDED_OFF','WAITING_RECONCILIATION'].includes(t.state),'RECEIPT_STATE_INVALID');
  req(t.receipts.length===0,'ONE_RECEIPT_PER_HANDOFF_V0');
  t.receipts.push(packet);
  t.state=packet.status==='UNKNOWN'?'WAITING_RECONCILIATION':'WAITING_REVIEW';
  t.owner='human-reviewer';t.next_action=packet.status==='UNKNOWN'?'Reconcile original execution outcome; never retry automatically':'Run independent evidence verification';
  emit(t,'RECEIPT_RECORDED',{id:packet.receipt_id,status:packet.status});save(store,t);return t;
}
export function verify(store,id) {
  const t=load(store,id);req(t.state==='WAITING_REVIEW','VERIFY_STATE_INVALID');
  const r=t.receipts[0];let reason='';
  try {
    req(r.status==='PASS','EXECUTOR_DID_NOT_REPORT_PASS');
    req(r.task_id===t.id,'TASK_MISMATCH');req(r.actor===t.actor,'ACTOR_MISMATCH');
    req(r.base_commit===t.base,'STALE_BASE');
    const head=git(t.repo,'rev-parse','HEAD');req(head===r.head_commit,'STALE_HEAD');
    assertClean(t.repo);
    const ancestry=spawnSync('git',['-C',t.repo,'merge-base','--is-ancestor',t.base,head],{timeout:15000});
    req(ancestry.status===0,'NON_DESCENDANT_HEAD');
    req(Array.isArray(r.evidence)&&r.evidence.length>0,'MISSING_EVIDENCE');
    const changedResult=spawnSync('git',['-C',t.repo,'diff','--name-only','-z',t.base,head,'--'],{timeout:15000});
    req(changedResult.status===0,'GIT_DIFF_ERROR');
    const changed=changedResult.stdout.toString('utf8').split('\0').filter(Boolean);
    req(changed.length>0,'NO_DIFF');
    req(changed.every(p=>t.allowed_paths.includes(p)),'OUT_OF_SCOPE');
    for(const p of changed){
      const proof=r.evidence.find(e=>e.path===p && e.kind==='file_hash');
      req(proof&&proof.sha256===hash(repoFile(t.repo,p)),'INVALID_FILE_EVIDENCE');
    }
    req(t.test_file,'NO_INDEPENDENT_TEST_CONFIGURED');
    const test=repoFile(t.repo,t.test_file);
    const cleanEnv={...process.env};delete cleanEnv.NODE_TEST_CONTEXT;
    const out=spawnSync(process.execPath,['--test',test],{cwd:t.repo,env:cleanEnv,encoding:'utf8',timeout:30000});
    const count=/(?:^|\n)# tests (\d+)(?:\s|$)/.exec(out.stdout||'');
    const skipped=/(?:^|\n)# skipped (\d+)(?:\s|$)/.exec(out.stdout||'');
    req(out.status===0 && count && Number(count[1])>0 && (!skipped || Number(skipped[1])===0),
      'INDEPENDENT_TEST_FAILED_OR_SKIPPED');
  } catch(e){reason=e.message;}
  if(reason){t.state='BLOCKED';t.review={status:'BLOCKED',reason};t.next_action='Human inspect blocked evidence and create a new bounded handoff';}
  else {t.state='VERIFIED_PENDING_DECISION';t.review={status:'INDEPENDENT_CHECKS_PASS',at:new Date().toISOString(),head_commit:r.head_commit};
    t.next_action='Human approval required; structural checks do not verify semantic correctness';}
  t.owner='human-reviewer';emit(t,'INDEPENDENT_CHECK',{result:t.review.status,reason});save(store,t);return t;
}
export function decide(store,id,decision) {
  const t=load(store,id);req(t.state==='VERIFIED_PENDING_DECISION','DECISION_STATE_INVALID');
  req(['APPROVE','REJECT'].includes(decision),'INVALID_DECISION');
  t.state=decision==='APPROVE'?'COMPLETED':'NEEDS_REPAIR';
  t.owner='human';t.next_action=decision==='APPROVE'?'Task closed':'Create a new bounded task for repair';
  emit(t,'HUMAN_DECISION',{decision});save(store,t);return t;
}
export function resume(store,id) {
  const t=load(store,id);const head=git(t.repo,'rev-parse','HEAD');
  return {schema:'relay-lab/checkpoint-v0',task_id:t.id,goal:t.goal,state:t.state,owner:t.owner,next_action:t.next_action,
    constraints:t.constraints,allowed_paths:t.allowed_paths,base:t.base,actual_head:head,
    expected_head:t.receipts[0]?.head_commit??t.base,
    environment_match:head===(t.receipts[0]?.head_commit??t.base) && git(t.repo,'status','--porcelain','--untracked-files=all').length===0,
    worktree_clean:git(t.repo,'status','--porcelain','--untracked-files=all').length===0,
    receipt_id:t.receipts[0]?.receipt_id??null,independent_review:t.review??null,
    notice:'Manual transfer only. This packet is not automatically injected into a Chat/Work/Codex session.'};
}
