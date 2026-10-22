import {expect,it} from 'vitest';
import {mediaAssetSchema,mediaManifestSchema,publicMedia} from './policy.js';
const hash='a'.repeat(64);
const asset={exerciseId:'10000000-0000-4000-8000-000000000001',revision:1,source:{file:'media-source/synthetic.glb',sha256:hash,bytes:500,style:'realistic_muscular'},clip:{file:`apps/www/exercise-media/${hash}.mp4`,sha256:hash,bytes:500,codec:'h264',width:720,height:720,fps:30,durationSeconds:8},licensing:{status:'approved',reviewer:'Synthetic reviewer',at:'2026-01-01T00:00:00Z',evidenceFile:'media-source/reviews/license.txt',licenseId:'LicenseRef-Synthetic-Test',url:'https://example.invalid/license',commercialUse:true,redistribution:true,attribution:'Synthetic test only'},technical:{status:'approved',reviewer:'Synthetic coach',at:'2026-01-01T00:00:00Z',evidenceFile:'media-source/reviews/technical.txt',qualifiedExerciseProfessional:true,cues:{ar:['إرشاد اصطناعي للاختبار فقط'],en:['Synthetic test cue only']}}};
it('requires explicit licensing and qualified technical review before publication',()=>{
  expect(mediaAssetSchema.safeParse({...asset,licensing:{...asset.licensing,redistribution:false}}).success).toBe(false);
  expect(mediaAssetSchema.safeParse({...asset,technical:{...asset.technical,status:'unreviewed'}}).success).toBe(false);
  expect(mediaAssetSchema.safeParse({...asset,technical:{...asset.technical,qualifiedExerciseProfessional:false}}).success).toBe(false);
});
it('enforces bounded clips, immutable filenames and unique exercise coverage',()=>{
  const manifest={version:1,publicBaseUrl:'https://traina-staging-www.vercel.app/exercise-media/',assets:[asset]};
  expect(mediaManifestSchema.safeParse(manifest).success).toBe(true);
  expect(mediaManifestSchema.safeParse({...manifest,assets:[asset,asset]}).success).toBe(false);
  expect(mediaManifestSchema.safeParse({...manifest,assets:[{...asset,clip:{...asset.clip,bytes:20*1024*1024}}]}).success).toBe(false);
  expect(mediaManifestSchema.safeParse({...manifest,assets:[{...asset,source:{...asset.source,file:'../outside.glb'}}]}).success).toBe(false);
  const parsed=mediaManifestSchema.parse(manifest);const result=publicMedia(parsed,asset.exerciseId);expect(result).not.toHaveProperty('technical');expect(result).not.toHaveProperty('reviewer');expect(result?.uri).toContain(hash+'.mp4');expect(publicMedia(parsed,'unknown')).toBeNull();
});
