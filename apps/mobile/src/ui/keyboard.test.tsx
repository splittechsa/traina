import { afterEach, expect, it, vi } from 'vitest';
import TestRenderer, { act } from 'react-test-renderer';
import { createElement } from 'react';
import { useKeyboardInset } from './keyboard';
const native = vi.hoisted(() => ({ os: 'android', height: 900, frame: undefined as undefined | {height:number;screenY:number;width:number;screenX:number}, listeners: new Map<string,(event:unknown)=>void>() }));
vi.mock('react-native', () => ({
  Platform: { get OS() { return native.os; } },
  useWindowDimensions: () => ({height:native.height}),
  Keyboard: {metrics:()=>native.frame, addListener:(event:string,handler:(event:unknown)=>void)=>{native.listeners.set(event,handler);return {remove:()=>native.listeners.delete(event)};}},
}));
let tree: TestRenderer.ReactTestRenderer | undefined;
const inset = () => tree!.root.findByType('InsetValue' as never).props.value;
function Probe() { return createElement('InsetValue', {value:useKeyboardInset()}); }
async function mount() { (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true; await act(async()=>{tree=TestRenderer.create(<Probe/>);}); }
afterEach(async()=>{await act(async()=>tree?.unmount());native.os='android';native.height=900;native.frame=undefined;native.listeners.clear();});
it('lifts controls above an overlay keyboard and clears the inset on hide',async()=>{
  await mount();
  await act(async()=>native.listeners.get('keyboardDidShow')?.({endCoordinates:{height:300,screenY:600,width:400,screenX:0}}));
  expect(inset()).toBe(300);
  await act(async()=>native.listeners.get('keyboardDidHide')?.({}));expect(inset()).toBe(0);
});
it('does not add a second keyboard gap after Android resizes the window',async()=>{
  await mount();
  await act(async()=>native.listeners.get('keyboardDidShow')?.({endCoordinates:{height:300,screenY:600,width:400,screenX:0}}));
  native.height=600;await act(async()=>tree?.update(<Probe/>));expect(inset()).toBe(0);
});
it('restores an already visible keyboard when a composer mounts',async()=>{
  native.frame={height:300,screenY:600,width:400,screenX:0};await mount();expect(inset()).toBe(300);
});
it('preserves the iOS will-show height behavior',async()=>{
  native.os='ios';await mount();await act(async()=>native.listeners.get('keyboardWillShow')?.({endCoordinates:{height:320,screenY:580,width:400,screenX:0}}));expect(inset()).toBe(320);
});
