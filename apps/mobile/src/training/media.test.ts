import {expect,it} from 'vitest';
import {approvedDemo} from './media';
const id='10000000-0000-4000-8000-000000000001',hash='a'.repeat(64);
const asset={exerciseId:id,revision:1,kind:'reviewed_3d_render',reviewStatus:'reviewed',uri:`https://traina-staging-www.vercel.app/exercise-media/${hash}.mp4`,sha256:hash,bytes:100,licenseId:'Synthetic test',licenseUrl:'https://example.invalid/license',attribution:'Synthetic only',cues:{ar:['اختبار'],en:['Test']}};
it('never activates unreviewed, wrong-exercise, mutable or foreign-origin media',()=>{
  expect(approvedDemo(asset,id)).not.toBeNull();
  for(const value of [{...asset,reviewStatus:'unreviewed'},{...asset,exerciseId:'20000000-0000-4000-8000-000000000002'},{...asset,uri:'https://attacker.invalid/file.mp4'},{...asset,uri:asset.uri+'?mutable=true'},{...asset,bytes:20*1024*1024}])expect(approvedDemo(value,id)).toBeNull();
  expect(approvedDemo(null,id)).toBeNull();
});
