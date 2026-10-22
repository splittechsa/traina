/** Opt-in, bounded diagnostics. Never record tokens, bodies, query strings or member IDs. */
type Event = { at: number; kind: string; name: string; duration?: number; status?: number };
type Fiber = { child?: Fiber; sibling?: Fiber; memoizedProps?: Record<string, unknown> };
type Lab = {
  enter?: (tokens: {accessToken:string;refreshToken:string;userId?:string})=>Promise<void>;
  leave?: ()=>Promise<void>; refresh?:()=>Promise<void>; capture?:()=>Promise<string>; navigate?:(path:string)=>void;
  press?:(id:string)=>void; input?:(id:string,value:string)=>void;
  start:()=>void; stop:()=>{events:Event[];scope:string}; mark:(kind:string,name:string,duration?:number,status?:number)=>void;
};
type Host = {__trainaLab?:Lab;__trainaSynthetic?:boolean;__REACT_DEVTOOLS_GLOBAL_HOOK__?:{renderers:Map<number,unknown>;getFiberRoots:(id:number)=>Set<{current:Fiber}>}};
const host=globalThis as unknown as Host;
let enabled=false;let events:Event[]=[];let timer:ReturnType<typeof setInterval>|undefined;
const now=()=>performance.now();
export function perfMark(kind:string,name:string,duration?:number,status?:number){
  if(!enabled)return;events.push({at:now(),kind,name,duration,status});if(events.length>1000)events.splice(0,events.length-1000);
}
export function safeResource(path:string){return path.split('?')[0]!.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,':id').replace(/\/\d+(?=\/|$)/g,'/:n');}
export function attachPerformanceLab(){
  if(!__DEV__)return;

  host.__trainaLab={...host.__trainaLab,start(){if(!host.__trainaSynthetic)throw Error('SYNTHETIC_SESSION_REQUIRED');events=[];enabled=true;clearInterval(timer);let previous=now();timer=setInterval(()=>{const next=now();perfMark('js.timer-gap','100ms timer',Math.max(0,next-previous-100));previous=next;},100);},
    stop(){enabled=false;clearInterval(timer);return {events:[...events],scope:'JS timer lag and React commits; not native UI FPS, process memory, native cold startup or crash-free-rate'};},mark:perfMark};
}
export function lab(){return host.__trainaLab;}
export function synthetic(value:boolean){host.__trainaSynthetic=value;}
export function requireSynthetic(){if(!host.__trainaSynthetic)throw Error('SYNTHETIC_SESSION_REQUIRED');}
/** Invoke instrumented controls on the real native React tree, only inside an operator-selected synthetic session. */
export function invokeControl(id:string,method:'onPress'|'onChangeText',value?:string){
  requireSynthetic();const hook=host.__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!hook)throw Error('REACT_INSPECTOR_REQUIRED');
  for(const renderer of hook.renderers.keys())for(const root of hook.getFiberRoots(renderer)){
    const stack=[root.current];let visits=0;
    while(stack.length && visits++<30000){const fiber=stack.pop()!;const props=fiber.memoizedProps;
      if(props?.testID===id && typeof props[method]==='function'){
        if(props.disabled)throw Error('CONTROL_DISABLED');(props[method] as (value?:string)=>void)(value);return;
      }
      if(fiber.sibling)stack.push(fiber.sibling);if(fiber.child)stack.push(fiber.child);
    }
  }
  throw Error('CONTROL_NOT_FOUND:'+id);
}
