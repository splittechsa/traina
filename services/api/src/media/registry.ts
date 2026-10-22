import source from './exercise-media.json' with { type:'json' };
import {mediaManifestSchema,publicMedia} from './policy.js';
const manifest=mediaManifestSchema.parse(source);
export const approvedExerciseMedia=(id:string)=>publicMedia(manifest,id);
export const reviewedMediaCoverage=()=>({reviewedExercises:manifest.assets.length,limit:5,status:manifest.assets.length?'PARTIAL':'BLOCKED_NO_REVIEWED_ASSETS'});
