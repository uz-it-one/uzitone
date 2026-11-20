import type { APIRoute } from 'astro';
import { getCachedGitHubProfile, getMergedActiveProjects } from '../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const env = locals.runtime?.env;
  const [profile, projects] = await Promise.all([
    getCachedGitHubProfile(env, false),
    getMergedActiveProjects(env),
  ]);

  return new Response(
    JSON.stringify({
      profile,
      projects,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    }
  );
};
