import type { APIRoute } from 'astro';
import { errorResponse, jsonResponse } from '../../../lib/api';
import { isAuthenticatedRequest } from '../../../lib/auth';
import { getCachedOwnedPublicRepos, getSelectedProjects } from '../../../lib/db';

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!(await isAuthenticatedRequest(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';

  const [ownedRepos, selectedProjects] = await Promise.all([
    getCachedOwnedPublicRepos(env, forceRefresh),
    getSelectedProjects(env),
  ]);

  const selectedByName = new Map(
    selectedProjects.map((project) => [project.repo_name, project])
  );

  const reposWithSelection = ownedRepos.map((repo, index) => {
    const selected = selectedByName.get(repo.name);
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
      selected: Boolean(selected),
      display_order: selected ? selected.display_order : 100 + index,
      status_label: selected?.status_label ?? '진행 중',
      custom_description: selected?.custom_description ?? '',
    };
  });

  // Selected repos first (by display_order), then unselected repos (by pushed_at DESC)
  reposWithSelection.sort((a, b) => {
    if (a.selected !== b.selected) {
      return a.selected ? -1 : 1;
    }
    if (a.selected && b.selected) {
      return a.display_order - b.display_order;
    }
    return b.pushed_at.localeCompare(a.pushed_at);
  });

  return jsonResponse({ repos: reposWithSelection });
};
