// Capture local Git evidence after an authorized Agent executed the synthetic fixture.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {load,receipt,verify,resume} from '../src/core.mjs';
const home=process.argv[2];if(!home)throw new Error('Usage: node scripts/pilot-finish.mjs <pilot-dir>');
const {task_id,repo,store,actor}=JSON.parse(fs.readFileSync(path.join(home,'pilot.json'),'utf8'));
const task=load(store,task_id);
const run=(...args)=>{const o=spawnSync('git',['-C',repo,...args],{encoding:'utf8'});if(o.status!==0)throw new Error(o.stderr);return o.stdout.trim();};
const status=run('status','--porcelain','--untracked-files=all');
if(status)throw new Error('Pilot repo is dirty: have the Agent commit only approved code first.');
const head=run('rev-parse','HEAD');if(head===task.base)throw new Error('No Agent commit: original failing baseline is unchanged.');
const changed=run('diff','--name-only',task.base,head).split('\n').filter(Boolean);
if(changed.length!==1||changed[0]!=='calc.mjs')throw new Error('Change scope invalid: '+changed.join(','));
const sha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,'calc.mjs'))).digest('hex');
const packet={receipt_id:'pilot-'+task_id,task_id,actor,base_commit:task.base,head_commit:head,status:'PASS',evidence:[{kind:'file_hash',path:'calc.mjs',sha256}]};
const receiptFile=path.join(home,'candidate-receipt.json');fs.writeFileSync(receiptFile,JSON.stringify(packet,null,2)+'\n',{mode:0o600});
receipt(store,task_id,packet);const result=verify(store,task_id);
console.log(JSON.stringify({task_id,receipt_file:receiptFile,state:result.state,review:result.review,checkpoint:resume(store,task_id),human_review_command:`node src/cli.mjs --store ${JSON.stringify(store)} decide ${task_id} --decision APPROVE`,notice:'Candidate receipt is assembled from observed local Git facts. Actor label is self-reported, not authenticated; human must inspect Agent run before approval.'},null,2));
if(result.state!=='VERIFIED_PENDING_DECISION')process.exitCode=1;
