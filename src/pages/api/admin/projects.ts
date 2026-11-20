import type { APIRoute } from 'astro';
import { isAuthenticatedRequest } from '../../../lib/auth';
import { saveSelectedProjects, type SaveProjectSelectionInput } from '../../../lib/db';

export const PUT: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!(await isAuthenticatedRequest(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  let body: { projects?: SaveProjectSelectionInput[] } = {};
  try {
    body = (await request.json()) as { projects?: SaveProjectSelectionInput[] };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  if (!Array.isArray(body.projects)) {
    return new Response(JSON.stringify({ error: 'projects array is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const saved = await saveSelectedProjects(env, body.projects);
  return new Response(JSON.stringify({ ok: true, selected: saved }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
