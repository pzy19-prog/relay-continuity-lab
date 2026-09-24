#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args=process.argv.slice(2);
const opt=(name,fallback)=>{const i=args.indexOf(name);return i>=0?args[i+1]:fallback;};
const repo=opt('--repo','pzy19-prog/relay-continuity-lab');
const issue=Number(opt('--issue','0'));
if(!Number.isInteger(issue)||issue<1)throw new Error('ISSUE_REQUIRED');
const pilot=process.env.RELAY_G9_PILOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'relay-g9-pilot-'));
const store=path.join(pilot,'relay-store');
fs.mkdirSync(store,{recursive:true,mode:0o700});
const data={schema:'relay-lab/g9-pilot-v0',pilot_dir:pilot,store,repo,issue};
fs.writeFileSync(path.join(pilot,'pilot.json'),JSON.stringify(data,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({
  ...data,
  sync_once:'npm run sync -- --repo '+repo+' --issue '+issue+' --store '+store,
  sync_watch:'npm run sync -- --repo '+repo+' --issue '+issue+' --store '+store+' --watch --interval-seconds 10',
  service_command:'RELAY_STORE='+store+' npm run service',
  ui_command:'RELAY_SERVICE_URL=http://127.0.0.1:4318 npm run ui',
  ui_url:'http://127.0.0.1:4317/',
  next:'Start sync watch + Service + service-backed UI. A valid Work comment should appear in Transport Inbox without running a manual import command.'
},null,2));
