import type { APIRoute } from 'astro';
import { errorResponse, jsonResponse, parseJsonBody } from '../../../lib/api';
import { isAuthenticatedRequest } from '../../../lib/auth';
import { saveSelectedProjects, type SaveProjectSelectionInput } from '../../../lib/db';

export const PUT: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!(await isAuthenticatedRequest(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  const body = await parseJsonBody<{ projects?: SaveProjectSelectionInput[] }>(request);
  if (!body) {
    return errorResponse('Invalid JSON body', 400);
  }

  if (!Array.isArray(body.projects)) {
    return errorResponse('projects array is required', 400);
  }

  const savedProjects = await saveSelectedProjects(env, body.projects);
  return jsonResponse({ ok: true, selected: savedProjects });
};
