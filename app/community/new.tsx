import { useRouter } from 'expo-router';
import { CommunityCreate } from '../../src/community-create';
import { CommunityPage } from '../../src/community-page';
import { useSession } from '../../src/session';
import { useParticipation } from '../../src/community-feed';
export default function NewRequest(){
  const {session}=useSession(),router=useRouter(),features=useParticipation();
  if(!session)return null;
  return <CommunityPage><CommunityCreate key={session.user.id} userId={session.user.id} token={session.token} topicsEnabled={features.data?.communityDiscovery===true} onCreated={id=>router.replace(`/community/${id}`)}/></CommunityPage>;
}
