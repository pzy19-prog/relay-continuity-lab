#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {syncGithubIssueToInbox} from '../src/transport-inbox.mjs';
import {list} from '../src/core.mjs';

const args=process.argv.slice(2);
const opt=(name,fallback)=>{const i=args.indexOf(name);return i>=0?args[i+1]:fallback;};
const sourceRepo=opt('--source-repo','pzy19-prog/relay-continuity-lab');
const issue=Number(opt('--issue','13'));
if(!Number.isInteger(issue)||issue<1)throw new Error('ISSUE_REQUIRED');

const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pilot=process.env.RELAY_G10_PILOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'relay-g10-pilot-'));
const repo=path.join(pilot,'demo-repo'),store=path.join(pilot,'relay-store');
fs.mkdirSync(repo,{recursive:true});fs.mkdirSync(store,{recursive:true,mode:0o700});

function run(cmd,args,cwd=repo){
  const r=spawnSync(cmd,args,{cwd,encoding:'utf8',timeout:30000});
  if(r.status!==0)throw new Error(r.stderr||r.stdout);
  return r.stdout.trim();
}
for(const n of ['calc.mjs','calc.test.mjs'])fs.copyFileSync(path.join(source,'benchmark/fixture',n),path.join(repo,n));
run('git',['init','-q']);run('git',['config','user.name','G10 Fixture']);run('git',['config','user.email','g10@example.invalid']);
run('git',['add','.']);run('git',['commit','-qm','fixture: g10 explicit binding baseline']);

const synced=syncGithubIssueToInbox(store,{repo:sourceRepo,issue});
if(list(store).length!==0)throw new Error('LOCAL_TASK_EXISTED_BEFORE_BIND');
const record=synced.record,last=record.last_accepted;
const data={schema:'relay-lab/g10-pilot-v0',pilot_dir:pilot,store,repo,source_repo:sourceRepo,issue,task_id:record.task_id,expected_packet:last.packet_id,expected_hash:last.content_sha256};
fs.writeFileSync(path.join(pilot,'pilot.json'),JSON.stringify(data,null,2)+'\n',{mode:0o600});

console.log(JSON.stringify({
  ...data,
  transport_inbox_status:record.status,
  packet_count:record.packets.length,
  local_task_count_before_bind:0,
  bind_command:'npm run bind -- --store '+store+' --task '+record.task_id+' --repo '+repo+' --expected-packet '+last.packet_id+' --expected-hash '+last.content_sha256,
  service_command:'RELAY_STORE='+store+' npm run service',
  ui_command:'RELAY_SERVICE_URL=http://127.0.0.1:4318 npm run ui',
  expected:'Before bind: Transport Inbox 1 / Task Inbox 0. After explicit bind: exactly one CREATED local task with immutable transport provenance; no execution.'
},null,2));
