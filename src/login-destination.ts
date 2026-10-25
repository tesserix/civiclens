import AsyncStorage from '@react-native-async-storage/async-storage';

const key='civiclens-login-destination-v1';
export type CommunityDestination=`/community/${string}`;
const allowed=(value:string):value is CommunityDestination=>/^\/community\/(?:new|directory|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(value);
let sequence:Promise<void>=Promise.resolve();
function serialized<T>(action:()=>Promise<T>):Promise<T>{const result=sequence.then(action);sequence=result.then(()=>{},()=>{});return result;}
export function rememberLoginDestination(path:string):Promise<void>{return serialized(async()=>{if(!allowed(path))throw new Error('Invalid login destination');await AsyncStorage.setItem(key,path);});}
export function readLoginDestination():Promise<CommunityDestination|null>{return serialized(async()=>{const value=await AsyncStorage.getItem(key);if(value!==null&&!allowed(value)){await AsyncStorage.removeItem(key);return null;}return value;});}
export function clearLoginDestination(path:string):Promise<void>{return serialized(async()=>{if(await AsyncStorage.getItem(key)===path)await AsyncStorage.removeItem(key);});}
