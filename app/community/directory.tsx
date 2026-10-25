import { DirectoryBrowser } from '../../src/directory-browser';
import { CivicFeatureGate } from '../../src/community-feed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/session';
export default function Directory(){const {session}=useSession();if(!session)return null;return <SafeAreaView edges={['left','right','bottom']} className="flex-1 bg-canvas"><CivicFeatureGate><DirectoryBrowser key={session.user.id} userId={session.user.id} token={session.token}/></CivicFeatureGate></SafeAreaView>;}
