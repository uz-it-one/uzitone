import { CF_RUNTIME_CREDENTIALS } from './cf-credentials';
import {
  fetchOwnedPublicRepos,
  formatYearMonth,
  getLanguageColor,
  type GitHubRepo,
} from './github';
import persistedSeed from './persisted-seed.json';

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

const INITIAL_SELECTED_PROJECTS: SelectedProjectRecord[] = Array.isArray(persistedSeed?.projects)
  ? (persistedSeed.projects as SelectedProjectRecord[])
  : [
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

// No default welcome blog post on deployment
const INITIAL_BLOG_POSTS: BlogPostRecord[] = Array.isArray(persistedSeed?.posts)
  ? (persistedSeed.posts as BlogPostRecord[]).filter((p) => p.slug !== 'welcome-to-uzit-one')
  : [];

const KV_PROJECTS_KEY = 'uzitone:selected_projects';
const KV_POSTS_KEY = 'uzitone:blog_posts';
const CF_DATA_PROJECT_NAME = 'uzitone-data';

// In-memory store fallback for local development & unit tests
let memoryProjects: SelectedProjectRecord[] = structuredClone(INITIAL_SELECTED_PROJECTS);
let memoryPosts: BlogPostRecord[] = structuredClone(INITIAL_BLOG_POSTS);
let nextMemoryPostId =
  INITIAL_BLOG_POSTS.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
let d1Initialized = false;

// Short-lived cache for Cloudflare Pages Control-Plane Store
let remoteStoreCache: {
  projects: SelectedProjectRecord[] | null;
  posts: BlogPostRecord[] | null;
  expiresAt: number;
} | null = null;
const REMOTE_CACHE_TTL_MS = 2000;

export function resetMemoryStoreForTests(): void {
  memoryProjects = structuredClone(INITIAL_SELECTED_PROJECTS);
  memoryPosts = [];
  nextMemoryPostId = 1;
  remoteStoreCache = null;
}

function getCfCredentials(): { accountId: string; apiToken: string } | null {
  const accountId = CF_RUNTIME_CREDENTIALS.accountId?.trim();
  const apiToken = CF_RUNTIME_CREDENTIALS.apiToken?.trim();
  if (accountId && apiToken) {
    return { accountId, apiToken };
  }
  return null;
}

interface CfPagesProjectResponse {
  success?: boolean;
  result?: {
    deployment_configs?: {
      production?: {
        env_vars?: Record<
          string,
          {
            type?: string;
            value?: string;
          } | null
        >;
      };
    };
  };
}

async function ensureDataProjectExists(accountId: string, apiToken: string): Promise<void> {
  await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: CF_DATA_PROJECT_NAME,
      production_branch: 'main',
    }),
  });
}

async function readCfControlPlaneStore(): Promise<{
  projects: SelectedProjectRecord[] | null;
  posts: BlogPostRecord[] | null;
} | null> {
  const creds = getCfCredentials();
  if (!creds) return null;

  const now = Date.now();
  if (remoteStoreCache && remoteStoreCache.expiresAt > now) {
    return {
      projects: remoteStoreCache.projects,
      posts: remoteStoreCache.posts,
    };
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/pages/projects/${CF_DATA_PROJECT_NAME}`;
    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${creds.apiToken}` },
    });

    if (res.status === 404) {
      await ensureDataProjectExists(creds.accountId, creds.apiToken);
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${creds.apiToken}` },
      });
    }

    if (!res.ok) return null;

    const data = (await res.json()) as CfPagesProjectResponse;
    const envVars = data?.result?.deployment_configs?.production?.env_vars ?? {};

    let projects: SelectedProjectRecord[] | null = null;
    let posts: BlogPostRecord[] | null = null;

    const rawProjects = envVars.UZITONE_PROJECTS_JSON?.value;
    if (typeof rawProjects === 'string' && rawProjects.trim().length > 0) {
      try {
        projects = JSON.parse(rawProjects) as SelectedProjectRecord[];
      } catch {
        projects = null;
      }
    }

    const rawPosts = envVars.UZITONE_POSTS_JSON?.value;
    if (typeof rawPosts === 'string' && rawPosts.trim().length > 0) {
      try {
        const parsed = JSON.parse(rawPosts) as BlogPostRecord[];
        posts = parsed.filter((p) => p.slug !== 'welcome-to-uzit-one');
      } catch {
        posts = null;
      }
    }

    remoteStoreCache = {
      projects,
      posts,
      expiresAt: Date.now() + REMOTE_CACHE_TTL_MS,
    };

    return { projects, posts };
  } catch (err) {
    console.error('readCfControlPlaneStore error:', err);
    return null;
  }
}

async function writeCfControlPlaneStore(update: {
  projects?: SelectedProjectRecord[];
  posts?: BlogPostRecord[];
}): Promise<boolean> {
  const creds = getCfCredentials();
  if (!creds) return false;

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/pages/projects/${CF_DATA_PROJECT_NAME}`;
    const envVarsPatch: Record<string, { type: string; value: string }> = {};

    if (update.projects !== undefined) {
      envVarsPatch.UZITONE_PROJECTS_JSON = {
        type: 'plain_text',
        value: JSON.stringify(update.projects),
      };
    }
    if (update.posts !== undefined) {
      envVarsPatch.UZITONE_POSTS_JSON = {
        type: 'plain_text',
        value: JSON.stringify(update.posts),
      };
    }

    let res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${creds.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deployment_configs: {
          production: {
            env_vars: envVarsPatch,
          },
        },
      }),
    });

    if (res.status === 404) {
      await ensureDataProjectExists(creds.accountId, creds.apiToken);
      res = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${creds.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deployment_configs: {
            production: {
              env_vars: envVarsPatch,
            },
          },
        }),
      });
    }

    if (res.ok) {
      remoteStoreCache = {
        projects:
          update.projects !== undefined
            ? structuredClone(update.projects)
            : (remoteStoreCache?.projects ?? null),
        posts:
          update.posts !== undefined
            ? structuredClone(update.posts)
            : (remoteStoreCache?.posts ?? null),
        expiresAt: Date.now() + REMOTE_CACHE_TTL_MS,
      };
      return true;
    }
    return false;
  } catch (err) {
    console.error('writeCfControlPlaneStore error:', err);
    return false;
  }
}

async function ensureD1Initialized(db: D1Database): Promise<void> {
  if (d1Initialized) return;

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
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
    )
    .run();

  await db
    .prepare(
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
    )
    .run();

  const seededMeta = await db
    .prepare("SELECT value FROM app_meta WHERE key = 'projects_seeded'")
    .first<{ value: string }>();

  if (!seededMeta) {
    const projCount = await db
      .prepare('SELECT COUNT(*) as cnt FROM selected_projects')
      .first<{ cnt: number }>();

    if (!projCount || Number(projCount.cnt) === 0) {
      for (const p of INITIAL_SELECTED_PROJECTS) {
        await db
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
          .run();
      }
    }

    await db
      .prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('projects_seeded', '1')")
      .run();
  }

  const cleanedWelcome = await db
    .prepare("SELECT value FROM app_meta WHERE key = 'removed_default_welcome_post'")
    .first<{ value: string }>();

  if (!cleanedWelcome) {
    await db.prepare("DELETE FROM blog_posts WHERE slug = 'welcome-to-uzit-one'").run();
    await db
      .prepare(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('removed_default_welcome_post', '1')"
      )
      .run();
  }

  d1Initialized = true;
}

export async function getSelectedProjects(env?: Env): Promise<SelectedProjectRecord[]> {
  if (env?.DB) {
    try {
      await ensureD1Initialized(env.DB);
      const { results } = await env.DB.prepare(
        'SELECT * FROM selected_projects ORDER BY display_order ASC, repo_name ASC'
      ).all<SelectedProjectRecord>();
      return results ?? [];
    } catch (err) {
      console.error('D1 getSelectedProjects error:', err);
    }
  }

  if (env?.KV) {
    try {
      const raw = await env.KV.get(KV_PROJECTS_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as SelectedProjectRecord[];
        return parsed.sort((a, b) => a.display_order - b.display_order);
      }
    } catch (err) {
      console.error('KV getSelectedProjects error:', err);
    }
  }

  const remote = await readCfControlPlaneStore();
  if (remote && remote.projects !== null) {
    memoryProjects = structuredClone(remote.projects);
    return [...remote.projects].sort((a, b) => a.display_order - b.display_order);
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
  const repos = await fetchOwnedPublicRepos(env?.GITHUB_TOKEN);
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
    try {
      await ensureD1Initialized(env.DB);
      await env.DB.prepare('DELETE FROM selected_projects').run();
      for (const item of normalized) {
        await env.DB.prepare(
          `INSERT INTO selected_projects
           (repo_name, display_order, status_label, custom_description, cached_lang, cached_stars, cached_url, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            item.repo_name,
            item.display_order,
            item.status_label,
            item.custom_description,
            item.cached_lang,
            item.cached_stars,
            item.cached_url,
            item.updated_at
          )
          .run();
      }
    } catch (err) {
      console.error('D1 saveSelectedProjects error:', err);
    }
  }

  if (env?.KV) {
    try {
      await env.KV.put(KV_PROJECTS_KEY, JSON.stringify(normalized));
    } catch (err) {
      console.error('KV saveSelectedProjects error:', err);
    }
  }

  await writeCfControlPlaneStore({ projects: normalized });

  return normalized;
}

export async function getMergedActiveProjects(env?: Env): Promise<ActiveProjectView[]> {
  const [selected, ownedRepos] = await Promise.all([
    getSelectedProjects(env),
    fetchOwnedPublicRepos(env?.GITHUB_TOKEN),
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
        : ghDesc || '진행 중인 프로젝트입니다.';

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
  let posts: BlogPostRecord[] | null = null;

  if (env?.DB) {
    try {
      await ensureD1Initialized(env.DB);
      const { results } = await env.DB.prepare(
        'SELECT * FROM blog_posts ORDER BY created_at DESC, id DESC'
      ).all<Record<string, unknown>>();
      posts = (results ?? []).map(normalizeBlogRow);
    } catch (err) {
      console.error('D1 getBlogPosts error:', err);
    }
  }

  if (posts === null && env?.KV) {
    try {
      const raw = await env.KV.get(KV_POSTS_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as BlogPostRecord[];
        posts = parsed.sort((a, b) => b.created_at.localeCompare(a.created_at));
      } else {
        posts = [];
      }
    } catch (err) {
      console.error('KV getBlogPosts error:', err);
    }
  }

  if (posts === null) {
    const remote = await readCfControlPlaneStore();
    if (remote && remote.posts !== null) {
      memoryPosts = structuredClone(remote.posts);
      nextMemoryPostId =
        remote.posts.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
      posts = [...remote.posts].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  }

  if (posts === null) {
    posts = [...memoryPosts].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  if (!options?.includeDrafts) {
    posts = posts.filter((p) => p.is_published);
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
    try {
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
    } catch (err) {
      console.error('D1 saveBlogPost error:', err);
    }
  }

  if (env?.KV) {
    try {
      const raw = await env.KV.get(KV_POSTS_KEY);
      const currentPosts: BlogPostRecord[] = raw ? (JSON.parse(raw) as BlogPostRecord[]) : [];
      if (input.id) {
        const idx = currentPosts.findIndex((p) => p.id === input.id);
        if (idx !== -1) {
          currentPosts[idx] = {
            ...currentPosts[idx],
            slug,
            title,
            summary,
            content_md,
            tags,
            is_published,
            updated_at: now,
          };
          await env.KV.put(KV_POSTS_KEY, JSON.stringify(currentPosts));
          return currentPosts[idx];
        }
      }
      const maxId = currentPosts.reduce((m, p) => Math.max(m, p.id), 0);
      const newId = maxId + 1;
      const slugConflict = currentPosts.find((p) => p.slug === slug);
      const finalSlug = slugConflict ? `${slug}-${newId}` : slug;
      const created: BlogPostRecord = {
        id: newId,
        slug: finalSlug,
        title,
        summary,
        content_md,
        tags,
        is_published,
        created_at: now,
        updated_at: now,
      };
      currentPosts.unshift(created);
      await env.KV.put(KV_POSTS_KEY, JSON.stringify(currentPosts));
      return created;
    } catch (err) {
      console.error('KV saveBlogPost error:', err);
    }
  }

  const remote = await readCfControlPlaneStore();
  if (remote && remote.posts !== null) {
    memoryPosts = structuredClone(remote.posts);
    nextMemoryPostId =
      remote.posts.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
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
      await writeCfControlPlaneStore({ posts: memoryPosts });
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
  await writeCfControlPlaneStore({ posts: memoryPosts });
  return created;
}

export async function deleteBlogPost(env: Env | undefined, id: number): Promise<boolean> {
  const remote = await readCfControlPlaneStore();
  if (remote && remote.posts !== null) {
    memoryPosts = structuredClone(remote.posts);
  }

  const beforeLen = memoryPosts.length;
  memoryPosts = memoryPosts.filter((p) => p.id !== id);
  let deleted = memoryPosts.length < beforeLen;

  await writeCfControlPlaneStore({ posts: memoryPosts });

  if (env?.DB) {
    try {
      await ensureD1Initialized(env.DB);
      const res = await env.DB.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
      if (res.success) deleted = true;
    } catch (err) {
      console.error('D1 deleteBlogPost error:', err);
    }
  }

  if (env?.KV) {
    try {
      const raw = await env.KV.get(KV_POSTS_KEY);
      if (raw) {
        const currentPosts = JSON.parse(raw) as BlogPostRecord[];
        const nextPosts = currentPosts.filter((p) => p.id !== id);
        if (nextPosts.length < currentPosts.length) {
          deleted = true;
          await env.KV.put(KV_POSTS_KEY, JSON.stringify(nextPosts));
        }
      }
    } catch (err) {
      console.error('KV deleteBlogPost error:', err);
    }
  }

  return deleted;
}
