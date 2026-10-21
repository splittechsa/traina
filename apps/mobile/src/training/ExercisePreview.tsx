import {useState,type ComponentType} from 'react';
import {Text,View} from 'react-native';
import {Button} from '../ui/Screen';
import {useLocale} from '../i18n/LocaleProvider';
import {useTheme} from '../theme/ThemeProvider';
import {approvedDemo,type ApprovedDemo} from './media';
import {asLibraryList} from './library';
export function ExercisePreview({exerciseId,asset,instructions,reviewed=false}:{exerciseId:string;asset:unknown;instructions:string[]|string|undefined;reviewed?:boolean}){
  const {locale}=useLocale(),theme=useTheme(),ar=locale==='ar';
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false);
  const [Player,setPlayer]=useState<ComponentType<{asset:ApprovedDemo}>|null>(null);
  const valid=approvedDemo(asset,exerciseId),cues=valid?.cues[locale]??asLibraryList(instructions).slice(0,3);
  async function activate(){if(!valid||busy)return;setBusy(true);try{const module=await import('./ApprovedVideo');await module.prepareCache();setPlayer(()=>module.default);setFailed(false);}catch{setFailed(true);}finally{setBusy(false);}}
  return <View style={{marginVertical:8,gap:8}}>
    <Button variant="secondary" label={open?(ar?'إخفاء إرشادات الحركة':'Hide technique'):(ar?'إرشادات الحركة':'Technique')} onPress={()=>setOpen(value=>!value)} />
    {open?<>
      {valid&&!Player?<Button variant="secondary" disabled={busy} label={busy?(ar?'جارٍ التحميل…':'Loading…'):(ar?'شاهد العرض':'View demonstration')} onPress={()=>void activate()} />:null}
      {Player&&valid?<Player asset={valid}/>:null}
      {!valid||failed?<Text style={{color:theme.textMuted,fontSize:12}}>{ar?'لا يتوفر عرض حركي معتمد لهذا التمرين حاليًا.':'A reviewed movement demonstration is not available for this exercise yet.'}</Text>:null}
      {cues.map((cue,index)=><Text key={index} style={{color:theme.text,lineHeight:22,textAlign:ar?'right':'left'}}>{index+1}. {cue}</Text>)}
      {!valid&&!reviewed?<Text style={{color:theme.textMuted,fontSize:11}}>{ar?'إرشادات المكتبة لم تُعتمد مهنيًا بعد. اطلب مساعدة مدرب إذا لم تكن الحركة واضحة.':'Library guidance has not been professionally approved yet. Ask a coach if the movement is unclear.'}</Text>:null}
    </>:null}
  </View>;
}
