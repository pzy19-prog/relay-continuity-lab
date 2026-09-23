#!/usr/bin/env node
// Installed Skill delegates to copied CLI/Core; the user's task state is in RELAY_STORE.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const cli = fileURLToPath(new URL('../vendor/cli.mjs', import.meta.url));
const res=spawnSync(process.execPath, [cli,...process.argv.slice(2)], {stdio:'inherit',cwd:process.cwd(),env:process.env});
if(res.error){console.error(res.error.message);process.exitCode=1;}
else process.exitCode = res.status === null ? 1 : res.status;
