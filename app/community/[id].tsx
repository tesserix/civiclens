import { useLocalSearchParams } from 'expo-router';
import { CommunityDetail } from '../../src/community-detail';
import { CommunityPage } from '../../src/community-page';
import { useSession } from '../../src/session';
import { CivicNotice } from '../../src/community-ui';
export default function CommunityRequest(){
  const {session}=useSession(),{id}=useLocalSearchParams<{id:string}>();
  if(!session)return null;
  return <CommunityPage>{typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id)?<CommunityDetail key={`${session.user.id}:${id}`} id={id} userId={session.user.id} token={session.token}/>:<CivicNotice tone="warning">This request link is invalid.</CivicNotice>}</CommunityPage>;
}
