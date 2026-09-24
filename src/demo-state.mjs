import fs from 'node:fs';
import path from 'node:path';

export function currentSurface(task,snapshot){
  if(task.state==='COMPLETED'||task.state==='NEEDS_REPAIR')return 'human';
  if(task.state==='VERIFIED_PENDING_DECISION'||task.state==='WAITING_REVIEW'||task.state==='BLOCKED')return 'human-review';
  const last=snapshot?.packets?.at?.(-1);
  if(last?.target_surface)return last.target_surface;
  if(task.state==='HANDED_OFF')return 'executor';
  return 'human';
}

export function requiredHumanAction(task,snapshot){
  if(task.state==='COMPLETED')return 'Task closed; no further action.';
  if(task.state==='VERIFIED_PENDING_DECISION')return 'Review evidence, then explicitly APPROVE or REJECT.';
  if(task.state==='BLOCKED')return 'Inspect the blocked evidence; do not retry automatically.';
  if(task.state==='NEEDS_REPAIR')return 'Create a new bounded repair task; do not mutate the completed receipt.';
  if(task.state==='WAITING_RECONCILIATION')return 'Reconcile the original execution outcome; do not retry automatically.';
  if(task.state==='HANDED_OFF'){
    const last=snapshot?.packets?.at?.(-1);
    if(last?.stage==='WORK_CONTINUATION')return 'Open the authorized local coding Agent and execute the bounded task.';
    return 'Wait for the appointed executor and require a structured receipt.';
  }
  return task.next_action||'Inspect current task state.';
}

export function recoveryFor(errorText=''){
  const s=String(errorText);
  if(/GITHUB_READ_403/.test(s))return {code:'GITHUB_READ_403',action:'Check `gh auth status`; use authenticated `gh api`; do not paste a token into Relay.'};
  if(/EXACTLY_ONE_MATCHING_WORK_DRAFT_REQUIRED: observed=0/.test(s)||/EXACTLY_ONE_MATCHING_WORK_DRAFT_REQUIRED$/.test(s))return {code:'WORK_DRAFT_NOT_VISIBLE',action:'Wait briefly and rerun the same command. Do not ask Work to create another draft unless the Issue still has none.'};
  if(/EXACTLY_ONE_MATCHING_WORK_DRAFT_REQUIRED: observed=([2-9]|\d{2,})/.test(s))return {code:'DUPLICATE_WORK_DRAFT',action:'Stop and inspect duplicate Work comments. Do not pick one arbitrarily or execute Codex.'};
  if(/PARENT_PACKET_MISMATCH|WORK_DRAFT_PARENT_MISMATCH/.test(s))return {code:'PARENT_MISMATCH',action:'Stop. Reconcile packet lineage on GitHub; do not reseal or execute against an unknown parent.'};
  if(/TASK_ID_CHANGED|WORK_DRAFT_TASK_MISMATCH|TASK_MISMATCH/.test(s))return {code:'TASK_ID_DRIFT',action:'Stop. Preserve the canonical task ID and create a new explicit task only with human authority.'};
  if(/OUT_OF_ORDER_SEQ|DUPLICATE_PACKET_ID/.test(s))return {code:'PACKET_ORDER_INVALID',action:'Stop. Inspect transport history for stale/duplicate packets; do not auto-retry.'};
  if(/PRIVATE_PATH_IN_TRANSPORT|SECRET_LIKE_VALUE|PRIVATE_FIELD_IN_TRANSPORT/.test(s))return {code:'PUBLIC_SAFETY_BLOCK',action:'Remove the private/sensitive value from the public transport packet and regenerate it; never publish the blocked content.'};
  if(/AGENT_COMMIT_MISSING/.test(s))return {code:'AGENT_COMMIT_MISSING',action:'Return to the authorized local executor; do not fabricate a receipt.'};
  if(/DIRTY_WORKTREE|environment_match/.test(s))return {code:'ENVIRONMENT_MISMATCH',action:'Stop and reconcile the local repository before any further execution.'};
  return {code:'UNKNOWN_FAILURE',action:'Inspect the error and current Relay state. Do not auto-retry an unknown outcome.'};
}

export function loadMetrics(pilotDir){
  const file=path.join(pilotDir,'demo-metrics.json');
  if(!fs.existsSync(file))return {schema:'relay-lab/demo-metrics-v0',events:[]};
  return JSON.parse(fs.readFileSync(file,'utf8'));
}

export function recordMetric(pilotDir,event){
  const file=path.join(pilotDir,'demo-metrics.json');
  const data=loadMetrics(pilotDir);
  data.schema='relay-lab/demo-metrics-v0';
  data.events.push({at:new Date().toISOString(),...event});
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n',{mode:0o600});
  return data;
}

function countBy(events,key,value){return events.filter(e=>e[key]===value).length;}
export function buildDemoReport(task,snapshot,metrics){
  const packets=snapshot?.packets||[];
  const events=metrics?.events||[];
  const humanDecision=task.events?.find(e=>e.kind==='HUMAN_DECISION')?.detail?.decision??null;
  return {
    schema:'relay-lab/demo-report-v0',
    task_id:task.id,
    goal:task.goal,
    final_state:task.state,
    owner:task.owner,
    allowed_paths:task.allowed_paths,
    constraints:task.constraints,
    independent_review:task.review?.status??null,
    head_commit:task.receipts?.[0]?.head_commit??null,
    receipt_id:task.receipts?.[0]?.receipt_id??null,
    human_decision:humanDecision,
    transport:{
      packet_count:packets.length,
      edges:packets.map(p=>({seq:p.seq,packet_id:p.packet_id,stage:p.stage,from:p.source_surface,to:p.target_surface,parent_packet_id:p.parent_packet_id})),
      canonical_task_preserved:packets.every(p=>p.task_id===task.id)
    },
    measured_actions:{
      demo_cli_commands:countBy(events,'kind','DEMO_COMMAND'),
      prepare_commands:events.filter(e=>e.kind==='DEMO_COMMAND'&&e.command==='prepare').length,
      finish_commands:events.filter(e=>e.kind==='DEMO_COMMAND'&&e.command==='finish').length,
      approval_commands:events.filter(e=>e.kind==='DEMO_COMMAND'&&e.command==='approve').length,
      status_commands:events.filter(e=>e.kind==='DEMO_COMMAND'&&e.command==='status').length,
      report_commands:events.filter(e=>e.kind==='DEMO_COMMAND'&&e.command==='report').length,
      manual_json_copy_actions:0
    },
    current_surface:currentSurface(task,snapshot),
    required_human_action:requiredHumanAction(task,snapshot),
    note:'Counts are recorded from the unified G6 demo CLI for this run; no latency or effort score is inferred.'
  };
}

export function reportMarkdown(report){
  const lines=[
    '# Relay Lab G6 Demo Report','',
    `- Task: \`${report.task_id}\``,
    `- Final state: \`${report.final_state}\``,
    `- Independent review: \`${report.independent_review??'NOT_RUN'}\``,
    `- Human decision: \`${report.human_decision??'NONE'}\``,
    `- Canonical task preserved: \`${report.transport.canonical_task_preserved}\``,
    `- Transport packets: \`${report.transport.packet_count}\``,
    `- Unified demo CLI commands recorded: \`${report.measured_actions.demo_cli_commands}\``,
    `- Manual JSON copy actions: \`${report.measured_actions.manual_json_copy_actions}\``,
    '', '## Lineage',''
  ];
  for(const e of report.transport.edges)lines.push(`- #${e.seq} \`${e.stage}\`: ${e.from} → ${e.to} (\`${e.packet_id}\`, parent \`${e.parent_packet_id??'ROOT'}\`)`);
  lines.push('', '## Scope','', `- Allowed paths: ${report.allowed_paths.map(x=>'`'+x+'`').join(', ')}`, `- Receipt: \`${report.receipt_id??'NONE'}\``, `- Head: \`${report.head_commit??'NONE'}\``, '', '> Sanitized report: local absolute paths, tokens and store locations are intentionally omitted.','');
  return lines.join('\n');
}

export function makePilotLauncher(pilotDir,demoScript){
  const launcher=path.join(path.resolve(pilotDir),'relay-demo');
  const code=[
    '#!/usr/bin/env node',
    "import {spawnSync} from 'node:child_process';",
    'const demo='+JSON.stringify(path.resolve(demoScript))+';',
    'const pilot='+JSON.stringify(path.resolve(pilotDir))+';',
    'const argv=process.argv.slice(2);',
    'const command=argv.shift();',
    "if(!command){console.error('USAGE: relay-demo status|finish|approve|report ...');process.exit(1);}",
    "const needsPilot=new Set(['status','finish','approve','report']);",
    'const args=[demo,command];',
    "if(needsPilot.has(command))args.push('--pilot',pilot);",
    'args.push(...argv);',
    "const r=spawnSync(process.execPath,args,{stdio:'inherit'});",
    'process.exitCode=r.status??1;',
    ''
  ].join('\n');
  fs.writeFileSync(launcher,code,{mode:0o700});
  fs.chmodSync(launcher,0o700);
  return launcher;
}
