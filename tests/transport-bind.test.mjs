import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {seal} from '../src/transport.mjs';
import {acceptInboxChain} from '../src/transport-inbox.mjs';
import {bindTransportInboxTask} from '../src/transport-bind.mjs';
import {list} from '../src/core.mjs';

function git(repo,...args){const r=spawnSync('git',['-C',repo,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
function makeRepo(root,name){
  const repo=path.join(root,name);fs.mkdirSync(repo);
  git(repo,'init','-q');git(repo,'config','user.name','G10');git(repo,'config','user.email','g10@example.invalid');
  fs.writeFileSync(path.join(repo,'calc.mjs'),'export function add(a,b){ return a-b; }\n');
  fs.writeFileSync(path.join(repo,'calc.test.mjs'),"import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {add} from './calc.mjs';\ntest('add',()=>assert.equal(add(2,3),5));\n");
  git(repo,'add','.');git(repo,'commit','-qm','baseline '+name);return repo;
}
function chain(taskId='R-G10-001'){
  const authority={scope_change:'human_only',final_approval:'human'};
  const payload={goal:'Bind validated transport only',allowed_paths:['calc.mjs'],test_file:'calc.test.mjs',constraints:['No automatic execution']};
  const chat=seal({schema:'relay-lab/transport-v0',task_id:taskId,packet_id:'chat-001',seq:1,parent_packet_id:null,stage:'CHAT_INTENT',source_surface:'chat',target_surface:'work',authority,payload});
  const work=seal({schema:'relay-lab/transport-v0',task_id:taskId,packet_id:'work-001',seq:2,parent_packet_id:'chat-001',stage:'WORK_CONTINUATION',source_surface:'work',target_surface:'codex',authority,payload:{...payload,notes:'Bounded plan confirmed.'}});
  return [chat,work];
}

test('G10 explicit bind creates one CREATED task with immutable transport provenance and is idempotent',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'relay-g10-bind-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const store=path.join(root,'store'),repo=makeRepo(root,'repo-a'),packets=chain();
  const inbox=acceptInboxChain(store,{repo:'owner/source',issue:14,packets}).record;
  assert.equal(list(store).length,0);
  const last=inbox.last_accepted;
  const first=bindTransportInboxTask(store,{taskId:'R-G10-001',repo,expectedPacketId:last.packet_id,expectedHash:last.content_sha256});
  assert.equal(first.status,'BOUND');assert.equal(first.created,true);
  assert.equal(first.task.state,'CREATED');assert.equal(first.task.owner,'human');
  assert.equal(first.task.goal,packets[0].payload.goal);
  assert.deepEqual(first.task.allowed_paths,packets[0].payload.allowed_paths);
  assert.equal(first.task.test_file,packets[0].payload.test_file);
  assert.deepEqual(first.task.constraints,packets[0].payload.constraints);
  assert.equal(first.task.provenance.source.repo,'owner/source');
  assert.equal(first.task.provenance.source.issue,14);
  assert.equal(first.task.provenance.packet_id,'work-001');
  assert.equal(first.task.provenance.content_sha256,last.content_sha256);
  assert.equal(first.task.provenance.local_base_commit,git(repo,'rev-parse','HEAD'));
  assert.equal(first.task.receipts.length,0);assert.equal(first.task.review,null);
  const second=bindTransportInboxTask(store,{taskId:'R-G10-001',repo,expectedPacketId:last.packet_id,expectedHash:last.content_sha256});
  assert.equal(second.status,'IDEMPOTENT');assert.equal(second.created,false);assert.equal(list(store).length,1);
});

test('G10 bind fails closed on reviewed hash change, dirty repo and conflicting repo',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'relay-g10-block-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const store=path.join(root,'store'),repo=makeRepo(root,'repo-a'),packets=chain('R-G10-BLOCK');
  const inbox=acceptInboxChain(store,{repo:'owner/source',issue:15,packets}).record,last=inbox.last_accepted;
  assert.throws(()=>bindTransportInboxTask(store,{taskId:'R-G10-BLOCK',repo,expectedPacketId:last.packet_id,expectedHash:'0'.repeat(64)}),/REVIEWED_PACKET_HASH_CHANGED/);
  fs.writeFileSync(path.join(repo,'dirty.txt'),'dirty');
  assert.throws(()=>bindTransportInboxTask(store,{taskId:'R-G10-BLOCK',repo,expectedPacketId:last.packet_id,expectedHash:last.content_sha256}),/REPO_MUST_BE_CLEAN/);
  fs.unlinkSync(path.join(repo,'dirty.txt'));
  bindTransportInboxTask(store,{taskId:'R-G10-BLOCK',repo,expectedPacketId:last.packet_id,expectedHash:last.content_sha256});
  const other=makeRepo(root,'repo-b');
  assert.throws(()=>bindTransportInboxTask(store,{taskId:'R-G10-BLOCK',repo:other,expectedPacketId:last.packet_id,expectedHash:last.content_sha256}),/TASK_BINDING_CONFLICT/);
});
