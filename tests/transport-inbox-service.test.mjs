import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {seal} from '../src/transport.mjs';
import {acceptInboxChain} from '../src/transport-inbox.mjs';
import {createRelayService} from '../src/service.mjs';
import {serviceGet} from '../src/service-client.mjs';

async function listen(server){await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});return 'http://127.0.0.1:'+server.address().port+'/';}
async function close(server){await new Promise(r=>server.close(r));}

test('G9 Service exposes validated transport inbox without creating a local task',async t=>{
  const store=fs.mkdtempSync(path.join(os.tmpdir(),'relay-g9-service-'));t.after(()=>fs.rmSync(store,{recursive:true,force:true}));
  const authority={scope_change:'human_only',final_approval:'human'};
  const chat=seal({schema:'relay-lab/transport-v0',task_id:'R-G9-SVC',packet_id:'chat-001',seq:1,parent_packet_id:null,stage:'CHAT_INTENT',source_surface:'chat',target_surface:'work',authority,payload:{goal:'Inbox only'}});
  acceptInboxChain(store,{repo:'owner/repo',issue:2,packets:[chat]});
  const server=createRelayService({store}),base=await listen(server);
  const list=await serviceGet('v1/transport-inbox',{base});assert.equal(list.items.length,1);
  const item=await serviceGet('v1/transport-inbox/R-G9-SVC',{base});assert.equal(item.task_id,'R-G9-SVC');assert.equal(item.transport_lineage.length,1);
  const tasks=await serviceGet('v1/tasks',{base});assert.equal(tasks.tasks.length,0);
  await close(server);
});
