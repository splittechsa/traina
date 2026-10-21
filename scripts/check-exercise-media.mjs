import {readFile,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mediaManifestSchema} from '../services/api/dist/media/policy.js';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const manifest=mediaManifestSchema.parse(JSON.parse(await readFile(resolve(root,'services/api/src/media/exercise-media.json'),'utf8')));
async function local(file){const target=await realpath(resolve(root,file));const rel=relative(root,target);if(rel.startsWith('..')||isAbsolute(rel))throw Error('MEDIA_PATH_ESCAPE');return target;}
async function checkBlob(blob){const data=await readFile(await local(blob.file));if(data.length!==blob.bytes||createHash('sha256').update(data).digest('hex')!==blob.sha256)throw Error('MEDIA_HASH_OR_SIZE_MISMATCH');return data;}
for(const asset of manifest.assets){
  const source=await checkBlob(asset.source);if(source.toString('ascii',0,4)!=='glTF'||source.readUInt32LE(4)!==2||source.readUInt32LE(8)!==source.length)throw Error('INVALID_SELF_CONTAINED_GLB');
  const chunkLength=source.readUInt32LE(12);const gltf=JSON.parse(source.toString('utf8',20,20+chunkLength));
  if((gltf.buffers??[]).some(item=>item.uri)||(gltf.images??[]).some(item=>item.uri))throw Error('EXTERNAL_GLB_DEPENDENCY');
  const vertices=(gltf.meshes??[]).flatMap(mesh=>mesh.primitives??[]).reduce((sum,primitive)=>sum+(gltf.accessors?.[primitive.attributes?.POSITION]?.count??0),0);if(vertices>80000)throw Error('GLB_VERTEX_BUDGET');
  await checkBlob(asset.clip);
  for(const review of [asset.licensing,asset.technical])if(!(await readFile(await local(review.evidenceFile))).length)throw Error('EMPTY_REVIEW_EVIDENCE');
  const probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',await local(asset.clip.file)],{encoding:'utf8'}));
  const video=probe.streams.find(stream=>stream.codec_type==='video');const [a,b]=String(video?.avg_frame_rate).split('/').map(Number);const fps=a/b;
  if(!video||video.codec_name!=='h264'||video.width!==asset.clip.width||video.height!==asset.clip.height||Math.abs(fps-asset.clip.fps)>0.1||Math.abs(Number(probe.format.duration)-asset.clip.durationSeconds)>0.2||probe.streams.some(stream=>stream.codec_type==='audio'))throw Error('MEDIA_TRANSCODE_BUDGET');
}
console.log(JSON.stringify({reviewedExercises:manifest.assets.length,coverage:manifest.assets.length?'PARTIAL':'BLOCKED_NO_REVIEWED_ASSETS',checks:'license + technical evidence + GLB + SHA256 + ffprobe budgets; no animation coverage implied'}));
