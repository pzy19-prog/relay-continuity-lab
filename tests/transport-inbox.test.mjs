import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {seal} from '../src/transport.mjs';
import {buildValidatedInboxChain,acceptInboxChain,readTransportInbox} from '../src/transport-inbox.mjs';

const authority={scope_change:'human_only',final_approval:'human'};
const chat=seal({schema:'relay-lab/transport-v0',task_id:'R-G9-001',packet_id:'chat-001',seq:1,parent_packet_id:null,stage:'CHAT_INTENT',source_surface:'chat',target_surface:'work',authority,payload:{goal:'Inspect cloud transport',allowed_paths:['calc.mjs'],test_file:'calc.test.mjs',constraints:['No execution']}});
const draft={schema:'relay-lab/work-draft-v0',task_id:'R-G9-001',parent_packet_id:'chat-001',source_surface:'work',target_surface:'codex',decision:'CONTINUE_AS_SCOPED',payload:{goal:'Inspect cloud transport',allowed_paths:['calc.mjs'],test_file:'calc.test.mjs',constraints:['No execution'],notes:'Bounded continuation confirmed.'}};

test('G9 inbox seals one Work draft, accepts once, and is idempotent',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'relay-g9-inbox-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const chain=buildValidatedInboxChain({packets:[chat],drafts:[draft]});
  assert.equal(chain.length,2);assert.equal(chain[1].stage,'WORK_CONTINUATION');
  const first=acceptInboxChain(root,{repo:'owner/repo',issue:1,packets:chain});
  assert.equal(first.status,'ACCEPTED');assert.equal(first.changed,true);
  const second=acceptInboxChain(root,{repo:'owner/repo',issue:1,packets:chain});
  assert.equal(second.status,'IDEMPOTENT');assert.equal(second.changed,false);
  const items=readTransportInbox(root);assert.equal(items.length,1);assert.equal(items[0].last_accepted.packet_id,'work-001');
});

test('G9 inbox blocks ambiguous drafts, bad hash, task drift and wrong parent',()=>{
  assert.throws(()=>buildValidatedInboxChain({packets:[chat],drafts:[draft,draft]}),/DUPLICATE_WORK_DRAFT/);
  assert.throws(()=>buildValidatedInboxChain({packets:[{...chat,content_sha256:'0'.repeat(64)}],drafts:[]}),/PACKET_HASH_INVALID/);
  const other=seal({...chat,task_id:'R-G9-OTHER',packet_id:'other-root'});
  assert.throws(()=>buildValidatedInboxChain({packets:[chat,other],drafts:[]}),/AMBIGUOUS_MULTIPLE_TASKS/);
  const wrong=seal({schema:'relay-lab/transport-v0',task_id:'R-G9-001',packet_id:'work-x',seq:2,parent_packet_id:'wrong',stage:'WORK_CONTINUATION',source_surface:'work',target_surface:'codex',authority,payload:{goal:'Inspect cloud transport'}});
  assert.throws(()=>buildValidatedInboxChain({packets:[chat,wrong],drafts:[]}),/PARENT_PACKET_MISMATCH/);
});
