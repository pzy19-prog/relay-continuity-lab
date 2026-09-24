import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {create,load} from './core.mjs';
import {loadTransportInboxTask} from './transport-inbox.mjs';
import {saveSnapshot} from './github-transport.mjs';

function req(ok,code){if(!ok)throw new Error(code);}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function git(repo,...args){
  const r=spawnSync('git',['-C',repo,...args],{encoding:'utf8',timeout:15000});
  req(r.status===0,'GIT_ERROR: '+(r.stderr?.trim()||'unknown error'));
  return r.stdout.trim();
}
function targetRepo(input){
  const repo=fs.realpathSync(input);
  req(fs.statSync(repo).isDirectory(),'INVALID_REPO');
  req(git(repo,'rev-parse','--show-toplevel')===repo,'REPO_ROOT_REQUIRED');
  req(git(repo,'status','--porcelain','--untracked-files=all').length===0,'REPO_MUST_BE_CLEAN');
  return {repo,base:git(repo,'rev-parse','HEAD')};
}
function scopeFrom(record){
  req(record.status==='VALIDATED','INBOX_NOT_VALIDATED');
  req(record.packets.length>=2,'WORK_CONTINUATION_REQUIRED');
  const root=record.packets[0],last=record.packets.at(-1);
  req(root.stage==='CHAT_INTENT','CHAT_INTENT_REQUIRED');
  req(last.stage==='WORK_CONTINUATION','WORK_CONTINUATION_REQUIRED');
  req(last.target_surface==='codex','WORK_TARGET_INVALID');
  const a=root.payload||{},b=last.payload||{};
  req(typeof a.goal==='string'&&a.goal.trim(),'GOAL_REQUIRED');
  req(Array.isArray(a.allowed_paths)&&a.allowed_paths.length>0,'ALLOWED_PATHS_REQUIRED');
  req(typeof a.test_file==='string'&&a.test_file.length>0,'TEST_FILE_REQUIRED');
  req(Array.isArray(a.constraints),'CONSTRAINTS_REQUIRED');
  req(b.goal===a.goal,'BIND_GOAL_DRIFT');
  req(same(b.allowed_paths,a.allowed_paths),'BIND_PATHS_DRIFT');
  req(b.test_file===a.test_file,'BIND_TEST_DRIFT');
  req(same(b.constraints,a.constraints),'BIND_CONSTRAINTS_DRIFT');
  req(root.authority?.scope_change==='human_only'&&root.authority?.final_approval==='human','BIND_AUTHORITY_INVALID');
  return {root,last,goal:a.goal,allowed:a.allowed_paths,testFile:a.test_file,constraints:a.constraints};
}
function stableProvenance(record,last,base){
  return {
    schema:'relay-lab/transport-binding-v0',
    source:{repo:record.source.repo,issue:record.source.issue},
    task_id:record.task_id,
    packet_id:last.packet_id,
    packet_seq:last.seq,
    content_sha256:last.content_sha256,
    local_base_commit:base
  };
}
function sameBinding(task,{repo,base,goal,allowed,testFile,constraints,provenance}){
  return task.id===provenance.task_id &&
    task.repo===repo &&
    task.base===base &&
    task.goal===goal &&
    same(task.allowed_paths,allowed) &&
    task.test_file===testFile &&
    same(task.constraints,constraints) &&
    same(task.provenance,provenance);
}

export function bindTransportInboxTask(store,{taskId,repo,expectedPacketId,expectedHash,actor='local-agent'}){
  req(typeof taskId==='string'&&taskId,'TASK_ID_REQUIRED');
  req(typeof expectedPacketId==='string'&&expectedPacketId,'EXPECTED_PACKET_REQUIRED');
  req(typeof expectedHash==='string'&&/^[a-f0-9]{64}$/.test(expectedHash),'EXPECTED_HASH_REQUIRED');
  const record=loadTransportInboxTask(store,taskId);
  const scope=scopeFrom(record);
  req(record.task_id===taskId,'BIND_TASK_MISMATCH');
  req(record.last_accepted.packet_id===expectedPacketId,'REVIEWED_PACKET_CHANGED');
  req(record.last_accepted.content_sha256===expectedHash,'REVIEWED_PACKET_HASH_CHANGED');
  const target=targetRepo(repo);
  const provenance=stableProvenance(record,scope.last,target.base);
  const expected={...target,...scope,provenance};

  let prior=null;
  try{prior=load(store,taskId);}catch(e){if(e?.code!=='ENOENT')throw e;}
  if(prior){
    req(sameBinding(prior,expected),'TASK_BINDING_CONFLICT');
    req(prior.state==='CREATED','TASK_ALREADY_ADVANCED');
    return {schema:'relay-lab/transport-bind-result-v0',status:'IDEMPOTENT',created:false,task:prior,provenance};
  }

  const task=create(store,{
    id:taskId,
    goal:scope.goal,
    repo:target.repo,
    actor,
    allowed:scope.allowed,
    testFile:scope.testFile,
    constraints:scope.constraints,
    provenance
  });
  saveSnapshot(store,{repo:record.source.repo,issue:record.source.issue,packets:record.packets});
  return {schema:'relay-lab/transport-bind-result-v0',status:'BOUND',created:true,task,provenance};
}
