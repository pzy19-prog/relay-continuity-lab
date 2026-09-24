import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {create,handoff} from '../src/core.mjs';
import {seal} from '../src/transport.mjs';
import {saveSnapshot} from '../src/github-transport.mjs';
import {createRelayService} from '../src/service.mjs';
import {loadUiTask,loadUiTasks,uiDataMode} from '../src/ui-data.mjs';

function git(repo,...args){
  const r=spawnSync('git',['-C',repo,...args],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);return r.stdout.trim();
}
async function listen(server){
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return 'http://127.0.0.1:'+server.address().port+'/';
}
async function close(server){await new Promise(resolve=>server.close(resolve));}

test('G8 UI data adapter renders task/lineage/events through service without direct store access',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'relay-g8-ui-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const repo=path.join(root,'repo'),store=path.join(root,'store');fs.mkdirSync(repo);
  git(repo,'init','-q');git(repo,'config','user.name','G8');git(repo,'config','user.email','g8@example.invalid');
  fs.writeFileSync(path.join(repo,'calc.mjs'),'export function add(a,b){return a-b;}\n');
  fs.writeFileSync(path.join(repo,'calc.test.mjs'),"import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {add} from './calc.mjs';\ntest('add',()=>assert.equal(add(2,3),5));\n");
  git(repo,'add','.');git(repo,'commit','-qm','baseline');
  const task=create(store,{id:'R-G8-UI',goal:'Inspect via service',repo,actor:'local-agent',allowed:['calc.mjs'],testFile:'calc.test.mjs',constraints:['Read only']});
  handoff(store,task.id);
  const authority={scope_change:'human_only',final_approval:'human'};
  const chat=seal({schema:'relay-lab/transport-v0',task_id:task.id,packet_id:'chat-001',seq:1,parent_packet_id:null,stage:'CHAT_INTENT',source_surface:'chat',target_surface:'work',authority,payload:{goal:task.goal}});
  const work=seal({schema:'relay-lab/transport-v0',task_id:task.id,packet_id:'work-001',seq:2,parent_packet_id:'chat-001',stage:'WORK_CONTINUATION',source_surface:'work',target_surface:'codex',authority,payload:{goal:task.goal}});
  saveSnapshot(store,{repo:'synthetic/g8',issue:0,packets:[chat,work]});
  const server=createRelayService({store}),base=await listen(server);
  assert.equal(uiDataMode({RELAY_SERVICE_URL:base}),'service-v1');
  const tasks=await loadUiTasks({store:path.join(root,'does-not-exist'),serviceUrl:base});
  assert.equal(tasks.length,1);assert.equal(tasks[0].data_source,'service-v1');
  const detail=await loadUiTask(task.id,{store:path.join(root,'does-not-exist'),serviceUrl:base});
  assert.equal(detail.id,task.id);assert.equal(detail.current_surface,'codex');
  assert.equal(detail.transport_lineage.length,2);assert.equal(detail.events.length,2);
  assert.equal(detail.data_source,'service-v1');
  await close(server);
});
