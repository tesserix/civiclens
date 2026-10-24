import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

export async function preparePhoto(source: string): Promise<string> {
  const photo = await ImageManipulator.manipulateAsync(source, [{ resize: { width: 1600 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return photo.uri;
  const uri = `${FileSystem.documentDirectory}civiclens-photo-${Crypto.randomUUID()}.jpg`;
  await FileSystem.copyAsync({ from: photo.uri, to: uri });
  return uri;
}
