const DEFAULT_ADMIN_PASSWORD = 'uzitone-admin';
export const SESSION_COOKIE_NAME = 'uzitone_admin_session';

function getSecret(env?: Env): string {
  return env?.ADMIN_PASSWORD && env.ADMIN_PASSWORD.trim().length > 0
    ? env.ADMIN_PASSWORD.trim()
    : DEFAULT_ADMIN_PASSWORD;
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function verifyAdminPassword(password: string, env?: Env): boolean {
  const expected = getSecret(env);
  return password === expected;
}

export async function createAdminSessionToken(env?: Env): Promise<string> {
  const secret = getSecret(env);
  const issuedAt = Date.now();
  const payload = `admin.${issuedAt}`;
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

  // Token valid for 7 days
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - issuedAt > maxAgeMs) return false;

  const secret = getSecret(env);
  const expectedSig = await hmacSign(`${role}.${issuedAtStr}`, secret);
  return signature === expectedSig;
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
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
    const bearer = authHeader.slice(7).trim();
    if (await verifyAdminSessionToken(bearer, env)) {
      return true;
    }
  }
  return false;
}
