import AsyncStorage from '@react-native-async-storage/async-storage';
import { civicTopics, type CivicCardInput } from '../shared/contracts';

export type CivicDraft={version:1;key:string;input:CivicCardInput};
const queues=new Map<string,Promise<void>>();
const storageKey=(account:string)=>`civiclens-civic-draft-v1:${encodeURIComponent(account)}`;
function serialized<T>(account:string,action:()=>Promise<T>):Promise<T>{
  const previous=queues.get(account)??Promise.resolve();
  const next=previous.then(action),tail=next.then(()=>{},()=>{});
  queues.set(account,tail);
  void tail.then(()=>{if(queues.get(account)===tail)queues.delete(account);});
  return next;
}
function parse(text:string):CivicDraft{
  const raw:unknown=JSON.parse(text);
  if(!raw||typeof raw!=='object')throw new Error('Invalid draft');
  const value=raw as Partial<CivicDraft>,input=value.input;
  if(value.version!==1||typeof value.key!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.key)||!input||!['request','poll'].includes(input.kind)
    ||typeof input.title!=='string'||input.title.length>720||typeof input.body!=='string'||input.body.length>16000
    ||typeof input.locality!=='string'||input.locality.length>480||typeof input.countryCode!=='string'||!/^[A-Z]{2}$/.test(input.countryCode)
    ||typeof input.closesAt!=='string'||!Number.isFinite(Date.parse(input.closesAt))||typeof input.rulesVersion!=='string'||typeof input.consent!=='boolean'||(input.topic!==undefined&&!civicTopics.some(t=>t.id===input.topic)))throw new Error('Invalid draft');
  return {version:1,key:value.key,input:{kind:input.kind,title:input.title,body:input.body,countryCode:input.countryCode,locality:input.locality,closesAt:input.closesAt,rulesVersion:input.rulesVersion,consent:false,...(input.topic===undefined?{}:{topic:input.topic})}};
}
export function loadCivicDraft(account:string):Promise<CivicDraft|null>{return serialized(account,async()=>{
  try{const saved=await AsyncStorage.getItem(storageKey(account));return saved===null?null:parse(saved);}catch{throw new Error('Could not restore your saved request. Retry or discard the saved draft.');}
});}
export function saveCivicDraft(account:string,draft:CivicDraft):Promise<void>{return serialized(account,()=>AsyncStorage.setItem(storageKey(account),JSON.stringify(draft)));}
export function clearCivicDraft(account:string):Promise<void>{return serialized(account,()=>AsyncStorage.removeItem(storageKey(account)));}
