import {
  FALLBACK_PROFILE,
  FALLBACK_REPOS,
  fetchGitHubProfileFromApi,
  fetchOwnedPublicReposFromApi,
  formatYearMonth,
  getLanguageColor,
  type GitHubProfile,
  type GitHubRepo,
} from './github';

export interface SelectedProjectRecord {
  repo_name: string;
  display_order: number;
  status_label: string;
  custom_description: string | null;
  cached_lang: string | null;
  cached_stars: number;
  cached_url: string | null;
  updated_at: string;
}

export interface ActiveProjectView {
  repo_name: string;
  display_order: number;
  status_label: string;
  description: string;
  custom_description: string | null;
  github_description: string | null;
  language: string | null;
  language_color: string;
  stars: number;
  html_url: string;
  pushed_at: string;
  updated_month: string;
  fork: boolean;
}

export interface BlogPostRecord {
  id: number;
  slug: string;
  title: string;
  summary: string;
  content_md: string;
  tags: string[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface BlogPostInput {
  id?: number;
  slug: string;
  title: string;
  summary?: string;
  content_md: string;
  tags?: string[];
  is_published?: boolean;
}

const INITIAL_SELECTED_PROJECTS: SelectedProjectRecord[] = [
  {
    repo_name: 'mac-hwp-preview',
    display_order: 1,
    status_label: '진행 중',
    custom_description: null,
    cached_lang: 'Swift',
    cached_stars: 0,
    cached_url: 'https://github.com/uz-it-one/mac-hwp-preview',
    updated_at: '2026-11-03T05:30:46Z',
  },
  {
    repo_name: 'region-check',
    display_order: 2,
    status_label: '진행 중',
    custom_description: null,
    cached_lang: 'Python',
    cached_stars: 1,
    cached_url: 'https://github.com/uz-it-one/region-check',
    updated_at: '2026-04-21T14:29:20Z',
  },
  {
    repo_name: 'Transducer',
    display_order: 3,
    status_label: '진행 중',
    custom_description: null,
    cached_lang: 'Swift',
    cached_stars: 0,
    cached_url: 'https://github.com/uz-it-one/Transducer',
    updated_at: '2023-11-30T07:18:48Z',
  },
];

// D1 GitHub cache TTL: 1 hour (avoids hitting GitHub rate limits on every page load)
const D1_GITHUB_CACHE_TTL_MS = 60 * 60 * 1000;

// In-memory store fallback strictly for local dev / unit tests when D1 is not bound
let memoryProjects: SelectedProjectRecord[] = structuredClone(INITIAL_SELECTED_PROJECTS);
let memoryPosts: BlogPostRecord[] = [];
let nextMemoryPostId = 1;
let d1Initialized = false;

export function resetMemoryStoreForTests(): void {
  memoryProjects = structuredClone(INITIAL_SELECTED_PROJECTS);
  memoryPosts = [];
  nextMemoryPostId = 1;
}

/**
 * Ensures D1 schema (including github_repos_cache) and one-time project seed exist.
 * Optimized for Cloudflare D1 Free Tier using db.batch() to minimize round-trips and row reads.
 */
async function ensureD1Initialized(db: D1Database): Promise<void> {
  if (d1Initialized) return;

  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS github_repos_cache (
        name TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        html_url TEXT NOT NULL,
        description TEXT,
        fork INTEGER DEFAULT 0,
        language TEXT,
        stargazers_count INTEGER DEFAULT 0,
        forks_count INTEGER DEFAULT 0,
        pushed_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        owner_login TEXT NOT NULL,
        owner_type TEXT NOT NULL,
        cached_at INTEGER NOT NULL
      )`
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_github_repos_cache_pushed
       ON github_repos_cache(pushed_at DESC)`
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS selected_projects (
        repo_name TEXT PRIMARY KEY,
        display_order INTEGER DEFAULT 0,
        status_label TEXT DEFAULT '진행 중',
        custom_description TEXT,
        cached_lang TEXT,
        cached_stars INTEGER DEFAULT 0,
        cached_url TEXT,
        updated_at TEXT
      )`
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_selected_projects_order
       ON selected_projects(display_order ASC, repo_name ASC)`
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS blog_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        content_md TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        is_published INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_blog_posts_published_created
       ON blog_posts(is_published, created_at DESC, id DESC)`
    ),
  ]);

  const seededMeta = await db
    .prepare("SELECT value FROM app_meta WHERE key = 'projects_seeded'")
    .first<{ value: string }>();

  if (!seededMeta) {
    const projCount = await db
      .prepare('SELECT COUNT(*) as cnt FROM selected_projects')
      .first<{ cnt: number }>();

    const statements: D1PreparedStatement[] = [];
    if (!projCount || Number(projCount.cnt) === 0) {
      for (const p of INITIAL_SELECTED_PROJECTS) {
        statements.push(
          db
            .prepare(
              `INSERT OR IGNORE INTO selected_projects
               (repo_name, display_order, status_label, custom_description, cached_lang, cached_stars, cached_url, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              p.repo_name,
              p.display_order,
              p.status_label,
              p.custom_description,
              p.cached_lang,
              p.cached_stars,
              p.cached_url,
              p.updated_at
            )
        );
      }
    }
    statements.push(
      db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('projects_seeded', '1')")
    );
    await db.batch(statements);
  }

  // Ensure github_repos_cache has baseline repositories if empty
  const cachedRepoCount = await db
    .prepare('SELECT COUNT(*) as cnt FROM github_repos_cache')
    .first<{ cnt: number }>();

  if (!cachedRepoCount || Number(cachedRepoCount.cnt) === 0) {
    const now = Date.now();
    const seedStmts = FALLBACK_REPOS.map((r) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO github_repos_cache
           (name, full_name, html_url, description, fork, language, stargazers_count, forks_count, pushed_at, updated_at, owner_login, owner_type, cached_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          r.name,
          r.full_name,
          r.html_url,
          r.description,
          r.fork ? 1 : 0,
          r.language,
          r.stargazers_count,
          r.forks_count,
          r.pushed_at,
          r.updated_at,
          r.owner.login,
          r.owner.type,
          now
        )
    );
    if (seedStmts.length > 0) {
      await db.batch(seedStmts);
    }
  }

  d1Initialized = true;
}

interface CachedRepoRow {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: number;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  updated_at: string;
  owner_login: string;
  owner_type: string;
  cached_at: number;
}

function mapCachedRowToRepo(row: CachedRepoRow): GitHubRepo {
  return {
    name: row.name,
    full_name: row.full_name,
    html_url: row.html_url,
    description: row.description ?? null,
    fork: Boolean(row.fork === 1),
    private: false,
    language: row.language ?? null,
    stargazers_count: Number(row.stargazers_count) || 0,
    forks_count: Number(row.forks_count) || 0,
    pushed_at: row.pushed_at,
    updated_at: row.updated_at,
    owner: {
      login: row.owner_login,
      type: row.owner_type,
    },
  };
}

/**
 * Reads GitHub Profile from D1 cache (`app_meta.github_profile_cache`) first.
 * Only queries GitHub API if cache is older than 1 hour or missing, preserving cached data on rate limit.
 */
export async function getCachedGitHubProfile(
  env?: Env,
  forceRefresh = false
): Promise<GitHubProfile> {
  if (env?.DB) {
    await ensureD1Initialized(env.DB);
    const metaRow = await env.DB.prepare(
      "SELECT value FROM app_meta WHERE key = 'github_profile_cache'"
    ).first<{ value: string }>();

    let cachedProfile: { profile: GitHubProfile; cachedAt: number } | null = null;
    if (metaRow?.value) {
      try {
        cachedProfile = JSON.parse(metaRow.value) as {
          profile: GitHubProfile;
          cachedAt: number;
        };
      } catch {
        cachedProfile = null;
      }
    }

    const now = Date.now();
    if (!forceRefresh && cachedProfile && now - cachedProfile.cachedAt < D1_GITHUB_CACHE_TTL_MS) {
      return cachedProfile.profile;
    }

    const fresh = await fetchGitHubProfileFromApi(env.GITHUB_TOKEN);
    if (fresh) {
      await env.DB.prepare(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('github_profile_cache', ?)"
      )
        .bind(JSON.stringify({ profile: fresh, cachedAt: now }))
        .run();
      return fresh;
    }

    if (cachedProfile?.profile) {
      return cachedProfile.profile;
    }
  }

  const apiProfile = await fetchGitHubProfileFromApi(env?.GITHUB_TOKEN);
  return apiProfile ?? FALLBACK_PROFILE;
}

/**
 * Reads owned public GitHub repositories from D1 `github_repos_cache` table.
 * Prevents GitHub "Too Many Requests" by only syncing with GitHub API when:
 * 1) `forceRefresh` is explicitly requested (e.g. clicking "Refresh GitHub" in /admin), OR
 * 2) The D1 cache hasn't been synced within the last 1 hour.
 * If GitHub API returns 403/429 rate limit, D1 cached repositories are preserved intact.
 */
export async function getCachedOwnedPublicRepos(
  env?: Env,
  forceRefresh = false
): Promise<GitHubRepo[]> {
  if (env?.DB) {
    await ensureD1Initialized(env.DB);

    const [syncMeta, cachedRowsResult] = await Promise.all([
      env.DB.prepare("SELECT value FROM app_meta WHERE key = 'github_repos_synced_at'").first<{
        value: string;
      }>(),
      env.DB.prepare('SELECT * FROM github_repos_cache ORDER BY pushed_at DESC').all<CachedRepoRow>(),
    ]);

    const cachedRows = cachedRowsResult.results ?? [];
    const lastSyncedAt = syncMeta?.value ? Number(syncMeta.value) : 0;
    const now = Date.now();
    const isCacheFresh =
      cachedRows.length > 0 && lastSyncedAt > 0 && now - lastSyncedAt < D1_GITHUB_CACHE_TTL_MS;

    if (!forceRefresh && isCacheFresh) {
      return cachedRows.map(mapCachedRowToRepo);
    }

    // Attempt to refresh from GitHub API
    const freshRepos = await fetchOwnedPublicReposFromApi(env.GITHUB_TOKEN);
    if (freshRepos && freshRepos.length > 0) {
      const statements: D1PreparedStatement[] = [
        env.DB.prepare('DELETE FROM github_repos_cache'),
        ...freshRepos.map((r) =>
          env.DB!.prepare(
            `INSERT INTO github_repos_cache
             (name, full_name, html_url, description, fork, language, stargazers_count, forks_count, pushed_at, updated_at, owner_login, owner_type, cached_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            r.name,
            r.full_name,
            r.html_url,
            r.description,
            r.fork ? 1 : 0,
            r.language,
            r.stargazers_count,
            r.forks_count,
            r.pushed_at,
            r.updated_at,
            r.owner.login,
            r.owner.type,
            now
          )
        ),
        env.DB.prepare(
          "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('github_repos_synced_at', ?)"
        ).bind(String(now)),
      ];
      await env.DB.batch(statements);
      return freshRepos;
    }

    // If GitHub API failed or hit rate limit, mark attempt timestamp briefly (5 min backoff)
    // so we don't hammer GitHub on every request, and return existing D1 cached rows!
    if (cachedRows.length > 0) {
      const backoffTimestamp = now - D1_GITHUB_CACHE_TTL_MS + 5 * 60 * 1000;
      await env.DB.prepare(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('github_repos_synced_at', ?)"
      )
        .bind(String(backoffTimestamp))
        .run();
      return cachedRows.map(mapCachedRowToRepo);
    }
  }

  const fresh = await fetchOwnedPublicReposFromApi(env?.GITHUB_TOKEN);
  return fresh ?? FALLBACK_REPOS;
}

export async function getSelectedProjects(env?: Env): Promise<SelectedProjectRecord[]> {
  if (env?.DB) {
    await ensureD1Initialized(env.DB);
    const { results } = await env.DB.prepare(
      'SELECT * FROM selected_projects ORDER BY display_order ASC, repo_name ASC'
    ).all<SelectedProjectRecord>();
    return results ?? [];
  }
  return [...memoryProjects].sort((a, b) => a.display_order - b.display_order);
}

export interface SaveProjectSelectionInput {
  repo_name: string;
  display_order: number;
  status_label?: string;
  custom_description?: string | null;
}

export async function saveSelectedProjects(
  env: Env | undefined,
  selections: SaveProjectSelectionInput[]
): Promise<SelectedProjectRecord[]> {
  const repos = await getCachedOwnedPublicRepos(env, false);
  const repoMap = new Map<string, GitHubRepo>(repos.map((r) => [r.name, r]));

  const normalized: SelectedProjectRecord[] = selections
    .filter((s) => s && typeof s.repo_name === 'string' && s.repo_name.trim().length > 0)
    .map((s, idx) => {
      const gh = repoMap.get(s.repo_name);
      return {
        repo_name: s.repo_name.trim(),
        display_order: typeof s.display_order === 'number' ? s.display_order : idx + 1,
        status_label: (s.status_label || '진행 중').trim(),
        custom_description:
          s.custom_description && s.custom_description.trim().length > 0
            ? s.custom_description.trim()
            : null,
        cached_lang: gh?.language ?? null,
        cached_stars: gh?.stargazers_count ?? 0,
        cached_url: gh?.html_url ?? `https://github.com/uz-it-one/${s.repo_name.trim()}`,
        updated_at: gh?.pushed_at ?? new Date().toISOString(),
      };
    })
    .sort((a, b) => a.display_order - b.display_order);

  memoryProjects = structuredClone(normalized);

  if (env?.DB) {
    await ensureD1Initialized(env.DB);
    const statements: D1PreparedStatement[] = [
      env.DB.prepare('DELETE FROM selected_projects'),
      ...normalized.map((item) =>
        env.DB!.prepare(
          `INSERT INTO selected_projects
           (repo_name, display_order, status_label, custom_description, cached_lang, cached_stars, cached_url, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          item.repo_name,
          item.display_order,
          item.status_label,
          item.custom_description,
          item.cached_lang,
          item.cached_stars,
          item.cached_url,
          item.updated_at
        )
      ),
    ];
    await env.DB.batch(statements);
  }

  return normalized;
}

export async function getMergedActiveProjects(env?: Env): Promise<ActiveProjectView[]> {
  const [selected, ownedRepos] = await Promise.all([
    getSelectedProjects(env),
    getCachedOwnedPublicRepos(env, false),
  ]);
  const repoMap = new Map<string, GitHubRepo>(ownedRepos.map((r) => [r.name, r]));

  return selected.map((sel) => {
    const gh = repoMap.get(sel.repo_name);
    const language = gh?.language ?? sel.cached_lang ?? null;
    const pushedAt = gh?.pushed_at ?? sel.updated_at;
    const ghDesc = gh?.description ?? null;
    const finalDesc =
      sel.custom_description && sel.custom_description.trim().length > 0
        ? sel.custom_description.trim()
        : ghDesc ?? '';

    return {
      repo_name: sel.repo_name,
      display_order: sel.display_order,
      status_label: sel.status_label || '진행 중',
      description: finalDesc,
      custom_description: sel.custom_description,
      github_description: ghDesc,
      language,
      language_color: getLanguageColor(language),
      stars: gh?.stargazers_count ?? sel.cached_stars ?? 0,
      html_url: gh?.html_url ?? sel.cached_url ?? `https://github.com/uz-it-one/${sel.repo_name}`,
      pushed_at: pushedAt,
      updated_month: formatYearMonth(pushedAt),
      fork: gh?.fork ?? false,
    };
  });
}

function normalizeBlogRow(row: Record<string, unknown>): BlogPostRecord {
  let parsedTags: string[] = [];
  if (Array.isArray(row.tags)) {
    parsedTags = row.tags.map(String);
  } else if (typeof row.tags === 'string') {
    try {
      const parsed = JSON.parse(row.tags);
      if (Array.isArray(parsed)) parsedTags = parsed.map(String);
    } catch {
      parsedTags = row.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }
  return {
    id: Number(row.id),
    slug: String(row.slug),
    title: String(row.title),
    summary: row.summary ? String(row.summary) : '',
    content_md: String(row.content_md),
    tags: parsedTags,
    is_published: Boolean(row.is_published === true || Number(row.is_published) === 1),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getBlogPosts(
  env?: Env,
  options?: { includeDrafts?: boolean; tag?: string; search?: string }
): Promise<BlogPostRecord[]> {
  let posts: BlogPostRecord[];

  if (env?.DB) {
    await ensureD1Initialized(env.DB);
    const query = options?.includeDrafts
      ? 'SELECT * FROM blog_posts ORDER BY created_at DESC, id DESC'
      : 'SELECT * FROM blog_posts WHERE is_published = 1 ORDER BY created_at DESC, id DESC';
    const { results } = await env.DB.prepare(query).all<Record<string, unknown>>();
    posts = (results ?? []).map(normalizeBlogRow);
  } else {
    posts = [...memoryPosts].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (!options?.includeDrafts) {
      posts = posts.filter((p) => p.is_published);
    }
  }

  if (options?.tag && options.tag !== 'All') {
    const targetTag = options.tag.toLowerCase();
    posts = posts.filter((p) => p.tags.some((t) => t.toLowerCase() === targetTag));
  }
  if (options?.search && options.search.trim().length > 0) {
    const q = options.search.trim().toLowerCase();
    posts = posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  return posts;
}

export async function getBlogPostBySlug(
  env: Env | undefined,
  slug: string,
  includeDrafts = false
): Promise<BlogPostRecord | null> {
  if (env?.DB) {
    await ensureD1Initialized(env.DB);
    const query = includeDrafts
      ? 'SELECT * FROM blog_posts WHERE slug = ? LIMIT 1'
      : 'SELECT * FROM blog_posts WHERE slug = ? AND is_published = 1 LIMIT 1';
    const row = await env.DB.prepare(query).bind(slug).first<Record<string, unknown>>();
    return row ? normalizeBlogRow(row) : null;
  }

  const all = await getBlogPosts(env, { includeDrafts: true });
  const found = all.find((p) => p.slug === slug);
  if (!found) return null;
  if (!includeDrafts && !found.is_published) return null;
  return found;
}

export async function getAdjacentPosts(
  env: Env | undefined,
  slug: string
): Promise<{ prev: BlogPostRecord | null; next: BlogPostRecord | null }> {
  const published = await getBlogPosts(env, { includeDrafts: false });
  const idx = published.findIndex((p) => p.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  const next = idx > 0 ? published[idx - 1] : null;
  const prev = idx < published.length - 1 ? published[idx + 1] : null;
  return { prev, next };
}

export function sanitizeSlug(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || `post-${Date.now()}`;
}

export async function saveBlogPost(
  env: Env | undefined,
  input: BlogPostInput
): Promise<BlogPostRecord> {
  const now = new Date().toISOString();
  const title = input.title.trim();
  const slug = sanitizeSlug(input.slug || title);
  const summary = (input.summary ?? '').trim();
  const content_md = input.content_md;
  const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const is_published = input.is_published ?? true;

  if (env?.DB) {
    await ensureD1Initialized(env.DB);
    if (input.id) {
      await env.DB.prepare(
        `UPDATE blog_posts
         SET slug = ?, title = ?, summary = ?, content_md = ?, tags = ?, is_published = ?, updated_at = ?
         WHERE id = ?`
      )
        .bind(
          slug,
          title,
          summary,
          content_md,
          JSON.stringify(tags),
          is_published ? 1 : 0,
          now,
          input.id
        )
        .run();
      const row = await env.DB.prepare('SELECT * FROM blog_posts WHERE id = ?')
        .bind(input.id)
        .first<Record<string, unknown>>();
      if (row) return normalizeBlogRow(row);
    } else {
      const existingSlug = await env.DB.prepare('SELECT id FROM blog_posts WHERE slug = ?')
        .bind(slug)
        .first<{ id: number }>();
      const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug;

      await env.DB.prepare(
        `INSERT INTO blog_posts
         (slug, title, summary, content_md, tags, is_published, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          finalSlug,
          title,
          summary,
          content_md,
          JSON.stringify(tags),
          is_published ? 1 : 0,
          now,
          now
        )
        .run();
      const row = await env.DB.prepare('SELECT * FROM blog_posts WHERE slug = ?')
        .bind(finalSlug)
        .first<Record<string, unknown>>();
      if (row) return normalizeBlogRow(row);
    }
  }

  if (input.id) {
    const existingIdx = memoryPosts.findIndex((p) => p.id === input.id);
    if (existingIdx !== -1) {
      const updated: BlogPostRecord = {
        ...memoryPosts[existingIdx],
        slug,
        title,
        summary,
        content_md,
        tags,
        is_published,
        updated_at: now,
      };
      memoryPosts[existingIdx] = updated;
      return updated;
    }
  }

  const slugConflict = memoryPosts.find((p) => p.slug === slug);
  const finalSlug = slugConflict ? `${slug}-${nextMemoryPostId}` : slug;

  const created: BlogPostRecord = {
    id: nextMemoryPostId++,
    slug: finalSlug,
    title,
    summary,
    content_md,
    tags,
    is_published,
    created_at: now,
    updated_at: now,
  };
  memoryPosts.unshift(created);
  return created;
}

export async function deleteBlogPost(env: Env | undefined, id: number): Promise<boolean> {
  const beforeLen = memoryPosts.length;
  memoryPosts = memoryPosts.filter((p) => p.id !== id);
  let deleted = memoryPosts.length < beforeLen;

  if (env?.DB) {
    await ensureD1Initialized(env.DB);
    const res = await env.DB.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
    if (res.success) deleted = true;
  }

  return deleted;
}
