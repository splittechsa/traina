import {expect,it,vi} from 'vitest';
import TestRenderer,{act} from 'react-test-renderer';
import {Text} from './Text';
const locale=vi.hoisted(()=>({value:'ar'}));
vi.mock('react-native',()=>({Text:'NativeText'}));
vi.mock('../i18n/LocaleProvider',()=>({useLocale:()=>({locale:locale.value})}));
it('aligns mixed Arabic/Latin content at the locale start without reversing content',async()=>{(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;let tree!:TestRenderer.ReactTestRenderer;const content='أحمد · Ahmed 72.5 kg';await act(async()=>{tree=TestRenderer.create(<Text>{content}</Text>);});const t=tree.root.findByType('NativeText' as never);expect(t.props.style[0]).toMatchObject({direction:'ltr',textAlign:'right',writingDirection:'auto'});expect(t.props.children).toBe(content);await act(async()=>tree.unmount());});
it('preserves explicit centered numerals and uses left alignment in English',async()=>{locale.value='en';let tree!:TestRenderer.ReactTestRenderer;await act(async()=>{tree=TestRenderer.create(<Text style={{textAlign:'center'}}>12</Text>);});const t=tree.root.findByType('NativeText' as never);expect(t.props.style[0].textAlign).toBe('left');expect(t.props.style.at(-1).textAlign).toBe('center');await act(async()=>tree.unmount());});
