import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {create,handoff} from '../src/core.mjs';
import {seal} from '../src/transport.mjs';
import {saveSnapshot} from '../src/github-transport.mjs';
import {createRelayService,resolveBindHost} from '../src/service.mjs';
import {normalizeServiceUrl,serviceGet} from '../src/service-client.mjs';

function git(repo,...args){
  const r=spawnSync('git',['-C',repo,...args],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  return r.stdout.trim();
}
async function listen(server){
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const {port}=server.address();
  return 'http://127.0.0.1:'+port+'/';
}
async function close(server){await new Promise(resolve=>server.close(resolve));}

test('G7 loopback service exposes stable read/status API and survives restart',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'relay-g7-service-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const repo=path.join(root,'repo'),store=path.join(root,'store');fs.mkdirSync(repo);
  git(repo,'init','-q');git(repo,'config','user.name','G7');git(repo,'config','user.email','g7@example.invalid');
  fs.writeFileSync(path.join(repo,'calc.mjs'),'export function add(a,b){ return a-b; }\n');
  fs.writeFileSync(path.join(repo,'calc.test.mjs'),"import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {add} from './calc.mjs';\ntest('add',()=>assert.equal(add(2,3),5));\n");
  git(repo,'add','.');git(repo,'commit','-qm','baseline');
  create(store,{id:'R-G7-001',goal:'Synthetic service task',repo,actor:'local-agent',allowed:['calc.mjs'],testFile:'calc.test.mjs',constraints:['Only calc.mjs']});
  handoff(store,'R-G7-001');
  const authority={scope_change:'human_only',final_approval:'human'};
  const chat=seal({schema:'relay-lab/transport-v0',task_id:'R-G7-001',packet_id:'chat-001',seq:1,parent_packet_id:null,stage:'CHAT_INTENT',source_surface:'chat',target_surface:'work',authority,payload:{goal:'Synthetic service task'}});
  const work=seal({schema:'relay-lab/transport-v0',task_id:'R-G7-001',packet_id:'work-001',seq:2,parent_packet_id:'chat-001',stage:'WORK_CONTINUATION',source_surface:'work',target_surface:'codex',authority,payload:{goal:'Synthetic service task'}});
  saveSnapshot(store,{repo:'owner/repo',issue:1,packets:[chat,work]});

  const first=createRelayService({store}),base=await listen(first);
  assert.equal((await serviceGet('v1/health',{base})).status,'ok');
  const tasks=await serviceGet('v1/tasks',{base});
  assert.equal(tasks.tasks.length,1);
  const detail=await serviceGet('v1/tasks/R-G7-001',{base});
  assert.equal(detail.task_id,'R-G7-001');
  assert.equal(detail.current_surface,'codex');
  assert.equal(detail.transport_lineage.length,2);
  assert.equal(Object.hasOwn(detail,'repo'),false);
  const cp=await serviceGet('v1/tasks/R-G7-001/checkpoint',{base});
  assert.equal(cp.checkpoint.state,'HANDED_OFF');
  assert.equal(cp.checkpoint.environment_match,true);
  const post=await fetch(new URL('v1/health',base),{method:'POST'});
  assert.equal(post.status,405);
  assert.equal(post.headers.has('access-control-allow-origin'),false);
  await close(first);

  const second=createRelayService({store}),base2=await listen(second);
  const after=await serviceGet('v1/tasks/R-G7-001',{base:base2});
  assert.equal(after.task_id,'R-G7-001');
  assert.deepEqual(after.transport_lineage,detail.transport_lineage);
  await close(second);
});

test('service refuses remote bind and remote client URLs',()=>{
  assert.equal(resolveBindHost({}),'127.0.0.1');
  assert.throws(()=>resolveBindHost({RELAY_SERVICE_HOST:'0.0.0.0'}),/REMOTE_BIND_REFUSED/);
  assert.equal(normalizeServiceUrl('http://localhost:4318').hostname,'localhost');
  assert.throws(()=>normalizeServiceUrl('http://192.168.1.10:4318'),/REMOTE_SERVICE_REFUSED/);
  assert.throws(()=>normalizeServiceUrl('https://127.0.0.1:4318'),/SERVICE_HTTP_ONLY/);
});
