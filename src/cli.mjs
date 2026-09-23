#!/usr/bin/env node
import fs from 'node:fs';
import {create,defaultStore,decide,handoff,list,load,receipt,resume,verify} from './core.mjs';
const argv=process.argv.slice(2);let store=defaultStore;
const pos=argv.indexOf('--store');if(pos>=0){store=argv[pos+1];argv.splice(pos,2);}
const [command,...rest]=argv;
function option(n,d){let i=rest.indexOf(n);return i>=0?rest[i+1]:d;}
function print(v){console.log(JSON.stringify(v,null,2));}
try {
  if(command==='create') print(create(store,{goal:option('--goal',''),repo:option('--repo','.'),actor:option('--actor','local-executor'),allowed:option('--allowed','').split(',').filter(Boolean),testFile:option('--test',''),constraints:option('--constraints','').split('|').filter(Boolean)}));
  else if(command==='list')print(list(store).map(t=>({id:t.id,goal:t.goal,state:t.state,owner:t.owner,next_action:t.next_action})));
  else if(command==='show')print(load(store,rest[0]));
  else if(command==='handoff')print(handoff(store,rest[0]));
  else if(command==='receipt')print(receipt(store,rest[0],JSON.parse(fs.readFileSync(option('--file',''),'utf8'))));
  else if(command==='verify')print(verify(store,rest[0]));
  else if(command==='decide')print(decide(store,rest[0],option('--decision','')));
  else if(command==='resume')print(resume(store,rest[0]));
  else throw new Error('USAGE: node src/cli.mjs [--store DIR] create --goal TEXT --repo REPO --allowed file1,file2 --test relative-test-file | list | show ID | handoff ID | receipt ID --file receipt.json | verify ID | decide ID --decision APPROVE|REJECT | resume ID');
} catch(e){console.error('RELAY_ERROR: '+e.message);process.exitCode=1;}
