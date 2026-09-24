import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {seal} from '../src/transport.mjs';
import {extractWorkDrafts,validateWorkDraft,sealWorkDraft,writePacketFile,publishPacketFile,saveSnapshot} from '../src/github-transport.mjs';

const chat=seal({schema:'relay-lab/transport-v0',task_id:'R-G5-001',packet_id:'chat-001',seq:1,parent_packet_id:null,stage:'CHAT_INTENT',source_surface:'chat',target_surface:'work',authority:{scope_change:'human_only',final_approval:'human'},payload:{goal:'Fix synthetic addition',allowed_paths:['calc.mjs'],test_file:'calc.test.mjs',constraints:['Only calc.mjs','No network']}});
const draft={schema:'relay-lab/work-draft-v0',task_id:'R-G5-001',parent_packet_id:'chat-001',source_surface:'work',target_surface:'codex',decision:'CONTINUE_AS_SCOPED',payload:{goal:'Fix synthetic addition',allowed_paths:['calc.mjs'],test_file:'calc.test.mjs',constraints:['Only calc.mjs','No network'],notes:'Plan confirmed.'}};

test('Work draft seals deterministically without scope drift',()=>{
  assert.equal(validateWorkDraft(chat,draft),draft);
  const p=sealWorkDraft(chat,draft);
  assert.equal(p.task_id,'R-G5-001');assert.equal(p.seq,2);assert.equal(p.parent_packet_id,'chat-001');assert.equal(p.stage,'WORK_CONTINUATION');
});

test('Work draft rejects changed scope parent task and secret-like content',()=>{
  assert.throws(()=>validateWorkDraft(chat,{...draft,task_id:'R-OTHER'}),/TASK_MISMATCH/);
  assert.throws(()=>validateWorkDraft(chat,{...draft,parent_packet_id:'wrong'}),/PARENT_MISMATCH/);
  assert.throws(()=>validateWorkDraft(chat,{...draft,payload:{...draft.payload,allowed_paths:['calc.mjs','other.mjs']}}),/PATHS_CHANGED/);
  assert.throws(()=>validateWorkDraft(chat,{...draft,payload:{...draft.payload,notes:'Bearer abc.def.ghi'}}),/SECRET_LIKE_VALUE/);
});

test('publisher is dry-run by default and snapshot preserves lineage',t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'relay-github-transport-'));t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  const work=sealWorkDraft(chat,draft);
  const file=writePacketFile(work,path.join(tmp,'packet.md'));
  const pub=publishPacketFile({repo:'owner/repo',issue:1,file});
  assert.equal(pub.dry_run,true);assert.equal(pub.published,false);assert.equal(pub.packet_id,'work-001');
  const snap=saveSnapshot(path.join(tmp,'store'),{repo:'owner/repo',issue:1,packets:[chat,work]});
  const data=JSON.parse(fs.readFileSync(snap,'utf8'));assert.equal(data.task_id,'R-G5-001');assert.equal(data.packets.length,2);assert.equal(data.packets[1].parent_packet_id,'chat-001');
});


test('instructional Issue-body Work draft example is distinguishable from a real comment draft',()=>{
  const marker='<!-- relay-work-draft-v0 -->\n```json\n'+JSON.stringify(draft)+'\n```';
  assert.equal(extractWorkDrafts(marker).length,1);
  // fetchIssueBundle intentionally applies extractWorkDrafts only to comments, not the Issue body.
  // This regression test protects the marker parser while the source-selection rule lives in fetchIssueBundle.
});
