import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {extractPackets,validateChain} from '../src/transport.mjs';

const args=process.argv.slice(2);
const opt=(n,d)=>{const i=args.indexOf(n);return i>=0?args[i+1]:d;};
const issue=Number(opt('--issue','4'));
const slug=opt('--repo','pzy19-prog/relay-continuity-lab');
async function api(url){
  const r=await fetch(url,{headers:{accept:'application/vnd.github+json','user-agent':'relay-lab-g4'}});
  if(!r.ok)throw new Error('GITHUB_READ_'+r.status);
  return r.json();
}
const item=await api('https://api.github.com/repos/'+slug+'/issues/'+issue);
const comments=await api('https://api.github.com/repos/'+slug+'/issues/'+issue+'/comments?per_page=100');
const packets=validateChain([...(extractPackets(item.body||'')),...comments.flatMap(c=>extractPackets(c.body||''))]);
const last=packets.at(-1);
if(last.stage!=='WORK_CONTINUATION'||last.target_surface!=='codex')throw new Error('WORK_CONTINUATION_REQUIRED');

const home=fs.mkdtempSync(path.join(os.tmpdir(),'relay-g4-pilot-'));
const repo=path.join(home,'demo-repo');
const store=path.join(home,'relay-store');
fs.mkdirSync(repo);
function run(cmd,a,cwd=repo){
  const r=spawnSync(cmd,a,{cwd,encoding:'utf8',timeout:30000});
  if(r.status!==0)throw new Error(r.stderr||r.stdout);
  return r.stdout.trim();
}
for(const n of ['calc.mjs','calc.test.mjs'])fs.copyFileSync(new URL('../benchmark/fixture/'+n,import.meta.url),path.join(repo,n));
const installer=new URL('./install-skill.mjs',import.meta.url).pathname;
const install=JSON.parse(run(process.execPath,[installer,'--scope','project','--host','cursor','--project-dir',repo]));
fs.writeFileSync(path.join(repo,'.relay-lab.json'),JSON.stringify({schema:1,id:'relay-continuity-lab/project-binding',store:'../relay-store'},null,2)+'\n');
fs.writeFileSync(path.join(repo,'AGENT_TASK.md'),
  '# G4 cross-surface task\n\nCanonical task: '+last.task_id+'\nWork packet: '+last.packet_id+'\nRead project Skill and use show/resume without --store. Execute only the authorized synthetic change.\n');
run('git',['init','-q']);
run('git',['config','user.name','G4 Fixture']);
run('git',['config','user.email','g4@example.invalid']);
run('git',['add','.']);
run('git',['commit','-qm','fixture: g4 baseline']);
const p=last.payload;
const entry=install.entry;
const call=(...a)=>run(process.execPath,[entry,'--store',store,...a]);
const task=JSON.parse(call('create','--id',last.task_id,'--goal',p.goal,'--repo',repo,'--actor','local-agent','--allowed',p.allowed_paths.join(','),'--test',p.test_file,'--constraints',p.constraints.join('|')));
call('handoff',task.id);
fs.writeFileSync(path.join(home,'pilot.json'),JSON.stringify({repo,store,task_id:task.id,entry,issue,transport_parent:last.packet_id,transport_seq:last.seq},null,2)+'\n');
console.log(JSON.stringify({pilot_dir:home,repo,task_id:task.id,transport_issue:issue,work_packet:last.packet_id,skill_entry:entry,next:'Open demo-repo in Cursor and execute AGENT_TASK.md via relay-lab Skill; then run scripts/g4-pilot-finish.mjs '+home},null,2));
