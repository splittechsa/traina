import { z } from 'zod';
const hash=z.string().regex(/^[0-9a-f]{64}$/);
const file=z.string().min(1).max(240).refine(value=>!value.includes('..')&&!value.includes('\\')&&!value.startsWith('/')&&!value.includes(':'));
const review=z.object({reviewer:z.string().min(3).max(120),at:z.string().datetime(),evidenceFile:file});
export const mediaAssetSchema=z.object({
  exerciseId:z.string().uuid(),revision:z.number().int().positive(),
  source:z.object({file,sha256:hash,bytes:z.number().int().positive().max(12*1024*1024),style:z.literal('realistic_muscular')}),
  clip:z.object({file,sha256:hash,bytes:z.number().int().positive().max(4*1024*1024),codec:z.literal('h264'),width:z.number().int().positive().max(720),height:z.number().int().positive().max(720),fps:z.number().min(24).max(30),durationSeconds:z.number().min(3).max(30)}),
  licensing:review.extend({status:z.literal('approved'),licenseId:z.string().min(2).max(80),url:z.string().url().refine(url=>url.startsWith('https://')),commercialUse:z.literal(true),redistribution:z.literal(true),attribution:z.string().min(1).max(300)}),
  technical:review.extend({status:z.literal('approved'),qualifiedExerciseProfessional:z.literal(true),cues:z.object({ar:z.array(z.string().min(3).max(240)).min(1).max(3),en:z.array(z.string().min(3).max(240)).min(1).max(3)})}),
}).strict();
export const mediaManifestSchema=z.object({version:z.literal(1),publicBaseUrl:z.string().url().refine(url=>url.startsWith('https://')&&url.endsWith('/')),assets:z.array(mediaAssetSchema).max(5)}).strict().superRefine((value,ctx)=>{
  if(new Set(value.assets.map(asset=>asset.exerciseId)).size!==value.assets.length)ctx.addIssue({code:'custom',message:'Duplicate exercise asset'});
  for(const asset of value.assets){
    if(asset.clip.file!==`apps/www/exercise-media/${asset.clip.sha256}.mp4`)ctx.addIssue({code:'custom',message:'Clip must use its content hash filename'});
    if(!asset.source.file.startsWith('media-source/'))ctx.addIssue({code:'custom',message:'Source must stay in media-source'});
    for(const approval of [asset.licensing,asset.technical]){
      if(!approval.evidenceFile.startsWith('media-source/reviews/'))ctx.addIssue({code:'custom',message:'Review evidence must remain private'});
      if(Date.parse(approval.at)>Date.now())ctx.addIssue({code:'custom',message:'Review cannot be in the future'});
    }
  }
});
export type MediaManifest=z.infer<typeof mediaManifestSchema>;
export function publicMedia(manifest:MediaManifest,exerciseId:string){
  const asset=manifest.assets.find(item=>item.exerciseId===exerciseId);if(!asset)return null;
  return {exerciseId,revision:asset.revision,kind:'reviewed_3d_render' as const,reviewStatus:'reviewed' as const,uri:manifest.publicBaseUrl+asset.clip.sha256+'.mp4',sha256:asset.clip.sha256,bytes:asset.clip.bytes,licenseId:asset.licensing.licenseId,licenseUrl:asset.licensing.url,attribution:asset.licensing.attribution,cues:asset.technical.cues};
}
