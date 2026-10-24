import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import { preparePhoto } from './report-photo';

jest.mock('expo-file-system/legacy',()=>({documentDirectory:'file:///drafts/',copyAsync:jest.fn()}));
jest.mock('expo-image-manipulator',()=>({SaveFormat:{JPEG:'jpeg'},manipulateAsync:jest.fn()}));
jest.mock('expo-crypto',()=>({randomUUID:jest.fn()}));

test('replacing a report photo gets a distinct persistent URI so the image cache cannot show the old photo',async()=>{
  jest.mocked(Crypto.randomUUID).mockReturnValueOnce('first-photo').mockReturnValueOnce('second-photo');
  jest.mocked(ImageManipulator.manipulateAsync).mockResolvedValue({uri:'file:///cache/sanitised.jpg',width:1600,height:1000});
  expect(await preparePhoto('file:///picked/one.jpg')).toBe('file:///drafts/civiclens-photo-first-photo.jpg');
  expect(await preparePhoto('file:///picked/two.jpg')).toBe('file:///drafts/civiclens-photo-second-photo.jpg');
  expect(FileSystem.copyAsync).toHaveBeenLastCalledWith({from:'file:///cache/sanitised.jpg',to:'file:///drafts/civiclens-photo-second-photo.jpg'});
  expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith('file:///picked/two.jpg',[{resize:{width:1600}}],{compress:0.8,format:'jpeg'});
});
