import { expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { decodeHistoryPage, historyOptions, historyPlaceholder, type HistoryPage } from './history';
const page:HistoryPage={sessions:[],resume:null,featured:null,counts:{all:1000,strength:1000,crossfit:0,calisthenics:0},summary:{today:0,completed:1000,active:0},scheduledDays:[],pageInfo:{hasMore:false,nextCursor:null,previousCursor:null}};
vi.mock('../api/client',()=>({ApiClientError:class extends Error{constructor(_status:number,_code:string,message:string){super(message);}},apiRequest:async()=>page}));
vi.mock('../offline/resource',()=>({accountScope:()=>null,accountResource:async()=>page}));
it('keeps the observed history cache bounded as the user visits 50 pages',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const observer=new QueryObserver(client,historyOptions('account-a'));const unsubscribe=observer.subscribe(()=>{});
  for(let n=0;n<50;n++){observer.setOptions(historyOptions('account-a','all','cursor-'+n));await observer.refetch();await new Promise(resolve=>setTimeout(resolve,1));expect(client.getQueryCache().getAll().length).toBeLessThanOrEqual(2);}
  unsubscribe();client.clear();
});
it('does not carry placeholder history across accounts or filters',()=>{
  const placeholder=historyPlaceholder('account-b','all');
  expect(placeholder(page,{queryKey:['sessions','history','account-a','all']})).toBeUndefined();
  expect(placeholder(page,{queryKey:['sessions','history','account-b','strength']})).toBeUndefined();
  expect(placeholder(page,{queryKey:['sessions','history','account-b','all']})).toBe(page);
});
it('rejects legacy unbounded or malformed history before persistence/rendering',()=>{
  const row={id:'synthetic',name:'Synthetic',status:'completed',discipline:'powerlifting',scheduled_for:'2026-10-21',duration_seconds:1};
  expect(()=>decodeHistoryPage({...page,sessions:Array(1000).fill(row)})).toThrow('temporarily unavailable');
  expect(()=>decodeHistoryPage({sessions:[]})).toThrow();expect(decodeHistoryPage(page)).toEqual(page);
});
