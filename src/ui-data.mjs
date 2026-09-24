import fs from 'node:fs';
import path from 'node:path';
import {defaultStore,list,load} from './core.mjs';
import {currentSurface,requiredHumanAction} from './demo-state.mjs';
import {serviceGet} from './service-client.mjs';

function snapshot(store,id){
  const file=path.join(store,'transport',id+'.json');
  if(!fs.existsSync(file))return null;
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data?.schema!=='relay-lab/transport-snapshot-v0'||data.task_id!==id)throw new Error('TRANSPORT_SNAPSHOT_INVALID');
  return data;
}

function directLineage(snap){
  return (snap?.packets||[]).map(p=>({
    seq:p.seq,
    packet_id:p.packet_id,
    stage:p.stage,
    from:p.source_surface,
    to:p.target_surface,
    parent_packet_id:p.parent_packet_id,
    review_status:p.payload?.review_status??null
  }));
}

function normalizeDirect(task,store){
  const snap=snapshot(store,task.id);
  return {
    id:task.id,goal:task.goal,state:task.state,owner:task.owner,next_action:task.next_action,
    allowed_paths:task.allowed_paths,constraints:task.constraints,review:task.review,
    current_surface:currentSurface(task,snap),required_human_action:requiredHumanAction(task,snap),
    transport_lineage:directLineage(snap),events:task.events||[],data_source:'direct-store'
  };
}

function normalizeService(task){
  return {
    id:task.task_id,goal:task.goal,state:task.state,owner:task.owner,next_action:task.next_action,
    allowed_paths:task.allowed_paths,constraints:task.constraints,review:task.review,
    current_surface:task.current_surface,required_human_action:task.required_human_action,
    transport_lineage:task.transport_lineage||[],events:task.events||[],data_source:'service-v1'
  };
}

export function uiDataMode(env=process.env){return env.RELAY_SERVICE_URL?'service-v1':'direct-store';}

export async function loadUiTasks({store=defaultStore,serviceUrl=process.env.RELAY_SERVICE_URL||null}={}){
  if(serviceUrl){
    const payload=await serviceGet('v1/tasks',{base:serviceUrl});
    return payload.tasks.map(normalizeService);
  }
  return list(store).map(t=>normalizeDirect(t,store));
}

export async function loadUiTask(id,{store=defaultStore,serviceUrl=process.env.RELAY_SERVICE_URL||null}={}){
  if(serviceUrl)return normalizeService(await serviceGet('v1/tasks/'+encodeURIComponent(id),{base:serviceUrl}));
  return normalizeDirect(load(store,id),store);
}

export async function loadUiInbox({serviceUrl=process.env.RELAY_SERVICE_URL||null}={}){
  if(!serviceUrl)return [];
  const payload=await serviceGet('v1/transport-inbox',{base:serviceUrl});
  return payload.items||[];
}
export async function loadUiInboxItem(id,{serviceUrl=process.env.RELAY_SERVICE_URL||null}={}){
  if(!serviceUrl)throw new Error('SERVICE_MODE_REQUIRED_FOR_INBOX');
  return serviceGet('v1/transport-inbox/'+encodeURIComponent(id),{base:serviceUrl});
}
