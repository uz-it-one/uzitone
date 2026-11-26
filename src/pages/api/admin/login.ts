import type { APIRoute } from 'astro';
import { errorResponse, jsonResponse, parseJsonBody } from '../../../lib/api';
import {
  createAdminSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  verifyAdminPassword,
} from '../../../lib/auth';

function buildSessionCookie(token: string, maxAgeSeconds: number): string {
  const encodedValue = token ? encodeURIComponent(token) : '';
  return `${SESSION_COOKIE_NAME}=${encodedValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  const body = await parseJsonBody<{ password?: string }>(request);
  if (!body) {
    return errorResponse('Invalid request body', 400);
  }

  const password = body.password ?? '';
  if (!verifyAdminPassword(password, env)) {
    return errorResponse('비밀번호가 일치하지 않습니다.', 401);
  }

  const token = await createAdminSessionToken(env);
  return jsonResponse(
    { ok: true, token },
    200,
    { 'Set-Cookie': buildSessionCookie(token, SESSION_MAX_AGE_SECONDS) }
  );
};

export const DELETE: APIRoute = async () => {
  return jsonResponse(
    { ok: true },
    200,
    { 'Set-Cookie': buildSessionCookie('', 0) }
  );
};
