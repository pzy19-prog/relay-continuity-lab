#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import {fetchIssueBundle,bestChain,sealWorkDraft,writePacketFile,publishPacketFile,saveSnapshot} from '../src/github-transport.mjs';

const args=process.argv.slice(2);
const command=args.shift();
const opt=(n,d)=>{const i=args.indexOf(n);return i>=0?args[i+1]:d;};
const has=n=>args.includes(n);
const repo=opt('--repo','pzy19-prog/relay-continuity-lab');
const issue=Number(opt('--issue','0'));
if(!Number.isInteger(issue)||issue<1)throw new Error('ISSUE_REQUIRED');

if(command==='inspect'){
  const b=await fetchIssueBundle({repo,issue});
  const chain=bestChain(b.packets);
  console.log(JSON.stringify({repo,issue,task_id:chain[0].task_id,packet_count:chain.length,last_packet:chain.at(-1),work_draft_count:b.drafts.length},null,2));
} else if(command==='continue-work'){
  const b=await fetchIssueBundle({repo,issue});
  let chain=bestChain(b.packets);
  const existing=chain.find(p=>p.stage==='WORK_CONTINUATION');
  if(existing){
    console.log(JSON.stringify({status:'ALREADY_SEALED',packet:existing},null,2));
  } else {
    const chat=chain.at(-1);
    if(chat.stage!=='CHAT_INTENT')throw new Error('CHAT_INTENT_MUST_BE_LATEST');
    const drafts=b.drafts.filter(d=>d.task_id===chat.task_id&&d.parent_packet_id===chat.packet_id);
    if(drafts.length!==1)throw new Error('EXACTLY_ONE_MATCHING_WORK_DRAFT_REQUIRED');
    const packet=sealWorkDraft(chat,drafts[0],{packetId:'work-001'});
    const out=path.resolve(opt('--out',path.join(os.tmpdir(),'relay-work-continuation-'+issue+'.md')));
    writePacketFile(packet,out);
    const publish=publishPacketFile({repo,issue,file:out,publish:has('--publish')});
    console.log(JSON.stringify({status:publish.published?'PUBLISHED':'DRY_RUN',packet,file:out,publish},null,2));
  }
} else if(command==='publish'){
  const file=path.resolve(opt('--file',''));
  if(!file)throw new Error('FILE_REQUIRED');
  console.log(JSON.stringify(publishPacketFile({repo,issue,file,publish:has('--publish')}),null,2));
} else if(command==='snapshot'){
  const store=path.resolve(opt('--store',''));
  if(!store)throw new Error('STORE_REQUIRED');
  const b=await fetchIssueBundle({repo,issue});
  const file=saveSnapshot(store,{repo,issue,packets:b.packets});
  console.log(JSON.stringify({snapshot:file},null,2));
} else {
  throw new Error('USAGE: transport-adapter.mjs inspect|continue-work|publish|snapshot --issue N [--repo owner/name] [--publish]');
}
