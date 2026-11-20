import type { APIRoute } from 'astro';
import { isAuthenticatedRequest } from '../../../lib/auth';
import { renderMarkdown } from '../../../lib/markdown';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!(await isAuthenticatedRequest(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  let body: { content_md?: string } = {};
  try {
    body = (await request.json()) as { content_md?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const rendered = renderMarkdown(body.content_md ?? '');
  return new Response(JSON.stringify(rendered), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
