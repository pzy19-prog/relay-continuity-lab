import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {create} from '../src/core.mjs';

test('explicit canonical task id is preserved and cannot collide',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'relay-canonical-id-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const repo=path.join(temp,'repo'),store=path.join(temp,'store');fs.mkdirSync(repo);
  const g=(...a)=>{const r=spawnSync('git',['-C',repo,...a],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  g('init','-q');g('config','user.name','Test');g('config','user.email','test@example.invalid');
  fs.writeFileSync(path.join(repo,'calc.mjs'),'export const x=1;\n');
  fs.writeFileSync(path.join(repo,'calc.test.mjs'),"import test from 'node:test';test('ok',()=>{});\n");
  g('add','.');g('commit','-qm','baseline');
  const id='R-G4-CHATWORK-CODEX-001';
  const task=create(store,{id,goal:'Synthetic',repo,actor:'local-agent',allowed:['calc.mjs'],testFile:'calc.test.mjs'});
  assert.equal(task.id,id);
  assert.throws(()=>create(store,{id,goal:'Duplicate',repo,actor:'local-agent',allowed:['calc.mjs'],testFile:'calc.test.mjs'}),/TASK_ID_EXISTS/);
});
