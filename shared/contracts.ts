export type * from './generated';
import type { Category, Channel } from './generated';

export const categories: Category[] = ['waste', 'pollution', 'roads', 'water', 'public_safety'];
export const categoryLabels: Record<Category, string> = {
  waste: 'Waste & litter', pollution: 'Pollution', roads: 'Roads & infrastructure',
  water: 'Water & drainage', public_safety: 'Public safety',
};
export const channels: Channel[] = ['facebook', 'instagram', 'whatsapp'];
export type Capabilities = { google: boolean; facebook: boolean; publishing: Record<Channel, boolean>;
  auth: { issuer: string; projectId: string; iosClientId: string; androidClientId: string; googleIdpId: string; facebookIdpId: string } };
