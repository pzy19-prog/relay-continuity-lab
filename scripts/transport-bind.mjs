#!/usr/bin/env node
import {bindTransportInboxTask} from '../src/transport-bind.mjs';

const args=process.argv.slice(2);
const opt=(name,fallback)=>{const i=args.indexOf(name);return i>=0?args[i+1]:fallback;};
const store=opt('--store',process.env.RELAY_STORE||'');
const taskId=opt('--task','');
const repo=opt('--repo','');
const expectedPacketId=opt('--expected-packet','');
const expectedHash=opt('--expected-hash','');
const actor=opt('--actor','local-agent');

if(!store||!taskId||!repo||!expectedPacketId||!expectedHash){
  throw new Error('USAGE: transport-bind.mjs --store DIR --task TASK_ID --repo LOCAL_REPO --expected-packet PACKET_ID --expected-hash SHA256 [--actor local-agent]');
}

const result=bindTransportInboxTask(store,{taskId,repo,expectedPacketId,expectedHash,actor});
console.log(JSON.stringify({
  schema:result.schema,
  status:result.status,
  created:result.created,
  task_id:result.task.id,
  state:result.task.state,
  owner:result.task.owner,
  next_action:result.task.next_action,
  base:result.task.base,
  provenance:result.provenance,
  notice:'Explicit binding only. No handoff, code execution, receipt, verification, decision or approval was performed.'
},null,2));
