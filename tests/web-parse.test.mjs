import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('web UI entrypoint parses before release',()=>{
  const r=spawnSync(process.execPath,['--check',path.join(root,'src/web.mjs')],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr||r.stdout);
});
