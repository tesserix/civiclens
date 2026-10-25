import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Linking } from 'react-native';
import { DirectoryBrowser } from './directory-browser';

test('browses source-backed bodies and labels API support as unknown without filing anything',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}}),urls:string[]=[];
  const open=jest.spyOn(Linking,'openURL').mockResolvedValue(true);
  globalThis.fetch=jest.fn(async(url)=>{
    urls.push(String(url));
    const params=new URL(String(url)).searchParams,level=params.get('level');
    const item={id:level==='state'?'in-state-27':level==='district'?'in-district-520':'in-ulb-123',sourceId:'in-lgd-administrative',name:level==='state'?'Maharashtra':level==='district'?'Pune':'Pune Municipal Corporation',countryCode:'IN',level:level??'municipality',parentId:null,regionCode:'IN-LGD-27',officialCode:'123',officialUrl:null,evidenceUrl:'https://lgdirectory.gov.in/',sourceUrl:'https://lgdirectory.gov.in/',licenceUrl:'https://lgdirectory.gov.in/copyRightPolicy.do',attribution:'Government of India LGD. Reference only.',retrievedAt:'2026-10-24T15:24:52Z',verificationStatus:'reference',complaintApiStatus:'unknown',districtIds:[],districtCoverage:'complete',contactUrl:null};
    return {ok:true,status:200,json:async()=>({items:[item],nextCursor:null})} as Response;
  }) as jest.Mock;
  render(<QueryClientProvider client={client}><DirectoryBrowser userId="first" token="session" initialCountry="IN"/></QueryClientProvider>);
  expect(screen.getByRole('button',{name:'Country, 🇮🇳 India'})).toBeOnTheScreen();
  fireEvent.press(await screen.findByRole('button',{name:'Open Maharashtra'}));
  fireEvent.press(await screen.findByRole('button',{name:'Open Pune'}));
  fireEvent.press(await screen.findByRole('button',{name:'Open Pune Municipal Corporation'}));
  await screen.findByText('Complaint API: Not verified');
  expect(screen.queryByRole('button',{name:'Submit complaint'})).toBeNull();
  fireEvent.press(screen.getByRole('button',{name:'Open source directory'}));
  expect(open).toHaveBeenCalledWith('https://lgdirectory.gov.in/');
  expect(urls.every(url=>url.includes('/v1/directory/units'))).toBe(true);
  client.clear();open.mockRestore();
});
