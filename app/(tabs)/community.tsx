import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommunityFeed } from '../../src/community-feed';
import { useSession } from '../../src/session';
export default function Community(){
  const {session}=useSession(),router=useRouter();
  if(!session)return null;
  return <SafeAreaView edges={['top','left','right']} className="flex-1 bg-canvas"><CommunityFeed key={session.user.id} userId={session.user.id} token={session.token} onDirectory={()=>router.push('/community/directory')} onCreate={()=>router.push('/community/new')} onSelect={id=>router.push(`/community/${id}`)}/></SafeAreaView>;
}
