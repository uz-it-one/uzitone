// Pre-warms Cloudflare D1 `github_repos_cache` and `app_meta` using parameterized D1 REST API queries.
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const cfToken = process.env.CLOUDFLARE_API_TOKEN;
const d1Id = process.env.D1_ID;
const ghToken = process.env.GITHUB_TOKEN;

if (!accountId || !cfToken || !d1Id) {
  console.error('Missing required environment variables for D1 GitHub cache sync.');
  process.exit(1);
}

const ghHeaders = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'uzit-one-ci-sync',
};
if (ghToken) {
  ghHeaders.Authorization = `Bearer ${ghToken}`;
}

async function executeD1Query(sql, params = []) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${d1Id}/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`D1 query failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function main() {
  const [profRes, reposRes] = await Promise.all([
    fetch('https://api.github.com/users/uz-it-one', { headers: ghHeaders }),
    fetch('https://api.github.com/users/uz-it-one/repos?type=owner&per_page=100&sort=pushed', {
      headers: ghHeaders,
    }),
  ]);

  const now = Date.now();

  if (profRes.ok) {
    const profile = await profRes.json();
    await executeD1Query(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('github_profile_cache', ?)",
      [JSON.stringify({ profile, cachedAt: now })]
    );
    console.log('Synced GitHub profile cache to D1.');
  }

  if (reposRes.ok) {
    const rawRepos = await reposRes.json();
    const owned = Array.isArray(rawRepos)
      ? rawRepos.filter(
          (r) =>
            r &&
            !r.private &&
            r.owner &&
            String(r.owner.login).toLowerCase() === 'uz-it-one' &&
            r.owner.type === 'User'
        )
      : [];

    if (owned.length > 0) {
      await executeD1Query('DELETE FROM github_repos_cache');
      for (const r of owned) {
        await executeD1Query(
          `INSERT OR REPLACE INTO github_repos_cache
           (name, full_name, html_url, description, fork, language, stargazers_count, forks_count, pushed_at, updated_at, owner_login, owner_type, cached_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            r.name,
            r.full_name,
            r.html_url,
            r.description ?? null,
            r.fork ? 1 : 0,
            r.language ?? null,
            Number(r.stargazers_count) || 0,
            Number(r.forks_count) || 0,
            r.pushed_at,
            r.updated_at,
            r.owner.login,
            r.owner.type,
            now,
          ]
        );
      }
      await executeD1Query(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('github_repos_synced_at', ?)",
        [String(now)]
      );
      console.log(`Synced ${owned.length} owned public repositories to D1 github_repos_cache.`);
    }
  }
}

main().catch((err) => {
  console.error('Warning: D1 GitHub cache pre-warm error:', err.message);
});
