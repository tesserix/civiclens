import { Text } from './text';
import { useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { AdministrativePage, AdministrativeUnit } from '../shared/contracts';
import { ApiError, request } from './api';
import { Button, Field, Loading, Title } from './ui';
import { CommunitySelect } from './community-select';
import { Card, CivicNotice } from './community-ui';

const countries=[{code:'AU',label:'🇦🇺 Australia'},{code:'IN',label:'🇮🇳 India'},{code:'NZ',label:'🇳🇿 New Zealand'},{code:'NP',label:'🇳🇵 Nepal'}];
const roots:Record<string,string>={AU:'statistical_area',IN:'state',NP:'province',NZ:'council'};
const labels:Record<string,string>={country:'Country',state:'State / union territory',province:'Province',region:'Region',district:'District',municipality:'Local body',council:'Council',protected_area:'Other administrative area',statistical_area:'Statistical local government area'};
export function DirectoryBrowser({userId,token,initialCountry='AU'}:{userId:string;token:string;initialCountry?:string}){
  const [country,setCountry]=useState(initialCountry),[parents,setParents]=useState<AdministrativeUnit[]>([]),[selected,setSelected]=useState<AdministrativeUnit|null>(null);
  const [search,setSearch]=useState(''),[q,setQ]=useState(''),[linkError,setLinkError]=useState('');
  useEffect(()=>{const timer=setTimeout(()=>setQ(search.trim()),300);return()=>clearTimeout(timer);},[search]);
  const parent=parents[parents.length-1],level=parent?parent.level==='district'?'municipality':'district':roots[country];
  const query=useInfiniteQuery({queryKey:['administrative-directory',userId,country,parent?.id,level,q],initialPageParam:null as string|null,queryFn:({pageParam,signal})=>{
    const p=new URLSearchParams({countryCode:country});if(q)p.set('q',q);else{p.set('level',level);if(parent)p.set('parentId',parent.id);}if(pageParam)p.set('before',pageParam);
    return request<AdministrativePage>(`/v1/directory/units?${p}`,{token,signal});},getNextPageParam:last=>last.nextCursor??undefined});
  const choose=(unit:AdministrativeUnit)=>{
    setLinkError('');
    if(['country','state','province','district'].includes(unit.level)){
      const next=unit.level==='country'?[]:q?[unit]:[...parents,unit];setParents(next);setSearch('');setQ('');
    }else setSelected(unit);
  };
  const open=async(value:string)=>{setLinkError('');try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw new Error('Invalid link');await Linking.openURL(value);}catch{setLinkError('Could not open this source link. Please try again.');}};
  if(selected)return <ScrollView contentContainerStyle={{padding:20,gap:16,paddingBottom:40}}><Button title="Back to directory" variant="secondary" onPress={()=>setSelected(null)}/><Card><Text className="text-xs font-semibold uppercase text-brand">{labels[selected.level]??selected.level}</Text><Title>{selected.name}</Title><Text className="text-sm text-muted">{selected.countryCode} · Code {selected.officialCode??selected.id}</Text><CivicNotice>Reference directory entry. Check the responsible body and its official contact page before filing. Automatic filing requires a separately verified channel and your confirmation.</CivicNotice><Text className="text-base font-semibold text-ink">Complaint API: {selected.complaintApiStatus==='documented'?'Documented; authorization required':selected.complaintApiStatus==='not_offered'?'Not offered by the provider':'Not verified'}</Text>
    {selected.districtCoverage==='needs_review'?<CivicNotice tone="warning">District links need review. This body remains listed under the state provided by LGD.</CivicNotice>:null}
    {selected.districtIds.length>1?<Text className="text-sm text-muted">Listed across {selected.districtIds.length} districts.</Text>:null}
    {selected.contactUrl?<Button title="Open listed contact page" onPress={()=>void open(selected.contactUrl!)}/>:null}
    {selected.officialUrl?<Button title="Open listed website" variant="secondary" onPress={()=>void open(selected.officialUrl!)}/>:null}
    <Button title="Open source directory" variant="secondary" onPress={()=>void open(selected.evidenceUrl)}/>
    <Text selectable className="text-xs leading-5 text-muted">{selected.attribution}</Text><Text className="text-xs text-muted">Retrieved {new Date(selected.retrievedAt).toLocaleDateString()}</Text><Button title="Read source licence" variant="quiet" onPress={()=>void open(selected.licenceUrl)}/>{linkError?<CivicNotice tone="warning">{linkError}</CivicNotice>:null}</Card></ScrollView>;
  return <FlatList key={`${country}:${parent?.id??'root'}`} style={{flex:1}} data={query.data?.pages.flatMap(p=>p.items)??[]} keyExtractor={u=>`${u.sourceId}:${u.id}`} contentContainerStyle={{padding:20,gap:12,flexGrow:1,paddingBottom:40}} ListHeaderComponent={<View className="gap-4 pb-2"><Title subtitle="Find source-backed local bodies and the places they list for contacting them.">Councils & contacts</Title><CommunitySelect label="Country" value={country} options={countries.map(c=>({id:c.code,label:c.label}))} onChange={code=>{setCountry(code);setParents([]);setSelected(null);setSearch('');setQ('');}}/><CivicNotice>Directory coverage and verified complaint routing are tracked separately. Source records retain their official codes and review status.</CivicNotice>{parents.length?<View className="gap-2"><Text className="text-sm font-semibold text-ink">{parents.map(p=>p.name).join(' / ')}</Text><Button title="Back one level" variant="quiet" compact onPress={()=>{setParents(p=>p.slice(0,-1));setSearch('');setQ('');}}/></View>:null}<Field label="Search directory" value={search} maxLength={80} onChangeText={setSearch} placeholder="Search body, district or region name"/>{query.isError?<><CivicNotice tone="warning">{query.error instanceof ApiError?query.error.message:'Could not load the directory. Please retry.'}</CivicNotice><Button title="Retry directory" variant="secondary" onPress={()=>void query.refetch()}/></>:null}</View>} ListEmptyComponent={query.isPending?<Loading label="Loading source directory…"/>:!query.isError?<CivicNotice>No matching source records. Try another name or country.</CivicNotice>:null} ListFooterComponent={query.hasNextPage?<Button title="Load more places" variant="secondary" busy={query.isFetchingNextPage} onPress={()=>void query.fetchNextPage()}/>:null} renderItem={({item})=><Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.name}`} onPress={()=>choose(item)} style={({pressed})=>({opacity:pressed?0.7:1})}><Card><Text className="text-base font-semibold text-ink">{item.name}</Text><Text className="text-xs leading-5 text-muted">{labels[item.level]??item.level} · {item.officialCode??item.id}</Text><Text className="text-xs text-muted">Reference · {item.complaintApiStatus==='unknown'?'Complaint API needs verification':item.complaintApiStatus}</Text></Card></Pressable>}/>;
}
