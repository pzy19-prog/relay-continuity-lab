// Read-only human visibility UI. Loopback by design: no remote exposure or auth.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {defaultStore,list,load} from './core.mjs';
const port=Number(process.env.RELAY_PORT||4317),store=defaultStore;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readTransport(id){
  const file=path.join(store,'transport',id+'.json');
  if(!fs.existsSync(file))return null;
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return {error:'TRANSPORT_SNAPSHOT_INVALID'};}
}
function lineage(snapshot){
  if(!snapshot?.packets)return '';
  return snapshot.packets.map(p=>`<div class="packet"><div><b>#${escape(p.seq)} ${escape(p.stage)}</b> <span class="badge">${escape(p.source_surface)} → ${escape(p.target_surface)}</span></div><small>${escape(p.packet_id)} · parent ${escape(p.parent_packet_id??'ROOT')}</small>${p.payload?.review_status?`<div>Evidence: <code>${escape(p.payload.review_status)}</code></div>`:''}</div>`).join('');
}
const server=http.createServer((req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const tasks=list(store);
    if(url.pathname==='/api/tasks'){res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(tasks));return;}
    if(url.pathname.startsWith('/api/task/')){const id=url.pathname.slice('/api/task/'.length);const t=load(store,id);res.writeHead(200,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify({...t,transport:readTransport(id)}));return;}
    if(url.pathname!=='/'){res.writeHead(404);res.end('Not found');return;}
    const selected=url.searchParams.get('task');let task=null,transport=null;if(selected){task=load(store,selected);transport=readTransport(selected);}
    const row=t=>`<a class="row" href="/?task=${encodeURIComponent(t.id)}"><b>${escape(t.id)}</b> <span class="badge">${escape(t.state)}</span><div>${escape(t.goal)}</div><small>Owner: ${escape(t.owner)} · Next: ${escape(t.next_action)}</small></a>`;
    const events=task?task.events.map(e=>`<div class="event"><time>${escape(e.at)}</time><strong>${escape(e.kind)}</strong><pre>${escape(JSON.stringify(e.detail,null,2))}</pre></div>`).join(''):'';
    const transportBlock=task?`<h2>Cross-surface lineage</h2>${transport?.error?`<p class="warn">${escape(transport.error)}</p>`:(lineage(transport)||'<p>No transport snapshot for this task.</p>')}`:'';
    const html=`<!doctype html><html lang="en"><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Relay Lab</title><style>:root{font-family:ui-sans-serif,system-ui;background:#0b1120;color:#e9f0ff}body{margin:0}header{padding:24px 32px;background:#16243a}header p{color:#a5b7c9}.wrap{max-width:1300px;margin:auto;padding:24px;display:grid;grid-template-columns:350px 1fr;gap:22px}.panel{background:#152237;border:1px solid #2a3d51;border-radius:12px;padding:20px}a{color:#8ddde5;text-decoration:none}.row{display:block;border:1px solid #364e60;padding:14px;border-radius:9px;margin-bottom:12px}.badge{font-size:12px;padding:3px 7px;border-radius:10px;background:#244f4d;color:#b4fff2}small,time{color:#9cacbd;display:block;margin-top:5px}pre{white-space:pre-wrap;word-break:break-word;color:#d0e2fc;background:#0c1727;padding:12px;border-radius:8px}.event{border-left:2px solid #4eb4ad;padding:7px 16px;margin:14px 0}.packet{border:1px solid #36526a;background:#101d2d;border-radius:9px;padding:12px;margin:10px 0}.warn{color:#ffd2a8}code{color:#b4fff2}@media(max-width:850px){.wrap{display:block;padding:12px}.panel{margin-bottom:14px}}</style><header><h1>Relay Lab</h1><p>Local-first · explicit transport · human approval · pre-alpha</p></header><main class="wrap"><section class="panel"><h2>Task Inbox (${tasks.length})</h2>${tasks.map(row).join('')||'No tasks.'}</section><section class="panel">${task?`<h2>${escape(task.id)} · ${escape(task.state)}</h2><p>${escape(task.goal)}</p><p>Owner: <b>${escape(task.owner)}</b><br/>Next: <b>${escape(task.next_action)}</b></p><p>Independent checks: <code>${escape(task.review?.status??'NOT_RUN')}</code></p>${transportBlock}<h2>Local task timeline</h2>${events}`:'<h2>Select a task</h2>'}</section></main></html>`;
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"});res.end(html);
  } catch(e){res.writeHead(400,{'content-type':'text/plain; charset=utf-8'});res.end('Error: '+e.message);}
});server.listen(port,'127.0.0.1',()=>console.log(`Relay UI: http://127.0.0.1:${port} (read-only, loopback)`));
