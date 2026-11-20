import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAdminSessionToken,
  isAuthenticatedRequest,
  SESSION_COOKIE_NAME,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from '../src/lib/auth';
import {
  deleteBlogPost,
  getAdjacentPosts,
  getBlogPostBySlug,
  getBlogPosts,
  getMergedActiveProjects,
  getSelectedProjects,
  resetMemoryStoreForTests,
  saveBlogPost,
  saveSelectedProjects,
} from '../src/lib/db';
import {
  FALLBACK_REPOS,
  filterOwnedUserRepos,
  formatYearMonth,
  getLanguageColor,
  type GitHubRepo,
} from '../src/lib/github';
import { calculateReadingTime, renderMarkdown } from '../src/lib/markdown';

describe('GitHub repository filtering & utilities', () => {
  it('strictly filters out organization repositories and other owners, keeping only uz-it-one User public repos', () => {
    const sampleRepos: GitHubRepo[] = [
      ...FALLBACK_REPOS,
      {
        id: 901,
        name: 'org-project',
        full_name: 'yourssu/org-project',
        html_url: 'https://github.com/yourssu/org-project',
        description: 'Organization repository that must be excluded',
        fork: false,
        private: false,
        language: 'TypeScript',
        stargazers_count: 10,
        forks_count: 2,
        pushed_at: '2026-11-10T00:00:00Z',
        updated_at: '2026-11-10T00:00:00Z',
        owner: { login: 'yourssu', type: 'Organization' },
      },
      {
        id: 902,
        name: 'spoofed-org-with-same-name',
        full_name: 'uz-it-one/spoofed-org',
        html_url: 'https://github.com/uz-it-one/spoofed-org',
        description: 'Org type with same login must also be excluded',
        fork: false,
        private: false,
        language: 'Go',
        stargazers_count: 0,
        forks_count: 0,
        pushed_at: '2026-11-10T00:00:00Z',
        updated_at: '2026-11-10T00:00:00Z',
        owner: { login: 'uz-it-one', type: 'Organization' },
      },
      {
        id: 903,
        name: 'private-repo',
        full_name: 'uz-it-one/private-repo',
        html_url: 'https://github.com/uz-it-one/private-repo',
        description: 'Private repository must be excluded',
        fork: false,
        private: true,
        language: 'Python',
        stargazers_count: 0,
        forks_count: 0,
        pushed_at: '2026-11-10T00:00:00Z',
        updated_at: '2026-11-10T00:00:00Z',
        owner: { login: 'uz-it-one', type: 'User' },
      },
    ];

    const filtered = filterOwnedUserRepos(sampleRepos, 'uz-it-one');
    expect(filtered.length).toBe(FALLBACK_REPOS.length);
    expect(filtered.every((r) => r.owner.login === 'uz-it-one' && r.owner.type === 'User')).toBe(
      true
    );
    expect(filtered.some((r) => r.name === 'org-project')).toBe(false);
    expect(filtered.some((r) => r.name === 'private-repo')).toBe(false);
  });

  it('returns language colors and formats year-month strings accurately', () => {
    expect(getLanguageColor('Swift')).toBe('#F05138');
    expect(getLanguageColor('Python')).toBe('#3572A5');
    expect(getLanguageColor(null)).toBe('#8B949E');
    expect(formatYearMonth('2026-11-03T05:30:46Z')).toBe('2026.11');
  });
});

describe('Project curation storage & merging', () => {
  beforeEach(() => {
    resetMemoryStoreForTests();
  });

  it('loads default curated projects and allows updating selection order & custom descriptions', async () => {
    const initial = await getSelectedProjects();
    expect(initial.map((p) => p.repo_name)).toEqual([
      'mac-hwp-preview',
      'region-check',
      'Transducer',
    ]);

    await saveSelectedProjects(undefined, [
      {
        repo_name: 'Transducer',
        display_order: 1,
        status_label: '유지보수',
        custom_description: 'iOS 단위 변환 애플리케이션',
      },
      {
        repo_name: 'mac-hwp-preview',
        display_order: 2,
        status_label: '진행 중',
        custom_description: null,
      },
    ]);

    const merged = await getMergedActiveProjects();
    expect(merged.length).toBe(2);
    expect(merged[0].repo_name).toBe('Transducer');
    expect(merged[0].status_label).toBe('유지보수');
    expect(merged[0].description).toBe('iOS 단위 변환 애플리케이션');
    expect(merged[1].repo_name).toBe('mac-hwp-preview');
  });
});

describe('Markdown blog storage & rendering', () => {
  beforeEach(() => {
    resetMemoryStoreForTests();
  });

  it('starts with no default blog posts and supports creating, updating, filtering, and deleting posts', async () => {
    const initialPosts = await getBlogPosts();
    expect(initialPosts.length).toBe(0);

    const first = await saveBlogPost(undefined, {
      title: '첫 번째 포스트',
      slug: 'first-post',
      summary: '첫 글 요약',
      tags: ['Dev'],
      is_published: true,
      content_md: '## 첫 글\n\n내용',
    });

    const created = await saveBlogPost(undefined, {
      title: 'Swift QuickLook 확장 개발하기',
      slug: 'swift-quicklook-guide',
      summary: 'macOS QuickLook 프리뷰 개발 노트',
      tags: ['Swift', 'macOS'],
      is_published: true,
      content_md: '## 개요\n\n본문 내용입니다.\n\n```swift\nlet x = 1\n```',
    });

    expect(created.slug).toBe('swift-quicklook-guide');

    const bySlug = await getBlogPostBySlug(undefined, 'swift-quicklook-guide');
    expect(bySlug).not.toBeNull();
    expect(bySlug?.title).toBe('Swift QuickLook 확장 개발하기');

    const swiftFiltered = await getBlogPosts(undefined, { tag: 'Swift' });
    expect(swiftFiltered.length).toBe(1);

    const adjacent = await getAdjacentPosts(undefined, 'swift-quicklook-guide');
    expect(adjacent.prev?.slug).toBe(first.slug);

    const deleted = await deleteBlogPost(undefined, created.id);
    expect(deleted).toBe(true);
    expect(await getBlogPostBySlug(undefined, 'swift-quicklook-guide')).toBeNull();
  });

  it('renders GFM markdown with table of contents, code copy button, and script sanitization', () => {
    const md = `## 첫 번째 섹션\n\n내용입니다.\n\n### 서브 섹션\n\n\`\`\`python\nprint("hello")\n\`\`\`\n\n<script>alert("xss")</script>`;
    const rendered = renderMarkdown(md);

    expect(rendered.toc).toEqual([
      { id: '첫-번째-섹션', text: '첫 번째 섹션', level: 2 },
      { id: '서브-섹션', text: '서브 섹션', level: 3 },
    ]);
    expect(rendered.html).toContain('copy-code-btn');
    expect(rendered.html).toContain('Copy');
    expect(rendered.html).not.toContain('<script>');
    expect(calculateReadingTime(md)).toBeGreaterThanOrEqual(1);
  });
});

describe('Admin authentication', () => {
  it('verifies admin passwords and signs/verifies HMAC session tokens', async () => {
    const mockEnv = { ADMIN_PASSWORD: 'test-secret-password' };
    expect(verifyAdminPassword('wrong', mockEnv)).toBe(false);
    expect(verifyAdminPassword('test-secret-password', mockEnv)).toBe(true);

    const token = await createAdminSessionToken(mockEnv);
    expect(await verifyAdminSessionToken(token, mockEnv)).toBe(true);
    expect(await verifyAdminSessionToken(token, { ADMIN_PASSWORD: 'other' })).toBe(false);

    const authedReq = new Request('https://uzit.one/api/admin/posts', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
      },
    });
    expect(await isAuthenticatedRequest(authedReq, mockEnv)).toBe(true);
  });
});
