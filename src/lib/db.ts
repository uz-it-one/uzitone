import {
  fetchOwnedPublicRepos,
  formatYearMonth,
  getLanguageColor,
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

const INITIAL_BLOG_POSTS: BlogPostRecord[] = [
  {
    id: 1,
    slug: 'welcome-to-uzit-one',
    title: 'uzit.one 개인 웹사이트 및 블로그를 시작하며',
    summary: 'Cloudflare Pages와 Workers 기반으로 구축한 개인 포트폴리오 및 마크다운 블로그 소개',
    content_md: `## 시작하며

안녕하세요, 숭실대학교 자유전공학부에 재학 중이며 IT 서비스 개발 동아리 **YOURSSU(유어슈)**에서 활동하고 있는 **Uz_it_one**(\`@uz-it-one\`)입니다.

이 웹사이트(**uzit.one**)는 현재 진행 중인 개인 프로젝트들을 정리하고, 개발 과정에서 배운 기술적인 기록과 생각을 마크다운으로 남기기 위해 제작했습니다.

## 주요 구성

- **GitHub 프로필 및 소속**: GitHub 계정 연동 프로필과 소속 대학교·동아리 정보
- **Active Projects**: 내 소유의 GitHub Public 레포지토리 중 직접 선별한 진행 중인 프로젝트 목록
- **Markdown Blog**: 웹 에디터를 통해 마크다운으로 직접 작성하고 발행하는 기술 및 개인 블로그

\`\`\`typescript
const site = {
  domain: 'uzit.one',
  owner: 'uz-it-one',
  hosting: 'Cloudflare Pages & Workers',
};
\`\`\`

앞으로 이곳에 다양한 개발 기록과 프로젝트 회고를 차곡차곡 쌓아갈 예정입니다.`,
    tags: ['Dev', 'Cloudflare', 'Essay'],
    is_published: true,
    created_at: '2026-11-20T08:00:00Z',
    updated_at: '2026-11-20T08:00:00Z',
  },
];

// In-memory store fallback when D1 is not bound (e.g. local dev / tests / before D1 binding)
let memoryProjects: SelectedProjectRecord[] = structuredClone(INITIAL_SELECTED_PROJECTS);
let memoryPosts: BlogPostRecord[] = structuredClone(INITIAL_BLOG_POSTS);
let nextMemoryPostId = 2;
let d1Initialized = false;

export function resetMemoryStoreForTests(): void {
  memoryProjects = structuredClone(INITIAL_SELECTED_PROJECTS);
  memoryPosts = structuredClone(INITIAL_BLOG_POSTS);
  nextMemoryPostId = 2;
}

async function ensureD1Initialized(db: D1Database): Promise<void> {
  if (d1Initialized) return;
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

  const postCount = await db
    .prepare('SELECT COUNT(*) as cnt FROM blog_posts')
    .first<{ cnt: number }>();
  if (!postCount || Number(postCount.cnt) === 0) {
    for (const post of INITIAL_BLOG_POSTS) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO blog_posts
           (slug, title, summary, content_md, tags, is_published, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          post.slug,
          post.title,
          post.summary,
          post.content_md,
          JSON.stringify(post.tags),
          post.is_published ? 1 : 0,
          post.created_at,
          post.updated_at
        )
        .run();
    }
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
    } catch {
      return [...memoryProjects].sort((a, b) => a.display_order - b.display_order);
    }
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
    } catch {
      // Fallback already saved in memoryProjects
    }
  }

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
  let posts: BlogPostRecord[] = [];

  if (env?.DB) {
    try {
      await ensureD1Initialized(env.DB);
      const { results } = await env.DB.prepare(
        'SELECT * FROM blog_posts ORDER BY created_at DESC, id DESC'
      ).all<Record<string, unknown>>();
      posts = (results ?? []).map(normalizeBlogRow);
    } catch {
      posts = [...memoryPosts].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  } else {
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
  // published is ordered newest first (DESC)
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
        await env.DB.prepare(
          `INSERT INTO blog_posts
           (slug, title, summary, content_md, tags, is_published, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            slug,
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
          .bind(slug)
          .first<Record<string, unknown>>();
        if (row) return normalizeBlogRow(row);
      }
    } catch {
      // Fallback to memory store below
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

  // Check if slug already exists in memoryPosts
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
    try {
      await ensureD1Initialized(env.DB);
      const res = await env.DB.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
      if (res.success) deleted = true;
    } catch {
      // Ignored
    }
  }
  return deleted;
}
