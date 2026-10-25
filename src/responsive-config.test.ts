import config from '../app.config';
import links from '../shared/app-links.json';

test('supports tablet and landscape windows instead of locking foldables to portrait', () => {
  expect(config.orientation).toBe('default');
  expect(config.ios?.supportsTablet).toBe(true);
});

test('uses the same native app identities as shared-link verification', () => {
  expect(config.ios?.appleTeamId).toBe(links.appleTeamId);
  expect(config.ios?.bundleIdentifier).toBe(links.iosBundleId);
  expect(config.android?.package).toBe(links.androidPackageName);
  expect(config.ios?.associatedDomains).toContain(`applinks:${new URL(links.publicOrigin).hostname}`);
  expect(config.android?.intentFilters?.[0].autoVerify).toBe(true);
});


test('allows only the supported native social app availability queries',()=>{
  expect(config.ios?.infoPlist?.LSApplicationQueriesSchemes).toEqual(['fb','instagram','whatsapp']);
});
