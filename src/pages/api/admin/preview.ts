import type { APIRoute } from 'astro';
import { errorResponse, jsonResponse, parseJsonBody } from '../../../lib/api';
import { isAuthenticatedRequest } from '../../../lib/auth';
import { renderMarkdown } from '../../../lib/markdown';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!(await isAuthenticatedRequest(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  const body = await parseJsonBody<{ content_md?: string }>(request);
  if (!body) {
    return errorResponse('Invalid JSON', 400);
  }

  const rendered = renderMarkdown(body.content_md ?? '');
  return jsonResponse(rendered);
};
