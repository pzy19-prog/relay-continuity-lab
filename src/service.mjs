import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {defaultStore,list,load,resume} from './core.mjs';
import {currentSurface,requiredHumanAction} from './demo-state.mjs';

function transportSnapshot(store,id){
  const file=path.join(store,'transport',id+'.json');
  if(!fs.existsSync(file))return null;
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data?.schema!=='relay-lab/transport-snapshot-v0'||data.task_id!==id)throw new Error('TRANSPORT_SNAPSHOT_INVALID');
  return data;
}

function lineage(snapshot){
  return (snapshot?.packets||[]).map(p=>({
    seq:p.seq,
    packet_id:p.packet_id,
    stage:p.stage,
    from:p.source_surface,
    to:p.target_surface,
    parent_packet_id:p.parent_packet_id,
    review_status:p.payload?.review_status??null
  }));
}

function taskView(store,task){
  const snap=transportSnapshot(store,task.id);
  return {
    schema:'relay-lab/service-task-v1',
    task_id:task.id,
    goal:task.goal,
    state:task.state,
    owner:task.owner,
    next_action:task.next_action,
    allowed_paths:task.allowed_paths,
    constraints:task.constraints,
    base:task.base,
    review:task.review,
    receipt:task.receipts?.[0]?{
      receipt_id:task.receipts[0].receipt_id,
      status:task.receipts[0].status,
      head_commit:task.receipts[0].head_commit
    }:null,
    current_surface:currentSurface(task,snap),
    required_human_action:requiredHumanAction(task,snap),
    transport_lineage:lineage(snap),
    events:(task.events||[]).map(e=>({seq:e.seq,at:e.at,kind:e.kind,detail:e.detail}))
  };
}

function json(res,status,payload){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(payload));
}

export function resolveBindHost(env=process.env){
  const requested=env.RELAY_SERVICE_HOST||'127.0.0.1';
  if(requested!=='127.0.0.1')throw new Error('REMOTE_BIND_REFUSED');
  return requested;
}

export function createRelayService({store=defaultStore}={}){
  return http.createServer((req,res)=>{
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      if(req.method!=='GET'){
        json(res,405,{error:'READ_ONLY_SERVICE'});
        return;
      }
      if(url.pathname==='/v1/health'){
        json(res,200,{schema:'relay-lab/service-health-v1',status:'ok',api:'v1',mode:'read-only',store_bound:true});
        return;
      }
      if(url.pathname==='/v1/tasks'){
        json(res,200,{schema:'relay-lab/service-task-list-v1',tasks:list(store).map(t=>taskView(store,t))});
        return;
      }
      const checkpoint=/^\/v1\/tasks\/([^/]+)\/checkpoint$/.exec(url.pathname);
      if(checkpoint){
        const id=decodeURIComponent(checkpoint[1]);
        const task=load(store,id),snap=transportSnapshot(store,id);
        json(res,200,{
          schema:'relay-lab/service-checkpoint-v1',
          checkpoint:resume(store,id),
          current_surface:currentSurface(task,snap),
          required_human_action:requiredHumanAction(task,snap),
          transport_lineage:lineage(snap)
        });
        return;
      }
      const detail=/^\/v1\/tasks\/([^/]+)$/.exec(url.pathname);
      if(detail){
        const id=decodeURIComponent(detail[1]);
        json(res,200,taskView(store,load(store,id)));
        return;
      }
      json(res,404,{error:'NOT_FOUND'});
    }catch(e){
      const status=e?.code==='ENOENT'?404:400;
      json(res,status,{error:e.message});
    }
  });
}

export function startRelayService({store=defaultStore,port=Number(process.env.RELAY_SERVICE_PORT||4318),host=resolveBindHost()}={}){
  const server=createRelayService({store});
  server.listen(port,host,()=>{
    const address=server.address();
    console.log(JSON.stringify({
      schema:'relay-lab/service-start-v1',
      status:'LISTENING',
      host,
      port:typeof address==='object'?address.port:port,
      api:'v1',
      mode:'read-only',
      notice:'Loopback-only local API. This does not connect Chat/Work directly to WSL.'
    }));
  });
  return server;
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain)startRelayService();
