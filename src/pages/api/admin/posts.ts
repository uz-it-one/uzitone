import type { APIRoute } from 'astro';
import { isAuthenticatedRequest } from '../../../lib/auth';
import {
  deleteBlogPost,
  getBlogPosts,
  saveBlogPost,
  type BlogPostInput,
} from '../../../lib/db';

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!(await isAuthenticatedRequest(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const posts = await getBlogPosts(env, { includeDrafts: true });
  return new Response(JSON.stringify({ posts }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

async function handleSave(request: Request, env?: Env) {
  if (!(await isAuthenticatedRequest(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  let body: Partial<BlogPostInput> = {};
  try {
    body = (await request.json()) as Partial<BlogPostInput>;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  if (!body.title || !body.title.trim()) {
    return new Response(JSON.stringify({ error: '제목을 입력해주세요.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  if (typeof body.content_md !== 'string' || !body.content_md.trim()) {
    return new Response(JSON.stringify({ error: '마크다운 본문을 입력해주세요.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const saved = await saveBlogPost(env, {
    id: body.id ? Number(body.id) : undefined,
    title: body.title,
    slug: body.slug || body.title,
    summary: body.summary ?? '',
    content_md: body.content_md,
    tags: Array.isArray(body.tags) ? body.tags : [],
    is_published: body.is_published ?? true,
  });

  return new Response(JSON.stringify({ ok: true, post: saved }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  return handleSave(request, locals.runtime?.env);
};

export const PUT: APIRoute = async ({ request, locals }) => {
  return handleSave(request, locals.runtime?.env);
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!(await isAuthenticatedRequest(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const url = new URL(request.url);
  let id = Number(url.searchParams.get('id'));
  if (!id) {
    try {
      const body = (await request.json()) as { id?: number };
      id = Number(body.id);
    } catch {
      // Ignore
    }
  }

  if (!id || Number.isNaN(id)) {
    return new Response(JSON.stringify({ error: 'Valid post id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const deleted = await deleteBlogPost(env, id);
  return new Response(JSON.stringify({ ok: deleted }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
