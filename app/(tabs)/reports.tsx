import { FlatList, Pressable, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/session';
import { Button, Notice } from '../../src/ui';
import { request } from '../../src/api';
import { categoryLabels, type Report } from '../../shared/contracts';

export default function Reports() {
  const { session } = useSession(); const router = useRouter();
  const query = useInfiniteQuery({ queryKey: ['reports',session?.user.id], enabled: !!session,
    queryFn: ({ pageParam, signal }) => request<{ items: Report[]; nextCursor: string | null }>(`/v1/reports${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`, { token: session?.token, signal }),
    initialPageParam: null as string | null, getNextPageParam: last => last.nextCursor ?? undefined,
    refetchInterval: 30_000,
  });
  return <SafeAreaView edges={['top','left','right']} className="flex-1 bg-canvas"><FlatList
    data={query.data?.pages.flatMap(p => p.items) || []} keyExtractor={r => r.id}
    contentContainerStyle={{ padding: 24, gap: 16, flexGrow: 1 }}
    onRefresh={() => void query.refetch()} refreshing={query.isRefetching}
    onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }}
    ListHeaderComponent={<View className="mb-3 gap-3"><Text className="text-xs font-semibold tracking-[3px] text-muted">YOUR SMALL ACTS OF CARE</Text><Text className="text-[34px] font-bold tracking-tight text-ink">My reports<Text className="text-coral">.</Text></Text><Text className="text-sm leading-6 text-muted">Follow each report from review to publication. Only you and authorised reviewers can see this history.</Text>{query.isError ? <><Notice>{query.error.message}</Notice><Button title="Retry reports" secondary onPress={() => void query.refetch()} /></> : null}</View>}
    ListEmptyComponent={query.isPending ? <ActivityIndicator color="#163D32" /> : !query.isError ? <View className="flex-1 items-center justify-center gap-5 py-16"><View className="h-24 w-24 items-center justify-center rounded-full bg-mint"><Ionicons name="leaf-outline" size={40} color="#163D32" /></View><Text className="text-2xl font-semibold text-ink">Your first step starts here.</Text><Text className="text-center text-sm leading-6 text-muted">See something that needs care?{`\n`}A photo is all it takes to get started.</Text><Button title="Make your first report" onPress={() => router.push('/(tabs)')} /></View> : null}
    ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color="#163D32" /> : null}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`View ${categoryLabels[item.category]} report in ${item.location.locality}`} onPress={() => router.push(`/report/${item.id}`)}
      className="gap-4 rounded-3xl border border-line bg-white p-5" style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      <View className="flex-row items-center justify-between"><Text className="text-xs font-semibold uppercase tracking-widest text-muted">{categoryLabels[item.category]}</Text><Ionicons name="arrow-up-right-box-outline" size={20} color="#163D32" /></View>
      <Text numberOfLines={2} className="text-lg font-semibold leading-7 text-ink">{item.description}</Text><Text className="text-sm text-muted">{item.location.locality} · {new Date(item.createdAt).toLocaleDateString()}</Text>
      <View className="self-start rounded-full bg-mint px-3 py-2"><Text className="text-xs font-semibold text-forest">{item.status === 'approved' ? 'Reviewed · check delivery' : 'In review'}</Text></View>
    </Pressable>} />
  </SafeAreaView>;
}
