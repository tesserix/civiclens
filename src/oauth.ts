import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { request } from './api';
import type { Capabilities, Challenge, Session } from '../shared/contracts';

WebBrowser.maybeCompleteAuthSession();

export async function providerLogin(provider: 'google' | 'facebook', nickname: string): Promise<Session> {
  if (Platform.OS === 'web') throw new Error('Use the Android or iOS app to sign in. This browser view is a design preview.');
  const { auth } = await request<Capabilities>('/v1/capabilities');
  if (auth.issuer !== 'https://auth.tesserix.app') throw new Error('Untrusted identity provider.');
  const clientId = Platform.OS === 'ios' ? auth.iosClientId : auth.androidClientId;
  const idp = provider === 'google' ? auth.googleIdpId : auth.facebookIdpId;
  if (!clientId || !idp || !auth.projectId) throw new Error('Sign-in is not configured for this build.');
  const challenge = await request<Challenge>(`/v1/auth/${provider}/challenge`, { method: 'POST' });
  const redirectUri = 'civiclens:/auth/callback';
  const discovery = { authorizationEndpoint: `${auth.issuer}/oauth/v2/authorize`, tokenEndpoint: `${auth.issuer}/oauth/v2/token` };
  const oauth = new AuthSession.AuthRequest({ clientId, redirectUri, responseType: AuthSession.ResponseType.Code,
    scopes: ['openid', `urn:zitadel:iam:org:project:id:${auth.projectId}:aud`], usePKCE: true,
    extraParams: { nonce: challenge.nonce, prompt: 'select_account', idp_hint: idp } });
  const result = await oauth.promptAsync(discovery);
  if (result.type !== 'success') throw new Error(result.type === 'cancel' || result.type === 'dismiss' ? 'Sign-in cancelled.' : 'Sign-in could not be completed.');
  const exchanged = await AuthSession.exchangeCodeAsync({ clientId, redirectUri, code: result.params.code,
    extraParams: { code_verifier: oauth.codeVerifier || '' } }, discovery);
  if (!exchanged.idToken) throw new Error('The identity provider did not return a usable token.');
  return request<Session>(`/v1/auth/${provider}`, { method: 'POST', body: { token: exchanged.idToken, challengeId: challenge.id, nickname: nickname.trim() || null } });
}
