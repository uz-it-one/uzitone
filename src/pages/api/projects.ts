import type { APIRoute } from 'astro';
import { getMergedActiveProjects } from '../../lib/db';
import { fetchGitHubProfile } from '../../lib/github';

export const GET: APIRoute = async ({ locals }) => {
  const env = locals.runtime?.env;
  const [profile, projects] = await Promise.all([
    fetchGitHubProfile(env?.GITHUB_TOKEN),
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
