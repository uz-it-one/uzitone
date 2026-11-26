const DEFAULT_ADMIN_PASSWORD = 'uzitone-admin';
export const SESSION_COOKIE_NAME = 'uzitone_admin_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

function getAdminSecret(env?: Env): string {
  const configuredPassword = env?.ADMIN_PASSWORD?.trim();
  return configuredPassword || DEFAULT_ADMIN_PASSWORD;
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function verifyAdminPassword(password: string, env?: Env): boolean {
  return password === getAdminSecret(env);
}

export async function createAdminSessionToken(env?: Env): Promise<string> {
  const secret = getAdminSecret(env);
  const payload = `admin.${Date.now()}`;
  const signature = await hmacSign(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined | null,
  env?: Env
): Promise<boolean> {
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [role, issuedAtStr, signature] = parts;
  if (role !== 'admin') return false;

  const issuedAt = Number(issuedAtStr);
  if (Number.isNaN(issuedAt)) return false;
  if (Date.now() - issuedAt > SESSION_MAX_AGE_MS) return false;

  const expectedSignature = await hmacSign(`${role}.${issuedAtStr}`, getAdminSecret(env));
  return signature === expectedSignature;
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) continue;

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

export async function isAuthenticatedRequest(
  request: Request,
  env?: Env
): Promise<boolean> {
  const cookies = parseCookies(request.headers.get('cookie'));
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken && (await verifyAdminSessionToken(cookieToken, env))) {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    return verifyAdminSessionToken(bearerToken, env);
  }

  return false;
}
