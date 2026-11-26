import type { APIRoute } from 'astro';
import { jsonResponse } from '../../lib/api';
import { getCachedGitHubProfile, getMergedActiveProjects } from '../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const env = locals.runtime?.env;
  const [profile, projects] = await Promise.all([
    getCachedGitHubProfile(env, false),
    getMergedActiveProjects(env),
  ]);

  return jsonResponse({ profile, projects });
};
