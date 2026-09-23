import test from 'node:test';
import assert from 'node:assert/strict';
import {seal,validateChain,renderPacket,extractPackets} from '../src/transport.mjs';

const base={schema:'relay-lab/transport-v0',task_id:'R-G4-CHATWORK-CODEX-001',authority:{scope_change:'human_only',final_approval:'human'}};

test('transport chain preserves task identity and explicit lineage',()=>{
  const a=seal({...base,packet_id:'chat-001',seq:1,parent_packet_id:null,stage:'CHAT_INTENT',source_surface:'chat',target_surface:'work',payload:{goal:'Fix synthetic addition',constraints:['Only calc.mjs']}});
  const b=seal({...base,packet_id:'work-001',seq:2,parent_packet_id:'chat-001',stage:'WORK_CONTINUATION',source_surface:'work',target_surface:'codex',payload:{goal:'Fix synthetic addition',allowed_paths:['calc.mjs'],test_file:'calc.test.mjs',constraints:['Only calc.mjs']}});
  assert.equal(validateChain([b,a]).at(-1).packet_id,'work-001');
  assert.deepEqual(extractPackets(renderPacket(a))[0],a);
});

test('transport rejects task switch, wrong parent and private paths',()=>{
  const a=seal({...base,packet_id:'chat-001',seq:1,parent_packet_id:null,stage:'CHAT_INTENT',source_surface:'chat',target_surface:'work',payload:{goal:'x'}});
  const b=seal({...base,packet_id:'work-001',seq:2,parent_packet_id:'chat-001',stage:'WORK_CONTINUATION',source_surface:'work',target_surface:'codex',payload:{goal:'x'}});
  assert.throws(()=>validateChain([a,{...b,task_id:'R-OTHER'}]),/PACKET_HASH_INVALID|TASK_ID_CHANGED/);
  assert.throws(()=>validateChain([a,{...b,parent_packet_id:'wrong'}]),/PACKET_HASH_INVALID|PARENT_PACKET_MISMATCH/);
  assert.throws(()=>seal({...base,packet_id:'x',seq:1,parent_packet_id:null,stage:'CHAT_INTENT',source_surface:'chat',target_surface:'work',payload:{note:'/home/user/private'}}),/PRIVATE_PATH_IN_TRANSPORT/);
});

test('explicit canonical task id can be carried without local paths',()=>{
  const a=seal({...base,packet_id:'chat-001',seq:1,parent_packet_id:null,stage:'CHAT_INTENT',source_surface:'chat',target_surface:'work',payload:{goal:'Fix synthetic addition',allowed_paths:['calc.mjs'],test_file:'calc.test.mjs',constraints:['No network']}});
  assert.equal(a.task_id,'R-G4-CHATWORK-CODEX-001');
  assert.match(a.content_sha256,/^[a-f0-9]{64}$/);
});
