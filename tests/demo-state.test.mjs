import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildDemoReport,currentSurface,recordMetric,recoveryFor,reportMarkdown,requiredHumanAction} from '../src/demo-state.mjs';

const snapshot={packets:[
  {task_id:'R-G6-001',seq:1,packet_id:'chat-001',parent_packet_id:null,stage:'CHAT_INTENT',source_surface:'chat',target_surface:'work'},
  {task_id:'R-G6-001',seq:2,packet_id:'work-001',parent_packet_id:'chat-001',stage:'WORK_CONTINUATION',source_surface:'work',target_surface:'codex'}
]};

test('demo state exposes current surface and exact next human gate',()=>{
  const task={state:'HANDED_OFF',next_action:'Executor works'};
  assert.equal(currentSurface(task,snapshot),'codex');
  assert.match(requiredHumanAction(task,snapshot),/local coding Agent/);
  const review={state:'VERIFIED_PENDING_DECISION'};
  assert.equal(currentSurface(review,snapshot),'human-review');
  assert.match(requiredHumanAction(review,snapshot),/APPROVE or REJECT/);
});

test('known G5 failures map to fail-closed recovery instructions',()=>{
  assert.equal(recoveryFor('Error: GITHUB_READ_403').code,'GITHUB_READ_403');
  assert.equal(recoveryFor('EXACTLY_ONE_MATCHING_WORK_DRAFT_REQUIRED: observed=0').code,'WORK_DRAFT_NOT_VISIBLE');
  assert.equal(recoveryFor('EXACTLY_ONE_MATCHING_WORK_DRAFT_REQUIRED: observed=2').code,'DUPLICATE_WORK_DRAFT');
  assert.equal(recoveryFor('PARENT_PACKET_MISMATCH').code,'PARENT_MISMATCH');
  assert.equal(recoveryFor('PRIVATE_PATH_IN_TRANSPORT').code,'PUBLIC_SAFETY_BLOCK');
});

test('demo metrics count real unified commands and sanitized report omits local paths',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'relay-g6-metrics-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  recordMetric(root,{kind:'DEMO_COMMAND',command:'prepare'});
  recordMetric(root,{kind:'DEMO_COMMAND',command:'finish'});
  recordMetric(root,{kind:'DEMO_COMMAND',command:'approve',decision:'APPROVE'});
  const metrics=JSON.parse(fs.readFileSync(path.join(root,'demo-metrics.json'),'utf8'));
  const task={
    id:'R-G6-001',goal:'Synthetic',state:'COMPLETED',owner:'human',allowed_paths:['calc.mjs'],constraints:['No network'],
    review:{status:'INDEPENDENT_CHECKS_PASS'},receipts:[{receipt_id:'g6-R-G6-001',head_commit:'abc123'}],
    events:[{kind:'HUMAN_DECISION',detail:{decision:'APPROVE'}}],repo:'/tmp/private/demo-repo'
  };
  const report=buildDemoReport(task,snapshot,metrics);
  assert.equal(report.measured_actions.demo_cli_commands,3);
  assert.equal(report.measured_actions.manual_json_copy_actions,0);
  assert.equal(report.transport.canonical_task_preserved,true);
  const md=reportMarkdown(report);
  assert.doesNotMatch(md,/\/tmp\/private/);
  assert.doesNotMatch(JSON.stringify(report),/\/tmp\/private/);
});
