import { YaotoshiAuth } from '@yaotoshi/auth-sdk';

let authInstance = null;

export async function initAuth() {
  if (authInstance) return authInstance;

  const res = await fetch('/auth/config');
  if (!res.ok) throw new Error('Failed to load auth config');
  const config = await res.json();

  authInstance = new YaotoshiAuth({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    postLogoutRedirectUri: config.postLogoutRedirectUri || undefined,
    accountsUrl: config.accountsUrl,
    apiPathPrefix: '/auth/proxy',
  });

  return authInstance;
}

export function getAuth() {
  if (!authInstance) throw new Error('Auth not initialized — call initAuth() first');
  return authInstance;
}
