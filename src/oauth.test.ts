import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import { providerLogin } from './oauth';

const mockPrompt = jest.fn();
jest.mock('expo-auth-session', () => ({
  ResponseType: { Code: 'code' },
  AuthRequest: jest.fn().mockImplementation(() => ({ codeVerifier: 'device-verifier', promptAsync: mockPrompt })),
  exchangeCodeAsync: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

test.each([['ios', 'apple'], ['ios', 'google'], ['ios', 'facebook'], ['android', 'google'], ['android', 'facebook']] as const)('%s %s selects the organization and provider with PKCE and a one-time challenge', async (platform, provider) => {
  jest.replaceProperty(Platform, 'OS', platform);
  const auth = { issuer: 'https://auth.tesserix.app', projectId: 'civic-project', organizationId: 'consumer-civiclens', iosClientId: 'ios-client', androidClientId: 'android-client', appleIdpId: 'civic-apple', googleIdpId: 'civic-google', facebookIdpId: 'civic-facebook' };
  const session = { token: 'opaque-session', user: { id: 'private-id', nickname: 'RiverFox' } };
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ auth, apple: true }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'one-use', nonce: 'server-nonce' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => session });
  mockPrompt.mockResolvedValue({ type: 'success', params: { code: 'authorization-code' } });
  jest.mocked(AuthSession.exchangeCodeAsync).mockResolvedValue({ idToken: 'broker-signed-token' } as AuthSession.TokenResponse);
  await expect(providerLogin(provider, ' RiverFox ')).resolves.toEqual(session);
  expect(AuthSession.AuthRequest).toHaveBeenCalledWith(expect.objectContaining({
    clientId: `${platform}-client`, usePKCE: true, redirectUri: 'civiclens:/auth/callback',
    scopes: expect.arrayContaining(['openid', 'profile', 'urn:zitadel:iam:org:id:consumer-civiclens', 'urn:zitadel:iam:user:resourceowner', `urn:zitadel:iam:org:idp:id:civic-${provider}`]),
    extraParams: expect.objectContaining({ nonce: 'server-nonce' }),
  }));
  expect(AuthSession.exchangeCodeAsync).toHaveBeenCalledWith(expect.objectContaining({ extraParams: { code_verifier: 'device-verifier' } }), expect.anything());
  expect(globalThis.fetch).toHaveBeenLastCalledWith(expect.stringMatching(`/v1/auth/${provider}$`), expect.objectContaining({ body: JSON.stringify({ token: 'broker-signed-token', challengeId: 'one-use', nickname: 'RiverFox' }) }));
});
