import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {seal} from '../src/transport.mjs';
import {acceptInboxChain} from '../src/transport-inbox.mjs';
import {bindTransportInboxTask} from '../src/transport-bind.mjs';
import {createRelayService} from '../src/service.mjs';
import {serviceGet} from '../src/service-client.mjs';

function git(repo,...args){const r=spawnSync('git',['-C',repo,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
async function listen(server){await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});return 'http://127.0.0.1:'+server.address().port+'/';}
async function close(server){await new Promise(r=>server.close(r));}

test('G10 Service exposes BOUND inbox provenance and CREATED local task',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'relay-g10-service-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const repo=path.join(root,'repo'),store=path.join(root,'store');fs.mkdirSync(repo);
  git(repo,'init','-q');git(repo,'config','user.name','G10');git(repo,'config','user.email','g10@example.invalid');
  fs.writeFileSync(path.join(repo,'calc.mjs'),'export function add(a,b){return a-b;}\n');
  fs.writeFileSync(path.join(repo,'calc.test.mjs'),"import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {add} from './calc.mjs';\ntest('add',()=>assert.equal(add(2,3),5));\n");
  git(repo,'add','.');git(repo,'commit','-qm','baseline');
  const authority={scope_change:'human_only',final_approval:'human'},payload={goal:'Bind only',allowed_paths:['calc.mjs'],test_file:'calc.test.mjs',constraints:['No execution']};
  const chat=seal({schema:'relay-lab/transport-v0',task_id:'R-G10-SVC',packet_id:'chat-001',seq:1,parent_packet_id:null,stage:'CHAT_INTENT',source_surface:'chat',target_surface:'work',authority,payload});
  const work=seal({schema:'relay-lab/transport-v0',task_id:'R-G10-SVC',packet_id:'work-001',seq:2,parent_packet_id:'chat-001',stage:'WORK_CONTINUATION',source_surface:'work',target_surface:'codex',authority,payload:{...payload,notes:'ok'}});
  const rec=acceptInboxChain(store,{repo:'owner/source',issue:16,packets:[chat,work]}).record;
  bindTransportInboxTask(store,{taskId:'R-G10-SVC',repo,expectedPacketId:rec.last_accepted.packet_id,expectedHash:rec.last_accepted.content_sha256});
  const server=createRelayService({store}),base=await listen(server);
  const inbox=await serviceGet('v1/transport-inbox/R-G10-SVC',{base});
  assert.equal(inbox.binding.status,'BOUND');assert.equal(inbox.binding.task_state,'CREATED');
  const task=await serviceGet('v1/tasks/R-G10-SVC',{base});
  assert.equal(task.provenance.packet_id,'work-001');assert.equal(task.provenance.source.issue,16);
  assert.equal(task.state,'CREATED');assert.equal(task.receipt,null);
  await close(server);
});
