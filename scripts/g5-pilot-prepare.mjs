import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fetchIssueBundle,bestChain,sealWorkDraft,writePacketFile,publishPacketFile,saveSnapshot} from '../src/github-transport.mjs';

const args=process.argv.slice(2);
const opt=(n,d)=>{const i=args.indexOf(n);return i>=0?args[i+1]:d;};
const has=n=>args.includes(n);
const issue=Number(opt('--issue','0'));
const slug=opt('--repo','pzy19-prog/relay-continuity-lab');
if(!Number.isInteger(issue)||issue<1)throw new Error('ISSUE_REQUIRED');

let bundle=await fetchIssueBundle({repo:slug,issue});
let chain=bestChain(bundle.packets);
let last=chain.at(-1);
if(last.stage==='CHAT_INTENT'){
  let drafts=bundle.drafts.filter(d=>d.task_id===last.task_id&&d.parent_packet_id===last.packet_id);
  // Work comments may become visible a moment after the user switches back to WSL.
  // Retry only the safe zero-draft case; duplicates still fail closed immediately.
  for(let attempt=0;drafts.length===0&&attempt<4;attempt++){
    await new Promise(r=>setTimeout(r,1500));
    bundle=await fetchIssueBundle({repo:slug,issue});
    chain=bestChain(bundle.packets);last=chain.at(-1);
    drafts=bundle.drafts.filter(d=>d.task_id===last.task_id&&d.parent_packet_id===last.packet_id);
  }
  if(drafts.length!==1)throw new Error('EXACTLY_ONE_MATCHING_WORK_DRAFT_REQUIRED: observed='+drafts.length);
  const packet=sealWorkDraft(last,drafts[0],{packetId:'work-001'});
  const out=path.join(os.tmpdir(),'relay-g5-work-'+issue+'.md');
  writePacketFile(packet,out);
  const result=publishPacketFile({repo:slug,issue,file:out,publish:has('--publish-work')});
  if(!result.published){
    console.log(JSON.stringify({status:'WORK_CONTINUATION_DRY_RUN',packet,file:out,next:'rerun with --publish-work after reviewing the packet'},null,2));
    process.exit(0);
  }
  bundle=await fetchIssueBundle({repo:slug,issue});
  chain=bestChain(bundle.packets);last=chain.at(-1);
}
if(last.stage!=='WORK_CONTINUATION'||last.target_surface!=='codex')throw new Error('WORK_CONTINUATION_REQUIRED');

const home=fs.mkdtempSync(path.join(os.tmpdir(),'relay-g5-pilot-'));
const fixture=path.join(home,'demo-repo'),store=path.join(home,'relay-store');
fs.mkdirSync(fixture);
const run=(cmd,a,cwd=fixture)=>{const r=spawnSync(cmd,a,{cwd,encoding:'utf8',timeout:30000});if(r.status!==0)throw new Error(r.stderr||r.stdout);return r.stdout.trim();};
for(const n of ['calc.mjs','calc.test.mjs'])fs.copyFileSync(new URL('../benchmark/fixture/'+n,import.meta.url),path.join(fixture,n));
const install=JSON.parse(run(process.execPath,[new URL('./install-skill.mjs',import.meta.url).pathname,'--scope','project','--host','cursor','--project-dir',fixture]));
fs.writeFileSync(path.join(fixture,'.relay-lab.json'),JSON.stringify({schema:1,id:'relay-continuity-lab/project-binding',store:'../relay-store'},null,2)+'\n');
fs.writeFileSync(path.join(fixture,'AGENT_TASK.md'),'# G5 cross-surface task\n\nCanonical task: '+last.task_id+'\nTransport packet: '+last.packet_id+'\nUse the project relay-lab Skill show/resume without --store, then execute only the bounded synthetic change.\n');
run('git',['init','-q']);run('git',['config','user.name','G5 Fixture']);run('git',['config','user.email','g5@example.invalid']);run('git',['add','.']);run('git',['commit','-qm','fixture: g5 baseline']);
const p=last.payload,entry=install.entry,call=(...a)=>run(process.execPath,[entry,'--store',store,...a]);
const task=JSON.parse(call('create','--id',last.task_id,'--goal',p.goal,'--repo',fixture,'--actor','local-agent','--allowed',p.allowed_paths.join(','),'--test',p.test_file,'--constraints',p.constraints.join('|')));
call('handoff',task.id);
const snapshot=saveSnapshot(store,{repo:slug,issue,packets:chain});
fs.writeFileSync(path.join(home,'pilot.json'),JSON.stringify({repo:fixture,store,task_id:task.id,entry,issue,transport_repo:slug,transport_parent:last.packet_id,transport_seq:last.seq,snapshot},null,2)+'\n');
console.log(JSON.stringify({pilot_dir:home,repo:fixture,store,task_id:task.id,work_packet:last.packet_id,transport_snapshot:snapshot,ui_command:'cd ~/relay-continuity-lab && RELAY_STORE='+store+' npm run ui',next:'Open demo-repo in Cursor/Codex, execute AGENT_TASK.md, then run node scripts/g5-pilot-finish.mjs '+home+' --publish-receipt'},null,2));
