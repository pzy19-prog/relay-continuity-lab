import crypto from 'node:crypto';

const stages = new Set(['CHAT_INTENT','WORK_CONTINUATION','EXECUTION_RECEIPT']);
const surfaces = new Set(['chat','work','codex']);
const safeId=/^[A-Za-z0-9._-]+$/;
function req(ok,code){if(!ok)throw new Error(code);}
export function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export function contentHash(packet){
  const x={...packet};delete x.content_sha256;
  return crypto.createHash('sha256').update(canonical(x)).digest('hex');
}
export function assertPublicSafe(value){
  if(value===null||value===undefined)return;
  if(typeof value==='string'){
    req(!/(^|\s)(?:\/home\/|\/tmp\/|[A-Za-z]:\\)/.test(value),'PRIVATE_PATH_IN_TRANSPORT');
    req(!/(ghp_|github_pat_|sk-[A-Za-z0-9]|BEGIN [A-Z ]*PRIVATE KEY|Bearer\s+[A-Za-z0-9._-]+)/i.test(value),'SECRET_LIKE_VALUE');
    return;
  }
  if(Array.isArray(value)){for(const v of value)assertPublicSafe(v);return;}
  if(typeof value==='object'){
    for(const [k,v] of Object.entries(value)){
      req(!/(token|password|authorization|cookie|repo_local|store)$/i.test(k),'PRIVATE_FIELD_IN_TRANSPORT');
      assertPublicSafe(v);
    }
  }
}
export function validate(packet,checkHash=true){
  req(packet?.schema==='relay-lab/transport-v0','TRANSPORT_SCHEMA_INVALID');
  req(safeId.test(packet.task_id),'TASK_ID_INVALID');
  req(safeId.test(packet.packet_id),'PACKET_ID_INVALID');
  req(Number.isInteger(packet.seq)&&packet.seq>=1,'SEQ_INVALID');
  req(packet.parent_packet_id===null||safeId.test(packet.parent_packet_id),'PARENT_ID_INVALID');
  req(stages.has(packet.stage),'STAGE_INVALID');
  req(surfaces.has(packet.source_surface)&&surfaces.has(packet.target_surface),'SURFACE_INVALID');
  req(packet.authority?.scope_change==='human_only'&&packet.authority?.final_approval==='human','AUTHORITY_INVALID');
  assertPublicSafe(packet);
  if(checkHash)req(packet.content_sha256===contentHash(packet),'PACKET_HASH_INVALID');
  return packet;
}
export function seal(packet){
  assertPublicSafe(packet);
  validate({...packet,content_sha256:'0'.repeat(64)},false);
  return {...packet,content_sha256:contentHash(packet)};
}
export function validateChain(packets){
  req(Array.isArray(packets)&&packets.length>0,'TRANSPORT_EMPTY');
  const sorted=[...packets].sort((a,b)=>a.seq-b.seq);
  const ids=new Set();
  for(let i=0;i<sorted.length;i++){
    const p=validate(sorted[i]);
    req(!ids.has(p.packet_id),'DUPLICATE_PACKET_ID');ids.add(p.packet_id);
    req(p.seq===i+1,'OUT_OF_ORDER_SEQ');
    if(i===0)req(p.parent_packet_id===null,'ROOT_PARENT_INVALID');
    else {req(p.task_id===sorted[0].task_id,'TASK_ID_CHANGED');req(p.parent_packet_id===sorted[i-1].packet_id,'PARENT_PACKET_MISMATCH');}
  }
  return sorted;
}
export function renderPacket(packet){
  return '<!-- relay-packet-v0 -->\n```json\n'+JSON.stringify(packet,null,2)+'\n```';
}
export function extractPackets(text=''){
  const out=[];const re=/<!-- relay-packet-v0 -->\s*```json\s*([\s\S]*?)```/g;let m;
  while((m=re.exec(text)))out.push(JSON.parse(m[1]));
  return out;
}
