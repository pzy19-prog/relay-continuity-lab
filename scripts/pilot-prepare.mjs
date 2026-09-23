// Prepare one synthetic, explicitly manual handoff to a REAL local coding agent.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {create,handoff} from '../src/core.mjs';
const home=process.env.RELAY_PILOT_DIR || fs.mkdtempSync(path.join(os.tmpdir(),'relay-real-agent-pilot-'));
if(fs.existsSync(path.join(home,'pilot.json')))throw new Error('PILOT_EXISTS; refuse to overwrite');
const repo=path.join(home,'demo-repo'),store=path.join(home,'relay-store');
fs.mkdirSync(repo,{recursive:true});
const run=(...args)=>{const o=spawnSync('git',['-C',repo,...args],{encoding:'utf8'});if(o.status!==0)throw new Error(o.stderr);return o.stdout.trim();};
for(const x of ['calc.mjs','calc.test.mjs'])fs.copyFileSync(new URL('../benchmark/fixture/'+x,import.meta.url),path.join(repo,x));
run('init','-q');run('config','user.name','Pilot Fixture');run('config','user.email','pilot@example.invalid');run('add','.');run('commit','-qm','Synthetic failing baseline');
const task=create(store,{goal:'Fix the addition bug in calc.mjs while preserving the committed independent test',repo,actor:'local-agent',allowed:['calc.mjs'],testFile:'calc.test.mjs',constraints:['Change only calc.mjs','Commit changes','Do not copy private projects or secrets','Do not change tests','No push or network calls required']});
const packet=handoff(store,task.id);
fs.writeFileSync(path.join(home,'handoff.json'),JSON.stringify(packet,null,2)+'\n',{mode:0o600});
fs.writeFileSync(path.join(home,'pilot.json'),JSON.stringify({task_id:task.id,repo,store,actor:task.actor},null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({pilot_dir:home,repo,task_id:task.id,handoff_file:path.join(home,'handoff.json'),instructions:'Open the isolated repo ONLY in your authorized local Agent. Give it the goal/constraints from handoff.json. After it commits only calc.mjs, run: node scripts/pilot-finish.mjs '+home,notice:'Do NOT use existing/private repositories. No actual Agent has run yet.'},null,2));
