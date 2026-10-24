import { Platform } from 'react-native';

export const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080');

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

type RequestOptions = { token?: string; method?: string; body?: unknown; key?: string; signal?: AbortSignal; timeoutMs?: number };

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!__DEV__ && !API_URL.startsWith('https://')) throw new Error('A secure CivicLens API URL must be configured for this build.');
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Session ${options.token}` } : {}),
      ...(options.key ? { 'Idempotency-Key': options.key } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal || AbortSignal.timeout(options.timeoutMs || 25000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new ApiError(error?.code || 'REQUEST_FAILED', error?.message || 'Could not connect. Your draft is safe; please retry.', response.status);
  }
  return response.json() as Promise<T>;
}
