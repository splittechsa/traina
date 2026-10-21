import { View, TextInput, Pressable } from 'react-native';
import { Text } from '../ui/Text';
import { useLocale } from '../i18n/LocaleProvider';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, radius } from '../theme/tokens';
import { normalizeWorkoutNumber } from './numericInput';
export function SetInputs({reps,load,weighted,onReps,onLoad}:{reps:string;load:string;weighted:boolean;onReps:(value:string)=>void;onLoad:(value:string)=>void}) {
  const {locale,direction}=useLocale(),theme=useTheme(),ar=locale==='ar';
  const fields=[{id:'reps',label:ar?'التكرارات':'Repetitions',value:reps,change:onReps,step:1,min:1},...(weighted?[{id:'load',label:ar?'الوزن (كغ)':'Weight (kg)',value:load,change:onLoad,step:2.5,min:0}]:[])];
  return <View style={{flexDirection:'row',direction,gap:12,marginVertical:12}}>
    {fields.map(field=><View key={field.id} style={{flex:1,minWidth:0,gap:6}}>
      <Text style={{color:theme.textMuted}}>{field.label}</Text>
      <TextInput testID={'workout-'+field.id} accessibilityLabel={field.label} value={field.value} onChangeText={value=>field.change(normalizeWorkoutNumber(value))} keyboardType={field.id==='reps'?'number-pad':'decimal-pad'} selectTextOnFocus style={{minHeight:48,borderRadius:radius.md,borderWidth:1,borderColor:theme.border,color:theme.text,fontFamily:fontFamily.semibold,textAlign:'center',writingDirection:'ltr',fontSize:22,paddingHorizontal:8}} />
      <View style={{flexDirection:'row',direction:'ltr',gap:6}}>{[-1,1].map(sign=><Pressable key={sign} accessibilityRole="button" accessibilityLabel={(sign<0?(ar?'تقليل ':'Decrease '):(ar?'زيادة ':'Increase '))+field.label+' '+field.step} onPress={()=>field.change(String(Math.max(field.min,(Number(normalizeWorkoutNumber(field.value))||0)+sign*field.step)))} style={{flex:1,minHeight:44,alignItems:'center',justifyContent:'center',backgroundColor:theme.surfaceMuted,borderRadius:radius.md}}><Text style={{color:theme.text,textAlign:'center',writingDirection:'ltr'}}>{sign<0?'−':'+'}{field.step}</Text></Pressable>)}</View>
    </View>)}
  </View>;
}
