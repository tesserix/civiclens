export type * from './generated';
export {communityRulesVersion} from './generated';
import type { Category, Channel } from './generated';

export const categories: Category[] = ['waste', 'pollution', 'roads', 'water', 'public_safety'];
export const categoryLabels: Record<Category, string> = {
  waste: 'Waste & litter', pollution: 'Pollution', roads: 'Roads & infrastructure',
  water: 'Water & drainage', public_safety: 'Public safety',
};
export const channels: Channel[] = ['facebook', 'instagram', 'whatsapp'];
export type LoginProvider = 'google' | 'facebook' | 'apple';
