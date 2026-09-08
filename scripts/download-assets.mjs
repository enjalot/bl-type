import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const release=JSON.parse(await readFile(resolve(root,'deploy/asset-release.json'),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function get(url){
 for(let attempt=0;attempt<3;attempt++){
  try{const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`HTTP ${response.status}: ${url}`);return Buffer.from(await response.arrayBuffer());}
  catch(error){if(attempt===2)throw error;}
 }
}
const manifestBytes=await get(release.manifest);
if(sha(manifestBytes)!==release.manifestSha256)throw Error('Release manifest checksum mismatch');
const manifest=JSON.parse(manifestBytes);
if(manifest.origin!==release.origin||manifest.files.length!==release.files)throw Error('Unexpected release manifest');
const files=manifest.files.filter(f=>!process.argv.includes('--data-only')||f.path.startsWith('data/'));
let next=0,done=0,downloaded=0;
await Promise.all(Array.from({length:12},async()=>{
 while(next<files.length){
  const file=files[next++];
  if(!/^(data|glyphs)\/[a-zA-Z0-9_.-]+$/.test(file.path))throw Error('Unsafe asset path');
  const target=resolve(root,'public',file.path);
  let existing;try{existing=await readFile(target);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(existing&&sha(existing)===file.sha256){done++;continue;}
  if(existing&&!process.argv.includes('--force'))throw Error(`Local asset differs: ${file.path}. Use --force to replace it.`);
  const bytes=await get(release.origin+'/'+file.path);
  if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw Error('Asset checksum mismatch: '+file.path);
  await mkdir(dirname(target),{recursive:true});await writeFile(target+'.download',bytes);await rename(target+'.download',target);
  done++;downloaded++;
  if(done%1000===0)console.log(`${done}/${files.length} assets ready`);
 }
}));
console.log(`${done} verified assets ready; ${downloaded} downloaded from ${release.release}.`);
