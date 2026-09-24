#!/usr/bin/env node
import {serviceGet} from '../src/service-client.mjs';

const args=process.argv.slice(2);
const command=args.shift();
const id=args.shift();

let path;
if(command==='health')path='v1/health';
else if(command==='list')path='v1/tasks';
else if(command==='show'&&id)path='v1/tasks/'+encodeURIComponent(id);
else if(command==='checkpoint'&&id)path='v1/tasks/'+encodeURIComponent(id)+'/checkpoint';
else throw new Error('USAGE: service-query.mjs health|list|show <task-id>|checkpoint <task-id>');

console.log(JSON.stringify(await serviceGet(path),null,2));
