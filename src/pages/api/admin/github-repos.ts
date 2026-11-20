import type { APIRoute } from 'astro';
import { isAuthenticatedRequest } from '../../../lib/auth';
import { getSelectedProjects } from '../../../lib/db';
import { fetchOwnedPublicRepos } from '../../../lib/github';

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!(await isAuthenticatedRequest(request, env))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';

  const [ownedRepos, selected] = await Promise.all([
    fetchOwnedPublicRepos(env?.GITHUB_TOKEN, forceRefresh),
    getSelectedProjects(env),
  ]);

  const selectedMap = new Map(selected.map((s) => [s.repo_name, s]));

  const reposWithSelection = ownedRepos.map((repo, idx) => {
    const sel = selectedMap.get(repo.name);
    return {
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description,
      fork: repo.fork,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      pushed_at: repo.pushed_at,
      owner_login: repo.owner.login,
      owner_type: repo.owner.type,
      selected: Boolean(sel),
      display_order: sel ? sel.display_order : 100 + idx,
      status_label: sel?.status_label ?? '진행 중',
      custom_description: sel?.custom_description ?? '',
    };
  });

  // Sort selected repos first by display_order, then unselected repos by pushed_at DESC
  reposWithSelection.sort((a, b) => {
    if (a.selected && !b.selected) return -1;
    if (!a.selected && b.selected) return 1;
    if (a.selected && b.selected) return a.display_order - b.display_order;
    return b.pushed_at.localeCompare(a.pushed_at);
  });

  return new Response(
    JSON.stringify({
      repos: reposWithSelection,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }
  );
};
