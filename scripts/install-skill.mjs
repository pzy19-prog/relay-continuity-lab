#!/usr/bin/env node
// Deliberately local-only installer. No remote downloads or automatic credentials.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (flag, fallback) => {
  const i = args.indexOf(flag);
  if (i < 0) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${flag}`);
  return args[i + 1];
};
const host = opt('--host', 'cursor');
const scope = opt('--scope', 'project');
const action = args.includes('--uninstall') ? 'uninstall' : args.includes('--status') ? 'status' : 'install';
const force = args.includes('--force');
if (!['cursor', 'codex'].includes(host)) throw new Error('Unsupported host');
if (!['user', 'project'].includes(scope)) throw new Error('Unsupported scope');
const projectDir = path.resolve(opt('--project-dir', process.cwd()));
if (scope === 'project' && (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory())) throw new Error('Project directory not found');
const customRoot = opt('--target-root', null);
if (customRoot && !path.isAbsolute(customRoot)) throw new Error('Target root must be absolute');
const skillsRoot = customRoot ? path.resolve(customRoot) : scope === 'project'
  ? path.join(projectDir, '.agents', 'skills')
  : path.join(os.homedir(), host === 'cursor' ? '.cursor' : '.agents', 'skills');
const dest = path.join(skillsRoot, 'relay-lab');
const names = ['SKILL.md', 'scripts/relay.mjs', 'vendor/core.mjs', 'vendor/cli.mjs'];
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const fail = text => { throw new Error(text); };
const readState = () => {
  if (!fs.existsSync(dest)) return {installed: false};
  if (fs.lstatSync(dest).isSymbolicLink() || !fs.lstatSync(dest).isDirectory()) fail('Refusing non-directory or symlink skill target');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(dest, 'INSTALL.json'), 'utf8')); }
  catch { return {installed: true, managed: false, clean: false}; }
  if (manifest.id !== 'relay-continuity-lab/relay-lab' || manifest.schema !== 1) return {installed: true, managed: false, clean: false};
  const allowed = new Set([...names, 'INSTALL.json']);
  const scan = dir => fs.readdirSync(dir, {withFileTypes:true}).every(d => {
    const rel=path.relative(dest,path.join(dir,d.name)).split(path.sep).join('/');
    if(d.isSymbolicLink()) return false;
    if(d.isDirectory()) return (rel==='scripts' || rel==='vendor') && scan(path.join(dir,d.name));
    return d.isFile() && allowed.has(rel);
  });
  const clean = scan(dest) && names.every(n => {
    const p = path.join(dest, n);
    return fs.existsSync(p) && fs.lstatSync(p).isFile() && !fs.lstatSync(p).isSymbolicLink() &&
      sha(p) === manifest.sha256?.[n];
  });
  return {installed: true, managed: true, clean, host: manifest.host, scope: manifest.scope};
};
const status = readState();
if (action === 'status') {
  console.log(JSON.stringify({dest, ...status}, null, 2));
  process.exit(status.installed && status.managed && status.clean ? 0 : 1);
}
if (action === 'uninstall') {
  if (!status.installed) { console.log(JSON.stringify({removed: false, reason: 'NOT_INSTALLED', dest})); process.exit(0); }
  if (!status.managed || (!status.clean && !force)) fail('Refuse removing unknown or modified Skill (only modified managed install may use --force)');
  fs.rmSync(dest, {recursive:true,force:false});
  console.log(JSON.stringify({removed:true,dest}));
  process.exit(0);
}
if (status.installed && (!status.managed || (!status.clean && !force))) fail('Existing Skill is unknown or modified; refuse overwrite');
// No implicit overwrite, even for an unmodified managed installation.
if (status.installed && !force) fail('Skill already installed; use --force to replace unchanged managed install');
fs.mkdirSync(skillsRoot, {recursive:true,mode:0o700});
const tmp = path.join(skillsRoot, `.relay-lab-install-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
const map = new Map([
  ['SKILL.md', 'skills/relay/SKILL.md'],
  ['scripts/relay.mjs', 'skills/relay/scripts/relay.mjs'],
  ['vendor/core.mjs','src/core.mjs'],
  ['vendor/cli.mjs','src/cli.mjs']
]);
try {
  fs.mkdirSync(tmp, {mode:0o700});
  const manifest = {schema:1,id:'relay-continuity-lab/relay-lab',host,scope,sha256:{}};
  for (const [target, origin] of map) {
    const to = path.join(tmp,target);fs.mkdirSync(path.dirname(to),{recursive:true});
    fs.copyFileSync(path.join(source,origin),to);
    manifest.sha256[target] = sha(to);
  }
  fs.writeFileSync(path.join(tmp,'INSTALL.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
  if(status.installed) fs.rmSync(dest,{recursive:true,force:false});
  fs.renameSync(tmp,dest);
} finally { if(fs.existsSync(tmp)) fs.rmSync(tmp,{recursive:true,force:true}); }
console.log(JSON.stringify({installed:true,dest,host,scope,entry:path.join(dest,'scripts','relay.mjs'),note:'Project installs modify the specified project. Use an isolated fixture for the first trial.'},null,2));
