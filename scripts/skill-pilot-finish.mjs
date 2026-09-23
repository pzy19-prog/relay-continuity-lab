// Local controller converts a real Agent's committed edit to Git-derived candidate receipt.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const home=process.argv[2];if(!home)throw new Error('Usage: node scripts/skill-pilot-finish.mjs <pilot-dir>');
const {task_id,repo,store,actor,entry}=JSON.parse(fs.readFileSync(path.join(home,'pilot.json'),'utf8'));
const git=(...args)=>{const r=spawnSync('git',['-C',repo,...args],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);return r.stdout.trim();};
const cli=(...args)=>{const r=spawnSync(process.execPath,[entry,'--store',store,...args],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||r.stdout);return JSON.parse(r.stdout);};
const task=cli('show',task_id);if(task.state!=='HANDED_OFF')throw new Error('TASK_NOT_HANDED_OFF');
if(git('status','--porcelain','--untracked-files=all'))throw new Error('DIRTY_WORKTREE');
const head=git('rev-parse','HEAD');if(head===task.base)throw new Error('AGENT_COMMIT_MISSING');
const changed=git('diff','--name-only',task.base,head).split('\n').filter(Boolean);
if(changed.length!==1||changed[0]!=='calc.mjs')throw new Error('OUT_OF_SCOPE');
const sha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,'calc.mjs'))).digest('hex');
const receipt={receipt_id:'skill-'+task_id,task_id,actor,base_commit:task.base,head_commit:head,status:'PASS',evidence:[{kind:'file_hash',path:'calc.mjs',sha256}]};
const receiptFile=path.join(home,'candidate-receipt.json');fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
cli('receipt',task_id,'--file',receiptFile);const checked=cli('verify',task_id);const checkpoint=cli('resume',task_id);
console.log(JSON.stringify({task_id,state:checked.state,review:checked.review,environment_match:checkpoint.environment_match,receipt_file:receiptFile,step:'Human inspect Agent invocation, diff and logs. Then explicitly decide in installed Skill CLI. Do not auto-approve.'},null,2));
if(checked.state!=='VERIFIED_PENDING_DECISION'||!checkpoint.environment_match)process.exitCode=1;
