import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSession } from '../../src/session';
import { Button, Loading, Notice, Status, Title, Viewfinder, categoryIcons, palette } from '../../src/ui';
import { request } from '../../src/api';
import { categoryLabels, type Report } from '../../shared/contracts';

export default function Reports() {
  const { session } = useSession(); const router = useRouter();
  const query = useInfiniteQuery({ queryKey: ['reports', session?.user.id], enabled: !!session,
    queryFn: ({ pageParam, signal }) => request<{ items: Report[]; nextCursor: string | null }>(`/v1/reports${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`, { token: session?.token, signal }),
    initialPageParam: null as string | null, getNextPageParam: last => last.nextCursor ?? undefined,
    refetchInterval: 30_000,
  });
  return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas"><FlatList
    data={query.data?.pages.flatMap(p => p.items) || []} keyExtractor={r => r.id}
    contentContainerStyle={{ padding: 20, gap: 12, flexGrow: 1 }}
    onRefresh={() => void query.refetch()} refreshing={query.isRefetching}
    onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }}
    ListHeaderComponent={<View className="mb-3 gap-4">
      <Title subtitle="Follow each report from review to publication. Only you and authorised reviewers can see this history.">My reports</Title>
      {query.isError ? <><Notice>{query.error.message}</Notice><Button title="Retry reports" variant="secondary" onPress={() => void query.refetch()} /></> : null}
    </View>}
    ListEmptyComponent={query.isPending ? <Loading label="Loading your reports" /> : !query.isError ? <View className="flex-1 justify-center gap-5 py-10">
      <Viewfinder className="h-40 items-center justify-center"><Ionicons name="camera-outline" size={40} color={palette.faint} /></Viewfinder>
      <View className="gap-1.5"><Text className="text-xl font-semibold text-ink">No reports yet</Text><Text className="text-[15px] leading-[22px] text-muted">When you spot something that needs fixing, a photo is all it takes to start.</Text></View>
      <Button title="Report an issue" icon="camera" onPress={() => router.push('/(tabs)')} />
    </View> : null}
    ListFooterComponent={query.isFetchingNextPage ? <Loading label="Loading more reports" /> : null}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`View ${categoryLabels[item.category]} report in ${item.location.locality}`} onPress={() => router.push(`/report/${item.id}`)}
      className="gap-3 rounded-2xl border border-line bg-surface p-4" style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      <View className="flex-row items-center gap-2.5">
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-mint"><Ionicons name={categoryIcons[item.category]} size={17} color={palette.brand} /></View>
        <Text className="flex-1 text-sm font-semibold text-ink">{categoryLabels[item.category]}</Text>
        <Status label={item.status === 'approved' ? 'Reviewed' : 'In review'} color={item.status === 'approved' ? palette.brand : palette.hivis} />
      </View>
      <Text numberOfLines={2} className="text-base leading-6 text-ink">{item.description}</Text>
      <View className="flex-row items-center gap-1.5">
        <Ionicons name="location-outline" size={14} color={palette.muted} />
        <Text numberOfLines={1} className="flex-1 text-[13px] text-muted">{item.location.locality}</Text>
        <Text className="text-[13px] text-muted">{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
    </Pressable>} />
  </SafeAreaView>;
}
