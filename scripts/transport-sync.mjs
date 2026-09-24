#!/usr/bin/env node
import {syncGithubIssueToInbox} from '../src/transport-inbox.mjs';

const args=process.argv.slice(2);
const opt=(name,fallback)=>{const i=args.indexOf(name);return i>=0?args[i+1]:fallback;};
const repo=opt('--repo','');
const issue=Number(opt('--issue','0'));
const store=opt('--store',process.env.RELAY_STORE||'');
const watch=args.includes('--watch');
const interval=Number(opt('--interval-seconds','15'));

if(!repo||!Number.isInteger(issue)||issue<1||!store)throw new Error('USAGE: transport-sync.mjs --repo OWNER/REPO --issue N --store DIR [--watch --interval-seconds 10..3600]');
if(watch&&(interval<10||interval>3600))throw new Error('WATCH_INTERVAL_OUT_OF_RANGE');

function run(){
  try{
    const r=syncGithubIssueToInbox(store,{repo,issue});
    console.log(JSON.stringify({
      schema:'relay-lab/transport-sync-result-v0',
      status:r.status,
      changed:r.changed,
      reader:r.reader,
      source:r.record.source,
      task_id:r.record.task_id,
      packet_count:r.record.packets.length,
      last_accepted:r.record.last_accepted
    }));
  }catch(e){
    console.error(JSON.stringify({schema:'relay-lab/transport-sync-error-v0',status:'BLOCKED',error:e.message}));
    process.exitCode=2;
    return false;
  }
  return true;
}

if(!run())process.exit(2);
if(watch){
  const timer=setInterval(()=>{if(!run()){clearInterval(timer);process.exit(2);}},interval*1000);
  for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{clearInterval(timer);process.exit(0);});
}
