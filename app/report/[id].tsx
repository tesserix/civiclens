import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../src/session';
import { Button, Notice } from '../../src/ui';
import { request } from '../../src/api';
import { categoryLabels, type PublicationStatus, type Report } from '../../shared/contracts';

const statuses: Record<PublicationStatus,string> = { queued:'Queued for publishing', sending:'Sending', published:'Published', blocked:'On hold', failed:'Needs attention', uncertain:'Delivery needs checking' };
export default function Receipt() {
  const { session, loading } = useSession(); const { id } = useLocalSearchParams<{id:string}>(); const router = useRouter();
  const query = useQuery({ queryKey: ['report',session?.user.id,id], enabled: !!session && !!id,
    queryFn: ({ signal }) => request<Report>(`/v1/reports/${encodeURIComponent(id)}`,{ token:session?.token,signal }), refetchInterval:30_000 });
  if (!loading && !session) return <Redirect href="/" />;
  return <SafeAreaView className="flex-1 bg-canvas"><ScrollView contentContainerStyle={{ padding:24,gap:24 }}>
    <Button title="Back to my reports" secondary icon="arrow-back" onPress={() => router.replace('/(tabs)/reports')} />
    {query.isPending ? <ActivityIndicator color="#3858F5" /> : null}
    {query.isError ? <><Notice>{query.error.message}</Notice><Button title="Retry report" onPress={() => void query.refetch()} /></> : null}
    {query.data ? <><View className="gap-3 rounded-[28px] bg-primary p-6"><Ionicons name="checkmark-circle-outline" size={42} color="#EEF1FF" /><Text className="text-3xl font-bold text-white">Your report is received.</Text><Text className="text-sm leading-6 text-blue-100">Thanks for caring for your community. We’ll show each destination’s delivery status here.</Text></View>
      <View className="gap-3 rounded-3xl border border-line bg-white p-5"><Text className="text-xs uppercase tracking-widest text-muted">{categoryLabels[query.data.category]}</Text><Text className="text-xl font-semibold leading-8 text-ink">{query.data.description}</Text><Text className="text-sm text-muted">{query.data.location.locality} · {query.data.location.countryCode}</Text><Text className="text-sm text-primary">Public nickname: {query.data.nickname}</Text><Text className="text-xs text-muted">Reference {query.data.id.slice(0,8)}</Text></View>
      <View className="gap-3"><Text className="text-xl font-semibold text-ink">Responsible offices</Text><Text className="text-sm leading-6 text-muted">{query.data.routing.authorityNames.length ? query.data.routing.authorityNames.join(', ') : 'The local authority needs verification. Your report is safely held for review.'}</Text></View>
      <View className="gap-3"><Text className="text-xl font-semibold text-ink">Where your report stands</Text>{query.data.publications.map(p => <View key={p.channel} className="gap-2 rounded-2xl border border-line bg-white p-5"><View className="flex-row items-center justify-between"><Text className="text-base font-semibold capitalize text-ink">{p.channel}</Text><Text className="text-xs font-semibold text-primary">{statuses[p.status]}</Text></View>{p.reason ? <Text className="text-sm leading-6 text-muted">{p.reason}</Text> : null}{p.providerId ? <Text selectable className="text-xs text-muted">Provider reference: {p.providerId}</Text> : null}</View>)}</View>
      <Notice>Review and publication do not guarantee that an authority has seen or acted on the report. For urgent danger, contact local emergency services.</Notice>
    </> : null}
  </ScrollView></SafeAreaView>;
}
