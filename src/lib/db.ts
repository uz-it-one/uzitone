import {
  FALLBACK_PROFILE,
  FALLBACK_REPOS,
  fetchGitHubProfileFromApi,
  fetchOwnedPublicReposFromApi,
  formatYearMonth,
  getLanguageColor,
  GITHUB_USERNAME,
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

export interface SaveProjectSelectionInput {
  repo_name: string;
  display_order: number;
  status_label?: string;
  custom_description?: string | null;
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

const DEFAULT_PROJECT_STATUS = '진행 중';
const D1_GITHUB_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes

const INITIAL_SELECTED_PROJECTS: SelectedProjectRecord[] = [
  {
    repo_name: 'mac-hwp-preview',
    display_order: 1,
    status_label: DEFAULT_PROJECT_STATUS,
    custom_description: null,
    cached_lang: 'Swift',
    cached_stars: 0,
    cached_url: 'https://github.com/uz-it-one/mac-hwp-preview',
    updated_at: '2026-11-03T05:30:46Z',
  },
  {
    repo_name: 'region-check',
    display_order: 2,
    status_label: DEFAULT_PROJECT_STATUS,
    custom_description: null,
    cached_lang: 'Python',
    cached_stars: 1,
    cached_url: 'https://github.com/uz-it-one/region-check',
    updated_at: '2026-04-21T14:29:20Z',
  },
  {
    repo_name: 'Transducer',
    display_order: 3,
    status_label: DEFAULT_PROJECT_STATUS,
    custom_description: null,
    cached_lang: 'Swift',
    cached_stars: 0,
    cached_url: 'https://github.com/uz-it-one/Transducer',
    updated_at: '2023-11-30T07:18:48Z',
  },
];

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

/* -------------------------------------------------------------------------- */
/* D1 Schema Initialization & SQL Statement Builders                          */
/* -------------------------------------------------------------------------- */

function prepareInsertSelectedProject(
  db: D1Database,
  project: SelectedProjectRecord,
  orIgnore = false
): D1PreparedStatement {
  const verb = orIgnore ? 'INSERT OR IGNORE' : 'INSERT';
  return db
    .prepare(
      `${verb} INTO selected_projects
       (repo_name, display_order, status_label, custom_description, cached_lang, cached_stars, cached_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      project.repo_name,
      project.display_order,
      project.status_label,
      project.custom_description,
      project.cached_lang,
      project.cached_stars,
      project.cached_url,
      project.updated_at
    );
}

function prepareInsertCachedRepo(
  db: D1Database,
  repo: GitHubRepo,
  cachedAt: number,
  orIgnore = false
): D1PreparedStatement {
  const verb = orIgnore ? 'INSERT OR IGNORE' : 'INSERT';
  return db
    .prepare(
      `${verb} INTO github_repos_cache
       (name, full_name, html_url, description, fork, language, stargazers_count, forks_count, pushed_at, updated_at, owner_login, owner_type, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      repo.name,
      repo.full_name,
      repo.html_url,
      repo.description,
      repo.fork ? 1 : 0,
      repo.language,
      repo.stargazers_count,
      repo.forks_count,
      repo.pushed_at,
      repo.updated_at,
      repo.owner.login,
      repo.owner.type,
      cachedAt
    );
}

async function getAppMeta(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

function prepareSetAppMeta(db: D1Database, key: string, value: string): D1PreparedStatement {
  return db.prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)').bind(key, value);
}

async function createTablesIfNeeded(db: D1Database): Promise<void> {
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
}

async function seedInitialProjectsIfNeeded(db: D1Database): Promise<void> {
  const alreadySeeded = await getAppMeta(db, 'projects_seeded');
  if (alreadySeeded) return;

  const projectCount = await db
    .prepare('SELECT COUNT(*) as cnt FROM selected_projects')
    .first<{ cnt: number }>();

  const statements: D1PreparedStatement[] = [];
  const isTableEmpty = !projectCount || Number(projectCount.cnt) === 0;

  if (isTableEmpty) {
    for (const project of INITIAL_SELECTED_PROJECTS) {
      statements.push(prepareInsertSelectedProject(db, project, true));
    }
  }

  statements.push(prepareSetAppMeta(db, 'projects_seeded', '1'));
  await db.batch(statements);
}

async function seedFallbackReposCacheIfNeeded(db: D1Database): Promise<void> {
  const cachedRepoCount = await db
    .prepare('SELECT COUNT(*) as cnt FROM github_repos_cache')
    .first<{ cnt: number }>();

  const isCacheEmpty = !cachedRepoCount || Number(cachedRepoCount.cnt) === 0;
  if (!isCacheEmpty || FALLBACK_REPOS.length === 0) return;

  const now = Date.now();
  const seedStatements = FALLBACK_REPOS.map((repo) =>
    prepareInsertCachedRepo(db, repo, now, true)
  );
  await db.batch(seedStatements);
}

/**
 * Ensures D1 schema and one-time initial seeds exist.
 * Uses db.batch() to minimize round-trips on the Cloudflare D1 Free Tier.
 */
async function ensureD1Initialized(db: D1Database): Promise<void> {
  if (d1Initialized) return;

  await createTablesIfNeeded(db);
  await seedInitialProjectsIfNeeded(db);
  await seedFallbackReposCacheIfNeeded(db);

  d1Initialized = true;
}

/* -------------------------------------------------------------------------- */
/* GitHub Profile & Repositories D1 Cache                                     */
/* -------------------------------------------------------------------------- */

function mapCachedRowToRepo(row: CachedRepoRow): GitHubRepo {
  return {
    name: row.name,
    full_name: row.full_name,
    html_url: row.html_url,
    description: row.description ?? null,
    fork: row.fork === 1,
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

function parseCachedProfile(rawJson: string | null): {
  profile: GitHubProfile;
  cachedAt: number;
} | null {
  if (!rawJson) return null;
  try {
    return JSON.parse(rawJson) as { profile: GitHubProfile; cachedAt: number };
  } catch {
    return null;
  }
}

/**
 * Reads GitHub Profile from D1 cache (`app_meta.github_profile_cache`) first.
 * Queries GitHub API only if the cache is older than 1 hour or missing, preserving cached data on rate limit.
 */
export async function getCachedGitHubProfile(
  env?: Env,
  forceRefresh = false
): Promise<GitHubProfile> {
  if (env?.DB) {
    await ensureD1Initialized(env.DB);

    const rawCached = await getAppMeta(env.DB, 'github_profile_cache');
    const cached = parseCachedProfile(rawCached);
    const now = Date.now();

    const isCacheFresh = cached !== null && now - cached.cachedAt < D1_GITHUB_CACHE_TTL_MS;
    if (!forceRefresh && isCacheFresh) {
      return cached.profile;
    }

    const freshProfile = await fetchGitHubProfileFromApi(env.GITHUB_TOKEN);
    if (freshProfile) {
      await prepareSetAppMeta(
        env.DB,
        'github_profile_cache',
        JSON.stringify({ profile: freshProfile, cachedAt: now })
      ).run();
      return freshProfile;
    }

    if (cached?.profile) {
      return cached.profile;
    }
  }

  const apiProfile = await fetchGitHubProfileFromApi(env?.GITHUB_TOKEN);
  return apiProfile ?? FALLBACK_PROFILE;
}

/**
 * Reads owned public GitHub repositories from D1 `github_repos_cache`.
 * Syncs with GitHub API only when `forceRefresh` is requested or the D1 cache is older than 1 hour.
 * Preserves existing D1 cached repositories if GitHub API returns 403/429 rate limit.
 */
export async function getCachedOwnedPublicRepos(
  env?: Env,
  forceRefresh = false
): Promise<GitHubRepo[]> {
  if (env?.DB) {
    await ensureD1Initialized(env.DB);

    const [lastSyncedStr, cachedRowsResult] = await Promise.all([
      getAppMeta(env.DB, 'github_repos_synced_at'),
      env.DB.prepare('SELECT * FROM github_repos_cache ORDER BY pushed_at DESC').all<CachedRepoRow>(),
    ]);

    const cachedRows = cachedRowsResult.results ?? [];
    const lastSyncedAt = lastSyncedStr ? Number(lastSyncedStr) : 0;
    const now = Date.now();
    const isCacheFresh =
      cachedRows.length > 0 && lastSyncedAt > 0 && now - lastSyncedAt < D1_GITHUB_CACHE_TTL_MS;

    if (!forceRefresh && isCacheFresh) {
      return cachedRows.map(mapCachedRowToRepo);
    }

    const freshRepos = await fetchOwnedPublicReposFromApi(env.GITHUB_TOKEN);
    if (freshRepos && freshRepos.length > 0) {
      const statements: D1PreparedStatement[] = [
        env.DB.prepare('DELETE FROM github_repos_cache'),
        ...freshRepos.map((repo) => prepareInsertCachedRepo(env.DB!, repo, now)),
        prepareSetAppMeta(env.DB, 'github_repos_synced_at', String(now)),
      ];
      await env.DB.batch(statements);
      return freshRepos;
    }

    // Back off for 5 minutes on rate-limit/error so subsequent requests don't hammer GitHub
    if (cachedRows.length > 0) {
      const backoffTimestamp = now - D1_GITHUB_CACHE_TTL_MS + RATE_LIMIT_BACKOFF_MS;
      await prepareSetAppMeta(env.DB, 'github_repos_synced_at', String(backoffTimestamp)).run();
      return cachedRows.map(mapCachedRowToRepo);
    }
  }

  const freshRepos = await fetchOwnedPublicReposFromApi(env?.GITHUB_TOKEN);
  return freshRepos ?? FALLBACK_REPOS;
}

/* -------------------------------------------------------------------------- */
/* Selected Active Projects CRUD                                              */
/* -------------------------------------------------------------------------- */

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

export async function saveSelectedProjects(
  env: Env | undefined,
  selections: SaveProjectSelectionInput[]
): Promise<SelectedProjectRecord[]> {
  const ownedRepos = await getCachedOwnedPublicRepos(env, false);
  const repoByName = new Map<string, GitHubRepo>(ownedRepos.map((repo) => [repo.name, repo]));

  const validSelections = selections.filter(
    (selection) =>
      selection && typeof selection.repo_name === 'string' && selection.repo_name.trim().length > 0
  );

  const normalizedProjects: SelectedProjectRecord[] = validSelections
    .map((selection, index) => {
      const repoName = selection.repo_name.trim();
      const githubRepo = repoByName.get(repoName);
      const customDescription = selection.custom_description?.trim() || null;

      return {
        repo_name: repoName,
        display_order:
          typeof selection.display_order === 'number' ? selection.display_order : index + 1,
        status_label: (selection.status_label || DEFAULT_PROJECT_STATUS).trim(),
        custom_description: customDescription,
        cached_lang: githubRepo?.language ?? null,
        cached_stars: githubRepo?.stargazers_count ?? 0,
        cached_url: githubRepo?.html_url ?? `https://github.com/${GITHUB_USERNAME}/${repoName}`,
        updated_at: githubRepo?.pushed_at ?? new Date().toISOString(),
      };
    })
    .sort((a, b) => a.display_order - b.display_order);

  memoryProjects = structuredClone(normalizedProjects);

  if (env?.DB) {
    await ensureD1Initialized(env.DB);
    const statements: D1PreparedStatement[] = [
      env.DB.prepare('DELETE FROM selected_projects'),
      ...normalizedProjects.map((project) => prepareInsertSelectedProject(env.DB!, project)),
    ];
    await env.DB.batch(statements);
  }

  return normalizedProjects;
}

export async function getMergedActiveProjects(env?: Env): Promise<ActiveProjectView[]> {
  const [selectedProjects, ownedRepos] = await Promise.all([
    getSelectedProjects(env),
    getCachedOwnedPublicRepos(env, false),
  ]);
  const repoByName = new Map<string, GitHubRepo>(ownedRepos.map((repo) => [repo.name, repo]));

  return selectedProjects.map((selected) => {
    const githubRepo = repoByName.get(selected.repo_name);
    const language = githubRepo?.language ?? selected.cached_lang ?? null;
    const pushedAt = githubRepo?.pushed_at ?? selected.updated_at;
    const githubDescription = githubRepo?.description ?? null;
    const customDescription = selected.custom_description?.trim() || null;

    return {
      repo_name: selected.repo_name,
      display_order: selected.display_order,
      status_label: selected.status_label || DEFAULT_PROJECT_STATUS,
      description: customDescription ?? githubDescription ?? '',
      custom_description: selected.custom_description,
      github_description: githubDescription,
      language,
      language_color: getLanguageColor(language),
      stars: githubRepo?.stargazers_count ?? selected.cached_stars ?? 0,
      html_url:
        githubRepo?.html_url ??
        selected.cached_url ??
        `https://github.com/${GITHUB_USERNAME}/${selected.repo_name}`,
      pushed_at: pushedAt,
      updated_month: formatYearMonth(pushedAt),
      fork: githubRepo?.fork ?? false,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Markdown Blog Posts CRUD                                                   */
/* -------------------------------------------------------------------------- */

function parseTagsColumn(rawTags: unknown): string[] {
  if (Array.isArray(rawTags)) {
    return rawTags.map(String);
  }
  if (typeof rawTags === 'string') {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return rawTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function normalizeBlogRow(row: Record<string, unknown>): BlogPostRecord {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    title: String(row.title),
    summary: row.summary ? String(row.summary) : '',
    content_md: String(row.content_md),
    tags: parseTagsColumn(row.tags),
    is_published: row.is_published === true || Number(row.is_published) === 1,
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
      posts = posts.filter((post) => post.is_published);
    }
  }

  if (options?.tag && options.tag !== 'All') {
    const targetTag = options.tag.toLowerCase();
    posts = posts.filter((post) => post.tags.some((tag) => tag.toLowerCase() === targetTag));
  }

  const searchQuery = options?.search?.trim().toLowerCase();
  if (searchQuery) {
    posts = posts.filter(
      (post) =>
        post.title.toLowerCase().includes(searchQuery) ||
        post.summary.toLowerCase().includes(searchQuery) ||
        post.tags.some((tag) => tag.toLowerCase().includes(searchQuery))
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

  const allPosts = await getBlogPosts(env, { includeDrafts: true });
  const matchedPost = allPosts.find((post) => post.slug === slug);
  if (!matchedPost) return null;
  if (!includeDrafts && !matchedPost.is_published) return null;
  return matchedPost;
}

export async function getAdjacentPosts(
  env: Env | undefined,
  slug: string
): Promise<{ prev: BlogPostRecord | null; next: BlogPostRecord | null }> {
  const publishedPosts = await getBlogPosts(env, { includeDrafts: false });
  const currentIndex = publishedPosts.findIndex((post) => post.slug === slug);
  if (currentIndex === -1) {
    return { prev: null, next: null };
  }

  // Posts are ordered newest-first: index - 1 is newer (next), index + 1 is older (prev)
  const next = currentIndex > 0 ? publishedPosts[currentIndex - 1] : null;
  const prev = currentIndex < publishedPosts.length - 1 ? publishedPosts[currentIndex + 1] : null;
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

interface NormalizedPostPayload {
  id?: number;
  slug: string;
  title: string;
  summary: string;
  content_md: string;
  tags: string[];
  is_published: boolean;
  now: string;
}

async function saveBlogPostInD1(
  db: D1Database,
  payload: NormalizedPostPayload
): Promise<BlogPostRecord | null> {
  const tagsJson = JSON.stringify(payload.tags);
  const publishedFlag = payload.is_published ? 1 : 0;

  if (payload.id) {
    await db
      .prepare(
        `UPDATE blog_posts
         SET slug = ?, title = ?, summary = ?, content_md = ?, tags = ?, is_published = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        payload.slug,
        payload.title,
        payload.summary,
        payload.content_md,
        tagsJson,
        publishedFlag,
        payload.now,
        payload.id
      )
      .run();

    const updatedRow = await db
      .prepare('SELECT * FROM blog_posts WHERE id = ?')
      .bind(payload.id)
      .first<Record<string, unknown>>();
    return updatedRow ? normalizeBlogRow(updatedRow) : null;
  }

  const slugConflict = await db
    .prepare('SELECT id FROM blog_posts WHERE slug = ?')
    .bind(payload.slug)
    .first<{ id: number }>();
  const finalSlug = slugConflict ? `${payload.slug}-${Date.now().toString(36)}` : payload.slug;

  await db
    .prepare(
      `INSERT INTO blog_posts
       (slug, title, summary, content_md, tags, is_published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      finalSlug,
      payload.title,
      payload.summary,
      payload.content_md,
      tagsJson,
      publishedFlag,
      payload.now,
      payload.now
    )
    .run();

  const insertedRow = await db
    .prepare('SELECT * FROM blog_posts WHERE slug = ?')
    .bind(finalSlug)
    .first<Record<string, unknown>>();
  return insertedRow ? normalizeBlogRow(insertedRow) : null;
}

function saveBlogPostInMemory(payload: NormalizedPostPayload): BlogPostRecord {
  if (payload.id) {
    const existingIndex = memoryPosts.findIndex((post) => post.id === payload.id);
    if (existingIndex !== -1) {
      const updatedPost: BlogPostRecord = {
        ...memoryPosts[existingIndex],
        slug: payload.slug,
        title: payload.title,
        summary: payload.summary,
        content_md: payload.content_md,
        tags: payload.tags,
        is_published: payload.is_published,
        updated_at: payload.now,
      };
      memoryPosts[existingIndex] = updatedPost;
      return updatedPost;
    }
  }

  const hasSlugConflict = memoryPosts.some((post) => post.slug === payload.slug);
  const finalSlug = hasSlugConflict ? `${payload.slug}-${nextMemoryPostId}` : payload.slug;

  const createdPost: BlogPostRecord = {
    id: nextMemoryPostId++,
    slug: finalSlug,
    title: payload.title,
    summary: payload.summary,
    content_md: payload.content_md,
    tags: payload.tags,
    is_published: payload.is_published,
    created_at: payload.now,
    updated_at: payload.now,
  };
  memoryPosts.unshift(createdPost);
  return createdPost;
}

export async function saveBlogPost(
  env: Env | undefined,
  input: BlogPostInput
): Promise<BlogPostRecord> {
  const title = input.title.trim();
  const payload: NormalizedPostPayload = {
    id: input.id,
    title,
    slug: sanitizeSlug(input.slug || title),
    summary: (input.summary ?? '').trim(),
    content_md: input.content_md,
    tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    is_published: input.is_published ?? true,
    now: new Date().toISOString(),
  };

  if (env?.DB) {
    await ensureD1Initialized(env.DB);
    const savedInD1 = await saveBlogPostInD1(env.DB, payload);
    if (savedInD1) return savedInD1;
  }

  return saveBlogPostInMemory(payload);
}

export async function deleteBlogPost(env: Env | undefined, id: number): Promise<boolean> {
  const previousCount = memoryPosts.length;
  memoryPosts = memoryPosts.filter((post) => post.id !== id);
  let deleted = memoryPosts.length < previousCount;

  if (env?.DB) {
    await ensureD1Initialized(env.DB);
    const result = await env.DB.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
    if (result.success) {
      deleted = true;
    }
  }

  return deleted;
}
