import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {assertPublicSafe,extractPackets,seal,validate,validateChain,renderPacket} from './transport.mjs';

const workMarker=/<!-- relay-work-draft-v0 -->\s*```json\s*([\s\S]*?)```/g;
function req(ok,code){if(!ok)throw new Error(code);}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}

export function extractWorkDrafts(text=''){
  const out=[];let m;workMarker.lastIndex=0;
  while((m=workMarker.exec(text)))out.push(JSON.parse(m[1]));
  return out;
}

export function validateWorkDraft(chatPacket,draft){
  validate(chatPacket);
  req(chatPacket.stage==='CHAT_INTENT','CHAT_INTENT_REQUIRED');
  req(draft?.schema==='relay-lab/work-draft-v0','WORK_DRAFT_SCHEMA_INVALID');
  req(draft.task_id===chatPacket.task_id,'WORK_DRAFT_TASK_MISMATCH');
  req(draft.parent_packet_id===chatPacket.packet_id,'WORK_DRAFT_PARENT_MISMATCH');
  req(draft.source_surface==='work'&&draft.target_surface==='codex','WORK_DRAFT_SURFACE_INVALID');
  req(draft.decision==='CONTINUE_AS_SCOPED','WORK_DRAFT_DECISION_INVALID');
  const p=draft.payload||{},c=chatPacket.payload||{};
  req(p.goal===c.goal,'WORK_DRAFT_GOAL_CHANGED');
  req(same(p.allowed_paths,c.allowed_paths),'WORK_DRAFT_PATHS_CHANGED');
  req(p.test_file===c.test_file,'WORK_DRAFT_TEST_CHANGED');
  req(same(p.constraints,c.constraints),'WORK_DRAFT_CONSTRAINTS_CHANGED');
  req(typeof p.notes==='string'&&p.notes.length<=500,'WORK_DRAFT_NOTES_INVALID');
  const allowed=new Set(['goal','allowed_paths','test_file','constraints','notes']);
  req(Object.keys(p).every(k=>allowed.has(k)),'WORK_DRAFT_SCOPE_EXPANSION');
  assertPublicSafe(draft);
  return draft;
}

export function sealWorkDraft(chatPacket,draft,{packetId='work-001'}={}){
  validateWorkDraft(chatPacket,draft);
  return seal({
    schema:'relay-lab/transport-v0',
    task_id:chatPacket.task_id,
    packet_id:packetId,
    seq:chatPacket.seq+1,
    parent_packet_id:chatPacket.packet_id,
    stage:'WORK_CONTINUATION',
    source_surface:'work',
    target_surface:'codex',
    authority:chatPacket.authority,
    payload:{goal:draft.payload.goal,allowed_paths:draft.payload.allowed_paths,test_file:draft.payload.test_file,constraints:draft.payload.constraints,notes:draft.payload.notes}
  });
}

export async function fetchIssueBundle({repo='pzy19-prog/relay-continuity-lab',issue}){
  const endpoint='repos/'+repo+'/issues/'+issue;
  const ghJson=(ep)=>{
    const r=spawnSync('gh',['api',ep],{encoding:'utf8',timeout:30000});
    if(r.status!==0)return null;
    try{return JSON.parse(r.stdout);}catch{return null;}
  };
  let reader='gh';
  let item=ghJson(endpoint);
  let comments=ghJson(endpoint+'/comments?per_page=100');
  if(item===null||comments===null){
    reader='fetch';
    const base='https://api.github.com/repos/'+repo;
    const api=async url=>{
      const r=await fetch(url,{headers:{accept:'application/vnd.github+json','user-agent':'relay-lab-g5'}});
      if(!r.ok)throw new Error('GITHUB_READ_'+r.status);
      return r.json();
    };
    item=await api(base+'/issues/'+issue);
    comments=await api(base+'/issues/'+issue+'/comments?per_page=100');
  }
  const all=[item.body||'',...comments.map(c=>c.body||'')];
  const packets=all.flatMap(extractPackets);
  const drafts=all.flatMap(extractWorkDrafts);
  return {item,comments,packets,drafts,reader};
}

export function bestChain(packets){
  if(!packets.length)throw new Error('TRANSPORT_EMPTY');
  return validateChain(packets);
}

export function saveSnapshot(store,{repo,issue,packets}){
  const chain=bestChain(packets);
  const taskId=chain[0].task_id;
  const dir=path.join(store,'transport');fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const file=path.join(dir,taskId+'.json');
  const data={schema:'relay-lab/transport-snapshot-v0',repo,issue,task_id:taskId,packets:chain,updated_at:new Date().toISOString()};
  const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,file);
  return file;
}

export function publishPacketFile({repo,issue,file,publish=false}){
  const text=fs.readFileSync(file,'utf8');
  const packets=extractPackets(text);
  req(packets.length===1,'ONE_PACKET_REQUIRED');validate(packets[0]);assertPublicSafe(packets[0]);
  if(!publish)return {published:false,dry_run:true,repo,issue,file,packet_id:packets[0].packet_id};
  const probe=spawnSync('gh',['--version'],{encoding:'utf8'});req(probe.status===0,'GH_CLI_REQUIRED_FOR_PUBLISH');
  const r=spawnSync('gh',['issue','comment',String(issue),'--repo',repo,'--body-file',file],{encoding:'utf8',timeout:30000});
  req(r.status===0,'GH_PUBLISH_FAILED: '+(r.stderr||r.stdout).trim());
  return {published:true,dry_run:false,repo,issue,file,packet_id:packets[0].packet_id,output:r.stdout.trim()};
}

export function writePacketFile(packet,file){
  validate(packet);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,renderPacket(packet)+'\n',{mode:0o600});return file;
}
