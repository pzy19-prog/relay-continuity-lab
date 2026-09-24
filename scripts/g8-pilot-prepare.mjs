#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {create,handoff} from '../src/core.mjs';
import {seal} from '../src/transport.mjs';
import {saveSnapshot} from '../src/github-transport.mjs';

const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const home=process.env.RELAY_G8_PILOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'relay-g8-pilot-'));
const repo=path.join(home,'demo-repo'),store=path.join(home,'relay-store');
const taskId='R-G8-SERVICE-ADAPTER-001';
fs.mkdirSync(repo,{recursive:true});

function run(cmd,args,cwd=repo){
  const r=spawnSync(cmd,args,{cwd,encoding:'utf8',timeout:30000});
  if(r.status!==0)throw new Error(r.stderr||r.stdout);
  return r.stdout.trim();
}
for(const n of ['calc.mjs','calc.test.mjs'])fs.copyFileSync(path.join(source,'benchmark/fixture',n),path.join(repo,n));
const install=JSON.parse(run(process.execPath,[path.join(source,'scripts/install-skill.mjs'),'--scope','project','--host','cursor','--project-dir',repo]));
fs.writeFileSync(path.join(repo,'AGENT_TASK.md'),[
  '# G8 service-backed inspection',
  '',
  'Canonical task: '+taskId,
  '',
  'Read-only inspection only. Do not edit files, do not create commits, do not use --store, and do not read Relay JSON files.',
  '',
  'Use the installed project Skill through the local Relay Service:',
  '',
  'node .agents/skills/relay-lab/scripts/relay.mjs service-health',
  'node .agents/skills/relay-lab/scripts/relay.mjs service-show '+taskId,
  'node .agents/skills/relay-lab/scripts/relay.mjs service-checkpoint '+taskId,
  '',
  'Report task_id, state, owner, current_surface, required_human_action, environment_match, worktree_clean, and transport lineage.',
  ''
].join('\n'));
run('git',['init','-q']);run('git',['config','user.name','G8 Fixture']);run('git',['config','user.email','g8@example.invalid']);
run('git',['add','.']);run('git',['commit','-qm','fixture: g8 service-backed adapter baseline']);
const task=create(store,{id:taskId,goal:'Inspect Relay continuity through the local Service Contract without direct store access.',repo,actor:'local-agent',allowed:['calc.mjs'],testFile:'calc.test.mjs',constraints:['Read-only inspection','Do not modify files','Do not use --store','Do not read Relay JSON files']});
handoff(store,task.id);
const authority={scope_change:'human_only',final_approval:'human'};
const chat=seal({schema:'relay-lab/transport-v0',task_id:taskId,packet_id:'chat-001',seq:1,parent_packet_id:null,stage:'CHAT_INTENT',source_surface:'chat',target_surface:'work',authority,payload:{goal:task.goal}});
const work=seal({schema:'relay-lab/transport-v0',task_id:taskId,packet_id:'work-001',seq:2,parent_packet_id:'chat-001',stage:'WORK_CONTINUATION',source_surface:'work',target_surface:'codex',authority,payload:{goal:task.goal}});
const snap=saveSnapshot(store,{repo:'synthetic/g8-local',issue:0,packets:[chat,work]});
fs.writeFileSync(path.join(home,'pilot.json'),JSON.stringify({schema:'relay-lab/g8-pilot-v0',pilot_dir:home,repo,store,task_id:taskId,skill_entry:install.entry,transport_snapshot:snap},null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({
  pilot_dir:home,
  repo,
  store,
  task_id:taskId,
  skill_entry:install.entry,
  project_binding_present:fs.existsSync(path.join(repo,'.relay-lab.json')),
  service_command:'cd '+source+' && RELAY_STORE='+store+' npm run service',
  ui_command:'cd '+source+' && RELAY_SERVICE_URL=http://127.0.0.1:4318 npm run ui',
  ui_url:'http://127.0.0.1:4317/?task='+taskId,
  agent_task:path.join(repo,'AGENT_TASK.md'),
  expected:'UI and local Agent inspect the same task through service-v1; no direct JSON/store binding is required by either adapter.'
},null,2));
