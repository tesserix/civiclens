import type { PropsWithChildren } from 'react';
import { Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CivicFeatureGate } from './community-feed';
export function CommunityPage({children}:PropsWithChildren){return <SafeAreaView edges={['left','right','bottom']} className="flex-1 bg-canvas"><ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode={Platform.OS==='ios'?'interactive':'on-drag'} keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20,paddingBottom:40,flexGrow:1,width:'100%',maxWidth:800,alignSelf:'center'}}><CivicFeatureGate>{children}</CivicFeatureGate></ScrollView></SafeAreaView>;}
