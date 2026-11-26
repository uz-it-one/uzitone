import type { APIRoute } from 'astro';
import { errorResponse, jsonResponse, parseJsonBody } from '../../../lib/api';
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
    return errorResponse('Unauthorized', 401);
  }

  const posts = await getBlogPosts(env, { includeDrafts: true });
  return jsonResponse({ posts });
};

async function handleSavePost(request: Request, env?: Env): Promise<Response> {
  if (!(await isAuthenticatedRequest(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  const body = await parseJsonBody<Partial<BlogPostInput>>(request);
  if (!body) {
    return errorResponse('Invalid JSON body', 400);
  }

  if (!body.title?.trim()) {
    return errorResponse('제목을 입력해주세요.', 400);
  }
  if (typeof body.content_md !== 'string' || !body.content_md.trim()) {
    return errorResponse('마크다운 본문을 입력해주세요.', 400);
  }

  const savedPost = await saveBlogPost(env, {
    id: body.id ? Number(body.id) : undefined,
    title: body.title,
    slug: body.slug || body.title,
    summary: body.summary ?? '',
    content_md: body.content_md,
    tags: Array.isArray(body.tags) ? body.tags : [],
    is_published: body.is_published ?? true,
  });

  return jsonResponse({ ok: true, post: savedPost });
}

export const POST: APIRoute = async ({ request, locals }) => {
  return handleSavePost(request, locals.runtime?.env);
};

export const PUT: APIRoute = async ({ request, locals }) => {
  return handleSavePost(request, locals.runtime?.env);
};

async function extractPostIdToDelete(request: Request): Promise<number> {
  const url = new URL(request.url);
  const queryId = Number(url.searchParams.get('id'));
  if (queryId) return queryId;

  const body = await parseJsonBody<{ id?: number }>(request);
  return Number(body?.id);
}

export const DELETE: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!(await isAuthenticatedRequest(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  const postId = await extractPostIdToDelete(request);
  if (!postId || Number.isNaN(postId)) {
    return errorResponse('Valid post id is required', 400);
  }

  const deleted = await deleteBlogPost(env, postId);
  return jsonResponse({ ok: deleted });
};
