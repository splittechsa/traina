import { Text } from '../ui/Text';
import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { useEvent } from 'expo';
import { useIsFocused } from 'expo-router/react-navigation';
import { VideoView, useVideoPlayer, setVideoCacheSizeAsync } from 'expo-video';
import type { ApprovedDemo } from './media';
import { useLocale } from '../i18n/LocaleProvider';
import { useTheme } from '../theme/ThemeProvider';
let cacheSetup:Promise<void>|undefined;
/** Configure before creating any player. This is a preferred LRU bound, not guaranteed storage. */
export function prepareCache(){cacheSetup??=setVideoCacheSizeAsync(32*1024*1024).catch(error=>{cacheSetup=undefined;throw error;});return cacheSetup;}
export default function ApprovedVideo({asset}:{asset:ApprovedDemo}){
  const focused=useIsFocused(),theme=useTheme(),{locale}=useLocale();
  const player=useVideoPlayer({uri:asset.uri,useCaching:true},instance=>{instance.muted=true;instance.loop=false;instance.staysActiveInBackground=false;});
  const {status}=useEvent(player,'statusChange',{status:player.status});
  useEffect(()=>{if(!focused)player.pause();},[focused,player]);
  useEffect(()=>{const sub=AppState.addEventListener('change',state=>{if(state!=='active')player.pause();});return()=>sub.remove();},[player]);
  if(status==='error')return <Text style={{color:theme.textMuted}}>{locale==='ar'?'تعذر تشغيل العرض. يمكنك متابعة إرشادات الحركة.':'Playback is unavailable. You can continue with the technique instructions.'}</Text>;
  return <View><VideoView player={player} nativeControls contentFit="contain" allowsPictureInPicture={false} style={{height:220,width:'100%'}} accessibilityLabel={locale==='ar'?'عرض حركة التمرين':'Exercise demonstration'} /><Text style={{color:theme.textMuted,fontSize:11}}>{asset.attribution} · {asset.licenseId}</Text></View>;
}
