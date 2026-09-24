#!/usr/bin/env node
// Installed Skill delegates to copied CLI/Core. Project state may be bound by .relay-lab.json.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../vendor/cli.mjs', import.meta.url));
const argv = process.argv.slice(2);
const env = {...process.env};

const serviceCommand=argv[0];
if(['service-health','service-list','service-show','service-checkpoint','service-inbox','service-inbox-show'].includes(serviceCommand)){
  try{
    const {serviceGet}=await import(new URL('../vendor/service-client.mjs',import.meta.url).href);
    let endpoint;
    if(serviceCommand==='service-health')endpoint='v1/health';
    else if(serviceCommand==='service-list')endpoint='v1/tasks';
    else if(serviceCommand==='service-inbox')endpoint='v1/transport-inbox';
    else if(serviceCommand==='service-inbox-show'){
      const id=argv[1];if(!id){console.error('RELAY_SKILL_SERVICE_ERROR: TASK_ID_REQUIRED');process.exit(2);}
      endpoint='v1/transport-inbox/'+encodeURIComponent(id);
    }
    else{
      const id=argv[1];
      if(!id){console.error('RELAY_SKILL_SERVICE_ERROR: TASK_ID_REQUIRED');process.exit(2);}
      endpoint='v1/tasks/'+encodeURIComponent(id)+(serviceCommand==='service-checkpoint'?'/checkpoint':'');
    }
    console.log(JSON.stringify(await serviceGet(endpoint),null,2));
    process.exit(0);
  }catch(e){
    console.error('RELAY_SKILL_SERVICE_ERROR: '+e.message);
    process.exit(2);
  }
}

function findProjectBinding(start) {
  let dir = path.resolve(start);
  while (true) {
    const candidate = path.join(dir, '.relay-lab.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

if (!argv.includes('--store') && !env.RELAY_STORE) {
  const binding = findProjectBinding(process.cwd());
  if (binding) {
    const st = fs.lstatSync(binding);
    if (!st.isFile() || st.isSymbolicLink()) {
      console.error('RELAY_SKILL_ERROR: PROJECT_BINDING_INVALID');
      process.exit(2);
    }
    let cfg;
    try { cfg = JSON.parse(fs.readFileSync(binding, 'utf8')); }
    catch { console.error('RELAY_SKILL_ERROR: PROJECT_BINDING_INVALID_JSON'); process.exit(2); }
    if (cfg.schema !== 1 || cfg.id !== 'relay-continuity-lab/project-binding' || typeof cfg.store !== 'string' || !cfg.store) {
      console.error('RELAY_SKILL_ERROR: PROJECT_STORE_UNBOUND');
      process.exit(2);
    }
    env.RELAY_STORE = path.resolve(path.dirname(binding), cfg.store);
  }
}

// A project-scoped Skill must never silently read another task from ~/.relay-lab-local.
if (!argv.includes('--store') && !env.RELAY_STORE) {
  const manifest = fileURLToPath(new URL('../INSTALL.json', import.meta.url));
  if (fs.existsSync(manifest)) {
    try {
      if (JSON.parse(fs.readFileSync(manifest, 'utf8')).scope === 'project') {
        console.error('RELAY_SKILL_ERROR: PROJECT_STORE_UNBOUND');
        process.exit(2);
      }
    } catch {
      console.error('RELAY_SKILL_ERROR: INSTALL_MANIFEST_INVALID');
      process.exit(2);
    }
  }
}

const res=spawnSync(process.execPath, [cli,...argv], {stdio:'inherit',cwd:process.cwd(),env});
if(res.error){console.error(res.error.message);process.exitCode=1;}
else process.exitCode = res.status === null ? 1 : res.status;
