import type { ReactNode } from 'react';
import { TextInput } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutSession } from '@sahhti/domain';
import type { PendingSetCommand } from '../offline/queue';
import WorkoutScreen from '../../app/workout/[id]';
const state=vi.hoisted(()=>({queue:[] as PendingSetCommand[],writes:0,seq:0,send:vi.fn(),release:null as null|(()=>void)}));
const session:WorkoutSession={id:'session-a',userId:'owner',name:'Synthetic strength',discipline:'powerlifting',status:'in_progress',scheduledFor:'2026-10-20T10:00:00Z',startedAt:'2026-10-20T10:00:00Z',completedAt:null,pauses:[],sets:[],plannedExercises:[{exerciseId:'exercise-a',prescription:{kind:'strength',sets:3,reps:8,restSeconds:60,loadGrams:null,rpeTenths:null}}]};
vi.mock('react-native',()=>({AppState:{currentState:'active',addEventListener:()=>({remove:()=>undefined})},Alert:{alert:vi.fn()},View:'View',Text:'Text',TextInput:'TextInput',Pressable:'Pressable'}));
vi.mock('expo-router',()=>({useLocalSearchParams:()=>({id:'session-a'}),useFocusEffect:()=>undefined,router:{push:vi.fn()}}));
vi.mock('expo-crypto',()=>({randomUUID:()=>`synthetic-${++state.seq}`}));
vi.mock('../storage/useFormRecovery',()=>({useFormRecovery:()=>({clear:async()=>undefined})}));
vi.mock('../auth/SessionProvider',()=>({useSession:()=>({tokens:{userId:'owner'}})}));
vi.mock('../i18n/LocaleProvider',()=>({useLocale:()=>({locale:'en',direction:'ltr'})}));
vi.mock('../theme/ThemeProvider',()=>({useTheme:()=>({})}));
vi.mock('../theme/motion',()=>({useMotion:()=>({reduce:true})}));
vi.mock('../ui/haptics',()=>({tapSuccess:()=>undefined}));
vi.mock('../ui/Screen',()=>({Screen:({children}:{children:ReactNode})=><>{children}</>,ScreenBody:({children,footer}:{children:ReactNode;footer:ReactNode})=><>{children}{footer}</>,Button:(props:object)=> <button {...props}/> }));
vi.mock('../ui/kit',()=>({AppHeader:()=>null,ErrorState:()=>null,LoadingSkeleton:()=>null,SurfaceCard:({children}:{children:ReactNode})=><>{children}</>}));
vi.mock('./MovementDemo3D',()=>({MovementDemo3D:()=>null}));
vi.mock('../ui/YazanCard',()=>({YazanCard:()=>null,openYazanWithPrompt:()=>undefined}));
vi.mock('../offline/resource',()=>({accountScope:()=> 'owner',accountResource:async()=>({session})}));
vi.mock('../offline/sqlite',()=>({
  readPendingSets:async()=>[...state.queue],enqueuePendingSet:async(_owner:string,command:PendingSetCommand)=>{state.writes++;state.queue.push(command);},
  acknowledgePendingSets:async(_owner:string,_snapshot:PendingSetCommand[],remaining:PendingSetCommand[])=>{state.queue=remaining;},
  readAccountSnapshot:async()=>null,writeAccountSnapshot:async()=>undefined,replaceConflictingSet:async()=>undefined,
}));
vi.mock('../api/client',()=>({ApiClientError:class extends Error{},apiRequest:async(path:string)=>{
  if(path.endsWith('/sets')){state.send();return new Promise(resolve=>{state.release=()=>resolve({});});}
  if(path==='/v1/exercises')return {exercises:[]};if(path==='/v1/progress')return {personalRecords:[]};return {session};
}}));
let renderer:TestRenderer.ReactTestRenderer|undefined;let client:QueryClient;
beforeEach(()=>{state.queue=[];state.writes=0;state.seq=0;state.send.mockClear();state.release=null;(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});client.setQueryData(['session','session-a','owner'],{session});client.setQueryData(['exercises'],{exercises:[]});client.setQueryData(['progress'],{personalRecords:[]});});
afterEach(async()=>{await act(async()=>renderer?.unmount());client.clear();});
describe('workout set interaction under slow network',()=>{
  it('records localized iPhone keyboard input as the intended reps and grams',async()=>{
    await act(async()=>{renderer=TestRenderer.create(<QueryClientProvider client={client}><WorkoutScreen/></QueryClientProvider>);});
    const inputs=renderer!.root.findAllByType(TextInput);
    await act(async()=>{inputs[0]!.props.onChangeText('١٢');inputs[1]!.props.onChangeText('٧٢٫٥');});
    const button=renderer!.root.findAllByType('button').find(button=>String(button.props.label).includes('·'))!;
    await act(async()=>button.props.onPress());
    expect(state.queue[0]?.set).toMatchObject({reps:12,loadGrams:72500});
  });
  it('rejects double taps, releases input after local durability, and accepts the next set while sync waits',async()=>{
    await act(async()=>{renderer=TestRenderer.create(<QueryClientProvider client={client}><WorkoutScreen/></QueryClientProvider>);});
    const save=()=>renderer!.root.findAllByType('button').find(button=>String(button.props.label).includes('·'))!;
    await act(async()=>{save().props.onPress();save().props.onPress();});
    expect(state.writes).toBe(1);expect(state.send).toHaveBeenCalledOnce();expect(save().props.disabled).toBe(false);
    await act(async()=>{save().props.onPress();});
    expect(state.writes).toBe(2);expect(state.queue.map(command=>command.set.setIndex)).toEqual([1,2]);expect(save().props.disabled).toBe(false);
  });
});

it('lets a member edit the final logged set instead of hiding save behind Next/Finish',async()=>{
  await act(async()=>{renderer=TestRenderer.create(<QueryClientProvider client={client}><WorkoutScreen/></QueryClientProvider>);});
  for(let i=0;i<3;i++){const save=renderer!.root.findAllByType('button').find(button=>button.props.testID==='workout-log-set')!;await act(async()=>save.props.onPress());}
  expect(renderer!.root.findAllByType('button').some(button=>button.props.testID==='workout-finish')).toBe(true);
  const row=renderer!.root.findAll(node=>node.props.accessibilityLabel==='Edit logged set 3'&&typeof node.props.onPress==='function')[0]!;
  await act(async()=>row.props.onPress());
  expect(renderer!.root.findAllByType('button').some(button=>button.props.testID==='workout-log-set')).toBe(true);
  expect(renderer!.root.findAllByType('button').some(button=>button.props.testID==='workout-finish')).toBe(false);
  expect(renderer!.root.findAllByType(TextInput)).toHaveLength(2);
});
