export interface GitHubProfile {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  location: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  private: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  updated_at: string;
  topics?: string[];
  owner: {
    login: string;
    type: string;
  };
}

export const GITHUB_USERNAME = 'uz-it-one';

export const FALLBACK_PROFILE: GitHubProfile = {
  login: 'uz-it-one',
  name: 'Uz_it_one',
  avatar_url: 'https://avatars.githubusercontent.com/u/77672508?v=4',
  html_url: 'https://github.com/uz-it-one',
  bio: 'School of Liberal Studies at @ Soongsil University',
  location: 'Seoul',
  public_repos: 12,
  followers: 6,
  following: 7,
};

export const FALLBACK_REPOS: GitHubRepo[] = [
  {
    id: 101,
    name: 'mac-hwp-preview',
    full_name: 'uz-it-one/mac-hwp-preview',
    html_url: 'https://github.com/uz-it-one/mac-hwp-preview',
    description: 'macOS Quick Look previews for HWP and HWPX documents',
    fork: false,
    private: false,
    language: 'Swift',
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: '2026-11-03T05:30:46Z',
    updated_at: '2026-11-03T05:30:46Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 102,
    name: 'region-check',
    full_name: 'uz-it-one/region-check',
    html_url: 'https://github.com/uz-it-one/region-check',
    description: "discover spam/disturbing account's region at instagram",
    fork: false,
    private: false,
    language: 'Python',
    stargazers_count: 1,
    forks_count: 0,
    pushed_at: '2026-04-21T14:29:20Z',
    updated_at: '2026-04-21T14:29:20Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 103,
    name: 'Transducer',
    full_name: 'uz-it-one/Transducer',
    html_url: 'https://github.com/uz-it-one/Transducer',
    description: '영미 <-> SI 단위계 변환기 (iOS)',
    fork: false,
    private: false,
    language: 'Swift',
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: '2023-11-30T07:18:48Z',
    updated_at: '2023-11-30T07:18:48Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 104,
    name: 'grabic1060',
    full_name: 'uz-it-one/grabic1060',
    html_url: 'https://github.com/uz-it-one/grabic1060',
    description: null,
    fork: false,
    private: false,
    language: null,
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: '2026-04-07T15:45:55Z',
    updated_at: '2026-04-07T15:45:55Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 105,
    name: 'homepage',
    full_name: 'uz-it-one/homepage',
    html_url: 'https://github.com/uz-it-one/homepage',
    description: null,
    fork: false,
    private: false,
    language: 'HTML',
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: '2025-11-28T03:06:13Z',
    updated_at: '2025-11-28T03:06:13Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 106,
    name: 'Python-practice',
    full_name: 'uz-it-one/Python-practice',
    html_url: 'https://github.com/uz-it-one/Python-practice',
    description: null,
    fork: false,
    private: false,
    language: 'Python',
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: '2024-11-30T12:46:05Z',
    updated_at: '2024-11-30T12:46:05Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 107,
    name: 'SekaiPop',
    full_name: 'uz-it-one/SekaiPop',
    html_url: 'https://github.com/uz-it-one/SekaiPop',
    description: 'a project sekai inspired quickshell rice - for debian',
    fork: true,
    private: false,
    language: 'QML',
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: '2026-10-23T03:06:38Z',
    updated_at: '2026-10-23T03:06:38Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 108,
    name: 'file-gq',
    full_name: 'uz-it-one/file-gq',
    html_url: 'https://github.com/uz-it-one/file-gq',
    description: 'yoonsrv.com file sharing',
    fork: true,
    private: false,
    language: 'HTML',
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: '2025-11-24T03:49:56Z',
    updated_at: '2025-11-24T03:49:56Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
];

let cachedProfile: { data: GitHubProfile; expiresAt: number } | null = null;
let cachedRepos: { data: GitHubRepo[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Filter repositories so that ONLY public repositories directly owned by uz-it-one (User)
 * are included, strictly excluding any Organization repositories or other owners.
 */
export function filterOwnedUserRepos(
  repos: GitHubRepo[],
  username: string = GITHUB_USERNAME
): GitHubRepo[] {
  const target = username.toLowerCase();
  return repos.filter((repo) => {
    if (!repo || repo.private) return false;
    const ownerLogin = repo.owner?.login?.toLowerCase();
    const ownerType = repo.owner?.type;
    return ownerLogin === target && ownerType === 'User';
  });
}

export async function fetchGitHubProfile(githubToken?: string): Promise<GitHubProfile> {
  const now = Date.now();
  if (cachedProfile && cachedProfile.expiresAt > now) {
    return cachedProfile.data;
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'uzit-one-website',
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  try {
    const res = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}`, { headers });
    if (!res.ok) {
      return cachedProfile?.data ?? FALLBACK_PROFILE;
    }
    const data = (await res.json()) as GitHubProfile;
    cachedProfile = { data, expiresAt: now + CACHE_TTL_MS };
    return data;
  } catch {
    return cachedProfile?.data ?? FALLBACK_PROFILE;
  }
}

export async function fetchOwnedPublicRepos(
  githubToken?: string,
  forceRefresh = false
): Promise<GitHubRepo[]> {
  const now = Date.now();
  if (!forceRefresh && cachedRepos && cachedRepos.expiresAt > now) {
    return cachedRepos.data;
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'uzit-one-website',
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  try {
    const res = await fetch(
      `https://api.github.com/users/${GITHUB_USERNAME}/repos?type=owner&per_page=100&sort=pushed`,
      { headers }
    );
    if (!res.ok) {
      return cachedRepos?.data ?? FALLBACK_REPOS;
    }
    const rawRepos = (await res.json()) as GitHubRepo[];
    const filtered = filterOwnedUserRepos(rawRepos, GITHUB_USERNAME);
    cachedRepos = { data: filtered, expiresAt: now + CACHE_TTL_MS };
    return filtered;
  } catch {
    return cachedRepos?.data ?? FALLBACK_REPOS;
  }
}

const LANGUAGE_COLORS: Record<string, string> = {
  Swift: '#F05138',
  Python: '#3572A5',
  TypeScript: '#3178C6',
  JavaScript: '#F1E05A',
  HTML: '#E34C26',
  CSS: '#563D7C',
  Go: '#00ADD8',
  Rust: '#DEA584',
  Java: '#B07219',
  Kotlin: '#A97BFF',
  C: '#555555',
  'C++': '#F34B7D',
  QML: '#41CD52',
  Ruby: '#701516',
  Shell: '#89E051',
};

export function getLanguageColor(language: string | null): string {
  if (!language) return '#8B949E';
  return LANGUAGE_COLORS[language] ?? '#8B949E';
}

export function formatYearMonth(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}.${month}`;
}
