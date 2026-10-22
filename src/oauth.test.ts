import * as AuthSession from 'expo-auth-session';
import { providerLogin } from './oauth';

const mockPrompt = jest.fn();
jest.mock('expo-auth-session', () => ({
  ResponseType: { Code: 'code' },
  AuthRequest: jest.fn().mockImplementation(() => ({ codeVerifier: 'device-verifier', promptAsync: mockPrompt })),
  exchangeCodeAsync: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

test('Apple uses the CivicLens organization, PKCE and a one-time API challenge', async () => {
  const auth = { issuer: 'https://auth.tesserix.app', projectId: 'civic-project', organizationId: 'consumer-civiclens', iosClientId: 'ios-client', appleIdpId: 'civic-apple' };
  const session = { token: 'opaque-session', user: { id: 'private-id', nickname: 'RiverFox' } };
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ auth, apple: true }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'one-use', nonce: 'server-nonce' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => session });
  mockPrompt.mockResolvedValue({ type: 'success', params: { code: 'authorization-code' } });
  jest.mocked(AuthSession.exchangeCodeAsync).mockResolvedValue({ idToken: 'broker-signed-token' } as AuthSession.TokenResponse);
  await expect(providerLogin('apple', ' RiverFox ')).resolves.toEqual(session);
  expect(AuthSession.AuthRequest).toHaveBeenCalledWith(expect.objectContaining({
    clientId: 'ios-client', usePKCE: true, redirectUri: 'civiclens:/auth/callback',
    scopes: expect.arrayContaining(['urn:zitadel:iam:org:id:consumer-civiclens', 'urn:zitadel:iam:user:resourceowner']),
    extraParams: expect.objectContaining({ idp_hint: 'civic-apple', nonce: 'server-nonce' }),
  }));
  expect(AuthSession.exchangeCodeAsync).toHaveBeenCalledWith(expect.objectContaining({ extraParams: { code_verifier: 'device-verifier' } }), expect.anything());
  expect(globalThis.fetch).toHaveBeenLastCalledWith(expect.stringMatching('/v1/auth/apple$'), expect.objectContaining({ body: JSON.stringify({ token: 'broker-signed-token', challengeId: 'one-use', nickname: 'RiverFox' }) }));
});
