import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {assertPublicSafe,extractPackets,validate,validateChain} from './transport.mjs';
import {extractWorkDrafts,sealWorkDraft} from './github-transport.mjs';

function req(ok,code){if(!ok)throw new Error(code);}
function safeSource(repo,issue){
  req(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo),'SYNC_REPO_INVALID');
  req(Number.isInteger(issue)&&issue>0,'SYNC_ISSUE_INVALID');
  return repo.replace('/','__')+'--issue-'+issue;
}
function dir(store){return path.join(store,'transport-inbox');}
function fileFor(store,repo,issue){return path.join(dir(store),safeSource(repo,issue)+'.json');}

function ghJson(endpoint){
  const r=spawnSync('gh',['api',endpoint],{encoding:'utf8',timeout:30000});
  if(r.status!==0)throw new Error('GH_AUTHENTICATED_READ_FAILED: '+(r.stderr||r.stdout||'').trim());
  try{return JSON.parse(r.stdout);}catch{throw new Error('GH_RESPONSE_INVALID_JSON');}
}

export function fetchAuthenticatedIssueBundle({repo,issue}){
  safeSource(repo,issue);
  const base='repos/'+repo+'/issues/'+issue;
  const item=ghJson(base);
  req(Number(item.comments||0)<=100,'COMMENT_LIMIT_EXCEEDED');
  const comments=ghJson(base+'/comments?per_page=100');
  req(Array.isArray(comments),'GH_COMMENTS_INVALID');
  const packetTexts=[item.body||'',...comments.map(c=>c.body||'')];
  const packets=packetTexts.flatMap(extractPackets);
  const drafts=comments.flatMap(c=>extractWorkDrafts(c.body||''));
  return {item,comments,packets,drafts,reader:'gh-authenticated'};
}

export function buildValidatedInboxChain({packets,drafts=[]}){
  req(Array.isArray(packets)&&packets.length>0,'TRANSPORT_EMPTY');
  packets.forEach(p=>validate(p));
  const taskIds=new Set(packets.map(p=>p.task_id));
  req(taskIds.size===1,'AMBIGUOUS_MULTIPLE_TASKS');
  let chain=validateChain(packets);
  const root=chain[0];
  req(root.stage==='CHAT_INTENT'&&root.source_surface==='chat'&&root.target_surface==='work','CHAT_INTENT_ROOT_REQUIRED');
  req(drafts.every(d=>d?.task_id===root.task_id),'AMBIGUOUS_WORK_DRAFT_TASK');
  const matching=drafts.filter(d=>d.parent_packet_id===root.packet_id);
  req(matching.length<=1,'DUPLICATE_WORK_DRAFT');
  if(matching.length===1){
    const sealed=sealWorkDraft(root,matching[0]);
    if(chain.length===1)chain=validateChain([root,sealed]);
    else{
      req(chain[1].stage==='WORK_CONTINUATION','WORK_CONTINUATION_EXPECTED');
      req(chain[1].content_sha256===sealed.content_sha256,'WORK_PACKET_DRAFT_MISMATCH');
    }
  }
  return chain;
}

function validateRecord(record){
  req(record?.schema==='relay-lab/transport-inbox-v0','INBOX_SCHEMA_INVALID');
  safeSource(record.source?.repo,record.source?.issue);
  const chain=validateChain(record.packets);
  req(record.task_id===chain[0].task_id,'INBOX_TASK_MISMATCH');
  const last=chain.at(-1);
  req(record.last_accepted?.packet_id===last.packet_id,'INBOX_LAST_PACKET_MISMATCH');
  req(record.last_accepted?.content_sha256===last.content_sha256,'INBOX_LAST_HASH_MISMATCH');
  return record;
}

export function readTransportInbox(store){
  const d=dir(store);if(!fs.existsSync(d))return [];
  const out=[];
  for(const name of fs.readdirSync(d).filter(n=>n.endsWith('.json')).sort()){
    const p=path.join(d,name);
    if(fs.lstatSync(p).isSymbolicLink())throw new Error('INBOX_SYMLINK_REFUSED');
    out.push(validateRecord(JSON.parse(fs.readFileSync(p,'utf8'))));
  }
  return out;
}

export function loadTransportInboxTask(store,taskId){
  const matches=readTransportInbox(store).filter(x=>x.task_id===taskId);
  if(matches.length===0){const e=new Error('INBOX_TASK_NOT_FOUND');e.code='ENOENT';throw e;}
  req(matches.length===1,'AMBIGUOUS_INBOX_TASK');
  return matches[0];
}

export function acceptInboxChain(store,{repo,issue,packets}){
  const chain=validateChain(packets);
  assertPublicSafe(chain);
  const target=fileFor(store,repo,issue);
  let prior=null;
  if(fs.existsSync(target))prior=validateRecord(JSON.parse(fs.readFileSync(target,'utf8')));
  if(prior){
    req(prior.task_id===chain[0].task_id,'INBOX_TASK_SWITCH_REFUSED');
    req(chain.length>=prior.packets.length,'STALE_REMOTE_CHAIN');
    for(let i=0;i<prior.packets.length;i++){
      req(chain[i].packet_id===prior.packets[i].packet_id&&chain[i].content_sha256===prior.packets[i].content_sha256,'CHAIN_REWRITE_REFUSED');
    }
    if(chain.length===prior.packets.length)return {status:'IDEMPOTENT',changed:false,record:prior};
  }
  const last=chain.at(-1);
  const record={
    schema:'relay-lab/transport-inbox-v0',
    source:{repo,issue},
    task_id:chain[0].task_id,
    status:'VALIDATED',
    packets:chain,
    last_accepted:{seq:last.seq,packet_id:last.packet_id,content_sha256:last.content_sha256},
    accepted_at:new Date().toISOString()
  };
  validateRecord(record);
  fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
  const tmp=target+'.'+process.pid+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(record,null,2)+'\n',{mode:0o600});
  fs.renameSync(tmp,target);
  return {status:prior?'EXTENDED':'ACCEPTED',changed:true,record};
}

export function syncGithubIssueToInbox(store,{repo,issue}){
  const bundle=fetchAuthenticatedIssueBundle({repo,issue});
  const chain=buildValidatedInboxChain(bundle);
  const result=acceptInboxChain(store,{repo,issue,packets:chain});
  return {...result,reader:bundle.reader};
}
