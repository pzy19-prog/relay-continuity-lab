import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-synthetic-'));
const repo = path.join(dir, 'demo');
fs.mkdirSync(repo);
const run = (cmd, args, cwd=repo) => {
  const out = spawnSync(cmd, args, {cwd, encoding:'utf8', timeout:15_000});
  if (out.error) throw out.error;
  return out;
};
const must = (cmd,args) => { const r=run(cmd,args); if(r.status!==0)throw new Error(`${cmd} ${args.join(' ')} failed: ${r.stderr}`); return r.stdout.trim(); };
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,file))).digest('hex');
const seen = new Map();
let total = 0;
function testCase(name, actual, expected) {
  assert.equal(actual, expected, `${name} expected ${expected}, got ${actual}`);
  total++;
  console.log(`OK  ${name}: ${actual}`);
}
function verify(task, receipt) {
  const canonical=JSON.stringify(receipt);
  if(seen.has(receipt.receipt_id))return seen.get(receipt.receipt_id)===canonical?'IDEMPOTENT/SAME_RECEIPT':'BLOCKED/CONFLICTING_RECEIPT';
  if (receipt.status === 'UNKNOWN') return 'WAITING_REVIEW/UNKNOWN_OUTCOME';
  if (receipt.task_id !== task.task_id) return 'BLOCKED/TASK_MISMATCH';
  if (receipt.actor !== task.authorized_actor) return 'BLOCKED/ACTOR_MISMATCH';
  if (receipt.base_commit !== task.source_commit) return 'BLOCKED/STALE_BASE';
  if (receipt.status !== 'PASS') return 'WAITING_REVIEW/NOT_PASS';
  if (!Array.isArray(receipt.evidence) || !receipt.evidence.length) return 'BLOCKED/MISSING_EVIDENCE';
  const current = must('git',['rev-parse','HEAD']);
  if (current !== receipt.head_commit) return 'BLOCKED/HEAD_MISMATCH';
  const changed = must('git',['diff','--name-only',task.source_commit,current]).split('\n').filter(Boolean);
  if (changed.some(file=>!task.allowed_paths.includes(file))) return 'BLOCKED/OUT_OF_SCOPE';
  for(const file of changed) {
    const proof=receipt.evidence.find(item=>item.path===file && item.kind==='file_hash');
    if(!proof || proof.sha256!==sha(file))return 'BLOCKED/INVALID_FILE_EVIDENCE';
  }
  const tests = run(process.execPath,['--test','calc.test.mjs']);
  if(tests.status!==0)return 'BLOCKED/INDEPENDENT_TEST_FAILED';
  seen.set(receipt.receipt_id,canonical);
  return 'VERIFIED/PASS';
}
try {
  for(const name of ['calc.mjs','calc.test.mjs'])fs.copyFileSync(path.join(here,'fixture',name),path.join(repo,name));
  must('git',['init','-q']);must('git',['config','user.name','Synthetic Demo']);must('git',['config','user.email','demo@example.invalid']);
  must('git',['add','.']);must('git',['commit','-qm','demo: intentionally failing baseline']);
  const base=must('git',['rev-parse','HEAD']);
  const red=run(process.execPath,['--test','calc.test.mjs']);
  testCase('C01 initial test is genuinely failing',red.status===0?'PASS':'FAIL','FAIL');
  const calc=path.join(repo,'calc.mjs');
  fs.writeFileSync(calc,fs.readFileSync(calc,'utf8').replace('a - b','a + b'));
  must('git',['add','calc.mjs']);must('git',['commit','-qm','demo: fix addition']);
  const head=must('git',['rev-parse','HEAD']);
  const task={task_id:'demo-task-001',source_commit:base,allowed_paths:['calc.mjs'],authorized_actor:'local-executor'};
  const receipt={receipt_id:'demo-receipt-001',task_id:task.task_id,status:'PASS',actor:'local-executor',base_commit:base,head_commit:head,evidence:[{kind:'file_hash',path:'calc.mjs',sha256:sha('calc.mjs')}]};
  testCase('C02 independently verified fix',verify(task,receipt),'VERIFIED/PASS');
  testCase('C03 claimed PASS without evidence',verify(task,{...receipt,receipt_id:'demo-002',evidence:[]}), 'BLOCKED/MISSING_EVIDENCE');
  testCase('C04 stale base',verify(task,{...receipt,receipt_id:'demo-003',base_commit:'0'.repeat(40)}),'BLOCKED/STALE_BASE');
  testCase('C05 wrong actor',verify(task,{...receipt,receipt_id:'demo-004',actor:'unassigned-agent'}),'BLOCKED/ACTOR_MISMATCH');
  testCase('C06 same receipt id is idempotent',verify(task,receipt),'IDEMPOTENT/SAME_RECEIPT');
  testCase('C06 conflicting reused receipt id fails',verify(task,{...receipt,evidence:[{...receipt.evidence[0],sha256:'0'.repeat(64)}]}),'BLOCKED/CONFLICTING_RECEIPT');
  testCase('C07 unknown outcome does not auto retry',verify(task,{...receipt,receipt_id:'demo-007',status:'UNKNOWN'}),'WAITING_REVIEW/UNKNOWN_OUTCOME');
  fs.writeFileSync(path.join(repo,'unapproved.txt'),'not allowed\n');
  must('git',['add','unapproved.txt']);must('git',['commit','-qm','demo: unapproved side effect']);
  const badHead=must('git',['rev-parse','HEAD']);
  testCase('C08 out-of-scope edit',verify(task,{...receipt,receipt_id:'demo-008',head_commit:badHead}),'BLOCKED/OUT_OF_SCOPE');
  const pending={task_id:task.task_id,state:'WAITING_DECISION',current_owner:'human-reviewer',next_action:'inspect evidence'};
  fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify(pending));
  testCase('C09 persisted pending decision',JSON.parse(fs.readFileSync(path.join(dir,'state.json'))).state,'WAITING_DECISION');
  console.log(`\n${total} isolated assertions passed. This is NOT a finished Relay product or a competitor test.`);
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
