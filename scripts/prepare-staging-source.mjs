import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('..', import.meta.url)); const mode = process.argv[2]; const target = resolve(process.argv[3] ?? '');
if (!['api','mobile'].includes(mode) || !process.argv[3] || target === resolve(root)) throw new Error('DEDICATED_OUTPUT_DIRECTORY_REQUIRED');
mkdirSync(target, { recursive: true }); const files = ['package.json','package-lock.json','tsconfig.base.json'];
function walk(relative) { for (const item of readdirSync(resolve(root, relative), { withFileTypes: true })) {
  if (['node_modules','.expo','.git','.vercel','android','ios','dist','work'].includes(item.name) || item.name.startsWith('.env') || /\.(db|sqlite|dpapi|jks|p12|mobileprovision)$/.test(item.name)) continue;
  const file = relative + '/' + item.name; if (item.isDirectory()) walk(file); else files.push(file);
} }
for (const workspace of ['services/api','packages/domain','packages/contracts','packages/design-tokens']) { files.push(workspace+'/package.json',workspace+'/tsconfig.json'); walk(workspace+'/src'); }
if (mode === 'api') { files.push('api/index.mjs','public/index.html'); }
else { walk('apps/mobile'); }
for (const file of [...new Set(files)]) { mkdirSync(dirname(resolve(target,file)),{recursive:true}); cpSync(resolve(root,file),resolve(target,file)); }
if (mode === 'api') { cpSync(resolve(root,'vercel.api.json'),resolve(target,'vercel.json')); mkdirSync(resolve(target,'.vercel'),{recursive:true}); cpSync(resolve(root,'.vercel/project.json'),resolve(target,'.vercel/project.json')); }
if (mode === 'mobile') cpSync(resolve(root,'.easignore'),resolve(target,'.easignore'));
const evidence = { at:new Date().toISOString(),mode,scope:'Explicit source/assets allowlist; no environments, credentials, databases, caches or generated native folders copied',files:[...new Set(files)].map(file=>({file,bytes:statSync(resolve(target,file)).size,sha256:createHash('sha256').update(readFileSync(resolve(target,file))).digest('hex')})) };
writeFileSync(resolve(target,'source-manifest.json'),JSON.stringify(evidence,null,2)); console.log(JSON.stringify({mode,files:evidence.files.length,bytes:evidence.files.reduce((total,file)=>total+file.bytes,0)}));
