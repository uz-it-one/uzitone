import type { APIRoute } from 'astro';
import {
  createAdminSessionToken,
  SESSION_COOKIE_NAME,
  verifyAdminPassword,
} from '../../../lib/auth';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  let body: { password?: string } = {};
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const password = body.password ?? '';
  if (!verifyAdminPassword(password, env)) {
    return new Response(JSON.stringify({ error: '비밀번호가 일치하지 않습니다.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const token = await createAdminSessionToken(env);
  const maxAge = 7 * 24 * 60 * 60;
  const cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;

  return new Response(JSON.stringify({ ok: true, token }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': cookie,
    },
  });
};

export const DELETE: APIRoute = async () => {
  const cookie = `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': cookie,
    },
  });
};
