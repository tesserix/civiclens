import { Text } from '../../src/text';
import { ScrollView, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../src/session';
import { Button, Loading, Notice, Status, categoryIcons, channelIcons, cardShadow, palette } from '../../src/ui';
import {ComplaintFlow} from '../../src/complaint-flow';
import {UserSharing} from '../../src/user-sharing';
import { request } from '../../src/api';
import { categoryLabels, channelLabels, type PublicationStatus, type Report } from '../../shared/contracts';

const statuses: Record<PublicationStatus, [string, string]> = {
  queued: ['Queued for publishing', palette.faint], sending: ['Sending', palette.hivis], published: ['Published', palette.brand],
  blocked: ['On hold', palette.caution], failed: ['Needs attention', palette.danger], uncertain: ['Delivery needs checking', palette.caution],
};

export default function Receipt() {
  const { session, loading } = useSession(); const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter();
  const query = useQuery({ queryKey: ['report', session?.user.id, id], enabled: !!session && !!id,
    queryFn: ({ signal }) => request<Report>(`/v1/reports/${encodeURIComponent(id)}`, { token: session?.token, signal }), refetchInterval: 30_000 });
  if (!loading && !session) return <Redirect href="/sign-in" />;
  const report = query.data;
  return <SafeAreaView className="flex-1 bg-canvas"><ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
    <View className="self-start"><Button title="Back to my reports" variant="quiet" compact icon="arrow-back" onPress={() => router.replace('/(tabs)/reports')} /></View>
    {query.isPending ? <Loading label="Loading report" /> : null}
    {query.isError ? <><Notice>{query.error.message}</Notice><Button title="Retry report" onPress={() => void query.refetch()} /></> : null}
    {report ? <>
      <View className="gap-2">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-brand"><Ionicons name="checkmark" size={24} color="#FFFFFF" /></View>
        <Text accessibilityRole="header" className="text-[28px] font-bold leading-9 tracking-tight text-ink">Report received</Text>
        <Text className="text-[15px] leading-[22px] text-muted">{report.sharingMode==='manual' ? 'Your report stays private until review. You choose where to share the approved post.' : 'Each destination’s delivery status appears below as it changes.'}</Text>
      </View>
      <View className="gap-3 rounded-3xl border border-line bg-surface p-5" style={cardShadow}>
        <View className="flex-row items-center gap-2"><Ionicons name={categoryIcons[report.category]} size={16} color={palette.brand} /><Text className="text-sm font-semibold text-brand">{categoryLabels[report.category]}</Text></View>
        <Text className="text-[17px] leading-[26px] text-ink">{report.description}</Text>
        <View className="gap-1.5 border-t border-line pt-3">
          {([['location-outline', `${report.location.locality}, ${report.location.countryCode}`], ['person-outline', report.nickname], ['receipt-outline', `Reference ${report.id.slice(0, 8)}`]] as const).map(([icon, text]) =>
            <View key={icon} className="flex-row items-center gap-2"><Ionicons name={icon} size={14} color={palette.muted} /><Text selectable className="flex-1 text-[13px] text-muted">{text}</Text></View>)}
        </View>
      </View>
      <View className="gap-2">
        <Text accessibilityRole="header" className="text-[17px] font-semibold text-ink">Responsible offices</Text>
        <Text className="text-sm leading-5 text-muted">{report.routing.authorityNames.length ? report.routing.authorityNames.join(', ') : 'The local authority needs verification. Your report is safely held for review.'}</Text>
      </View>
      {report.publications.length ? <View className="gap-2">
        <Text accessibilityRole="header" className="text-[17px] font-semibold text-ink">{report.sharingMode==='manual' ? 'Your sharing choices' : 'Where your report stands'}</Text>
        <View className="overflow-hidden rounded-2xl border border-line bg-surface">
          {report.publications.map((p, i) => <View key={p.channel} className={`gap-1.5 p-4 ${i ? 'border-t border-line' : ''}`}>
            <View className="flex-row items-center gap-2.5">
              <Ionicons name={channelIcons[p.channel]} size={18} color={palette.ink} />
              <Text className="flex-1 text-[15px] font-semibold text-ink">{channelLabels[p.channel]}</Text>
              <Status label={report.sharingMode==='manual' && report.status==='approved' ? 'Ready for you to share' : statuses[p.status][0]} color={statuses[p.status][1]} />
            </View>
            {p.reason && !(report.sharingMode==='manual' && report.status==='approved') ? <Text className="text-sm leading-5 text-muted">{p.reason}</Text> : null}
            {p.providerId ? <Text selectable className="text-xs text-muted">Provider reference: {p.providerId}</Text> : null}
          </View>)}
        </View>
      </View> : null}
      {session ? <ComplaintFlow key={`${session.user.id}:${report.id}`} report={report} userId={session.user.id} token={session.token}/> : null}
      {session ? <UserSharing report={report} token={session.token}/> : null}
      <Notice>Review and publication do not guarantee that an authority has seen or acted on the report. For urgent danger, contact local emergency services.</Notice>
    </> : null}
  </ScrollView></SafeAreaView>;
}
