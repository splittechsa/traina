import { z } from 'zod';
const text=z.string().min(1).max(300);
const schema=z.object({exerciseId:z.string().uuid(),revision:z.number().int().positive(),kind:z.literal('reviewed_3d_render'),reviewStatus:z.literal('reviewed'),uri:z.string().url(),sha256:z.string().regex(/^[0-9a-f]{64}$/),bytes:z.number().int().positive().max(4*1024*1024),licenseId:text,licenseUrl:z.string().url(),attribution:text,cues:z.object({ar:z.array(text).min(1).max(3),en:z.array(text).min(1).max(3)})});
export type ApprovedDemo=z.infer<typeof schema>;
export function approvedDemo(value:unknown,exerciseId:string):ApprovedDemo|null{
  const result=schema.safeParse(value);if(!result.success||result.data.exerciseId!==exerciseId)return null;
  try{const url=new URL(result.data.uri);const origin=process.env.EXPO_PUBLIC_MEDIA_ORIGIN??'https://traina-staging-www.vercel.app';if(url.origin!==origin||url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/exercise-media/'+result.data.sha256+'.mp4')return null;}catch{return null;}
  return result.data;
}
