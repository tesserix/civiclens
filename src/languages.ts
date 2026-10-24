import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type WritingLanguage = { tag: string; native: string; english: string };

export const languages: WritingLanguage[] = [
  { tag: 'en', native: 'English', english: 'English' },
  { tag: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { tag: 'bn', native: 'বাংলা', english: 'Bengali' },
  { tag: 'or', native: 'ଓଡ଼ିଆ', english: 'Odia' },
  { tag: 'ta', native: 'தமிழ்', english: 'Tamil' },
  { tag: 'te', native: 'తెలుగు', english: 'Telugu' },
  { tag: 'mr', native: 'मराठी', english: 'Marathi' },
  { tag: 'gu', native: 'ગુજરાતી', english: 'Gujarati' },
  { tag: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada' },
  { tag: 'ml', native: 'മലയാളം', english: 'Malayalam' },
  { tag: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
  { tag: 'as', native: 'অসমীয়া', english: 'Assamese' },
  { tag: 'ur', native: 'اردو', english: 'Urdu' },
  { tag: 'ne', native: 'नेपाली', english: 'Nepali' },
  { tag: 'th', native: 'ไทย', english: 'Thai' },
  { tag: 'vi', native: 'Tiếng Việt', english: 'Vietnamese' },
  { tag: 'ko', native: '한국어', english: 'Korean' },
  { tag: 'ja', native: '日本語', english: 'Japanese' },
  { tag: 'zh-Hans', native: '简体中文', english: 'Chinese (Simplified)' },
  { tag: 'id', native: 'Bahasa Indonesia', english: 'Indonesian' },
  { tag: 'ms', native: 'Bahasa Melayu', english: 'Malay' },
  { tag: 'fil', native: 'Filipino', english: 'Filipino' },
];

const known = (tag: string | null | undefined) => languages.find(l => l.tag === tag);
const deviceLanguage = () => known(Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0])?.tag ?? 'en';

export function useWritingLanguage(userId: string) {
  const key = `civiclens-writing-language-${userId}`;
  const [selection, setSelection] = useState(() => ({ key, tag: deviceLanguage() }));
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    const started = revision.current;
    AsyncStorage.getItem(key).then(saved => {
      if (active && started === revision.current) setSelection({ key, tag: known(saved)?.tag ?? deviceLanguage() });
    }).catch(() => {});
    return () => { active = false; };
  }, [key]);
  // A lost preference only falls back to the device language.
  const choose = useCallback((next: string) => {
    revision.current += 1;
    setSelection({ key, tag: next });
    AsyncStorage.setItem(key, next).catch(() => {});
  }, [key]);
  return [known(selection.key === key ? selection.tag : deviceLanguage()) ?? languages[0], choose] as const;
}
