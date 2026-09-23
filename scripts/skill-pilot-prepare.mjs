// Installs a *project-scoped* Skill into an entirely new synthetic repo BEFORE its baseline commit.
// The fixture can then be opened directly in Cursor WSL without modifying global user configuration.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
const home=process.env.RELAY_SKILL_PILOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'relay-skill-pilot-'));
if(fs.existsSync(path.join(home,'pilot.json')))throw new Error('PILOT_EXISTS');
const repo=path.join(home,'demo-repo'),store=path.join(home,'relay-store');
fs.mkdirSync(repo,{recursive:true});
const root=new URL('..',import.meta.url);
const run=(command,args,cwd=repo,env=process.env)=>{
 const r=spawnSync(command,args,{cwd,env,encoding:'utf8',timeout:25000});
 if(r.status!==0)throw new Error(`${command} failed: ${r.stderr||r.stdout}`);
 return r.stdout.trim();
};
for(const name of ['calc.mjs','calc.test.mjs'])fs.copyFileSync(new URL('../benchmark/fixture/'+name,import.meta.url),path.join(repo,name));
const install=JSON.parse(run(process.execPath,[new URL('./install-skill.mjs',import.meta.url).pathname,'--scope','project','--host','cursor','--project-dir',repo]));
const entry=install.entry;
fs.writeFileSync(path.join(repo,'AGENT_TASK.md'),`# Relay Skill Pilot: synthetic task only\n\nRead the installed project Skill at \`.agents/skills/relay-lab/SKILL.md\` and the handoff packet at \`../handoff.json\` (generated after this fixture's first commit). Read \`../pilot.json\` for task ID and isolated store. Invoke \`node .agents/skills/relay-lab/scripts/relay.mjs --store <pilot.store> show <task_id>\` and \`resume <task_id>\` **before** editing. Confirm the state is HANDED_OFF and environment_match=true. With the user's explicit authority, edit and commit **only calc.mjs** to fix addition. Run the unchanged committed independent test. Do not modify tests, Skill files, task state, other projects or network resources. Report redacted invocation evidence, head commit, changed filenames and test results; the human controller runs the trusted finish/approve commands.\n`);
run('git',['init','-q']);run('git',['config','user.name','Synthetic Skill Pilot']);run('git',['config','user.email','synthetic@example.invalid']);
run('git',['add','.']);run('git',['commit','-qm','fixture: failing calc plus installed local Skill']);
const withStore=(...args)=>run(process.execPath,[entry,'--store',store,...args]);
const task=JSON.parse(withStore('create','--goal','Fix the addition bug while preserving calc.test.mjs','--repo',repo,'--actor','local-agent','--allowed','calc.mjs','--test','calc.test.mjs','--constraints','Only calc.mjs|Commit fix|Do not change tests|No network or secrets'));
const handoff=JSON.parse(withStore('handoff',task.id));
fs.writeFileSync(path.join(home,'handoff.json'),JSON.stringify(handoff,null,2)+'\n',{mode:0o600});
fs.writeFileSync(path.join(home,'pilot.json'),JSON.stringify({repo,store,task_id:task.id,actor:task.actor,entry},null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({pilot_dir:home,repo,store,task_id:task.id,handoff_file:path.join(home,'handoff.json'),skill_entry:entry, next_step:'Open demo-repo in Cursor WSL. Ask Agent to discover the project relay-lab Skill, invoke show/resume for task ID and then fix/commit only calc.mjs. After its commit, run node scripts/skill-pilot-finish.mjs '+home,notice:'This script uses the installed Skill to create/handoff. It has not invoked a real Agent.'},null,2));
