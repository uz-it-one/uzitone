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
  id?: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  private?: boolean;
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
  public_repos: 13,
  followers: 6,
  following: 7,
};

export const FALLBACK_REPOS: GitHubRepo[] = [
  {
    id: 100,
    name: 'spice4mac',
    full_name: 'uz-it-one/spice4mac',
    html_url: 'https://github.com/uz-it-one/spice4mac',
    description: 'Native Apple Silicon SPICE remote desktop client for macOS',
    fork: false,
    private: false,
    language: 'Swift',
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: '2026-11-20T14:40:51Z',
    updated_at: '2026-11-20T14:31:04Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 101,
    name: 'uzitone',
    full_name: 'uz-it-one/uzitone',
    html_url: 'https://github.com/uz-it-one/uzitone',
    description: 'my personal website with blog',
    fork: false,
    private: false,
    language: 'Astro',
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: '2026-11-20T13:50:30Z',
    updated_at: '2026-11-20T14:55:16Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 102,
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
    updated_at: '2026-11-03T05:30:50Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 103,
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
    updated_at: '2026-10-23T03:06:42Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 104,
    name: 'gophish',
    full_name: 'uz-it-one/gophish',
    html_url: 'https://github.com/uz-it-one/gophish',
    description: 'Open-Source Phishing Toolkit',
    fork: true,
    private: false,
    language: 'Go',
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: '2026-04-26T10:50:34Z',
    updated_at: '2026-04-26T10:49:44Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 105,
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
    id: 106,
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
    updated_at: '2026-04-07T15:45:59Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 107,
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
    updated_at: '2025-11-24T03:50:00Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 108,
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
    updated_at: '2024-11-30T12:46:09Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 109,
    name: 'homebrew-core',
    full_name: 'uz-it-one/homebrew-core',
    html_url: 'https://github.com/uz-it-one/homebrew-core',
    description: '🍻 Default formulae for the missing package manager for macOS (or Linux)',
    fork: true,
    private: false,
    language: 'Ruby',
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: '2024-02-10T13:48:37Z',
    updated_at: '2024-01-24T11:41:38Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 110,
    name: 'homebrew-cask',
    full_name: 'uz-it-one/homebrew-cask',
    html_url: 'https://github.com/uz-it-one/homebrew-cask',
    description:
      '🍻 A CLI workflow for the administration of macOS applications distributed as binaries',
    fork: true,
    private: false,
    language: 'Ruby',
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: '2024-01-24T11:41:18Z',
    updated_at: '2023-05-03T04:58:41Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 111,
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
    updated_at: '2023-11-29T16:29:08Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
  {
    id: 112,
    name: 'MagiskOnWSA',
    full_name: 'uz-it-one/MagiskOnWSA',
    html_url: 'https://github.com/uz-it-one/MagiskOnWSA',
    description:
      'Integrate Magisk root and Google Apps (OpenGApps) into WSA (Windows Subsystem for Android)',
    fork: true,
    private: false,
    language: null,
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: '2022-08-02T12:12:19Z',
    updated_at: '2022-08-12T18:09:37Z',
    owner: { login: 'uz-it-one', type: 'User' },
  },
];

const MEMORY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes in-memory
let cachedProfile: { data: GitHubProfile; expiresAt: number } | null = null;
let cachedRepos: { data: GitHubRepo[]; expiresAt: number } | null = null;

function createGitHubHeaders(githubToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'uzit-one-website',
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }
  return headers;
}

/**
 * Keeps only public repositories directly owned by the specified User account,
 * excluding Organization repositories and private repositories.
 */
export function filterOwnedUserRepos(
  repos: GitHubRepo[],
  username: string = GITHUB_USERNAME
): GitHubRepo[] {
  const targetOwner = username.toLowerCase();
  return repos.filter((repo) => {
    if (!repo || repo.private) return false;
    const ownerLogin = repo.owner?.login?.toLowerCase();
    const ownerType = repo.owner?.type;
    return ownerLogin === targetOwner && ownerType === 'User';
  });
}

/**
 * Fetches GitHub user profile directly from GitHub REST API.
 * Returns null on rate-limit or network failure so D1 cache can be preserved.
 */
export async function fetchGitHubProfileFromApi(
  githubToken?: string
): Promise<GitHubProfile | null> {
  try {
    const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}`, {
      headers: createGitHubHeaders(githubToken),
    });
    if (!response.ok) return null;

    const profile = (await response.json()) as GitHubProfile;
    cachedProfile = { data: profile, expiresAt: Date.now() + MEMORY_CACHE_TTL_MS };
    return profile;
  } catch {
    return null;
  }
}

/**
 * Fetches owned public repositories directly from GitHub REST API.
 * Returns null on rate-limit or network failure so D1 cache can be preserved.
 */
export async function fetchOwnedPublicReposFromApi(
  githubToken?: string
): Promise<GitHubRepo[] | null> {
  try {
    const url = `https://api.github.com/users/${GITHUB_USERNAME}/repos?type=owner&per_page=100&sort=pushed`;
    const response = await fetch(url, {
      headers: createGitHubHeaders(githubToken),
    });
    if (!response.ok) return null;

    const rawRepos = (await response.json()) as GitHubRepo[];
    const ownedRepos = filterOwnedUserRepos(rawRepos, GITHUB_USERNAME);
    cachedRepos = { data: ownedRepos, expiresAt: Date.now() + MEMORY_CACHE_TTL_MS };
    return ownedRepos;
  } catch {
    return null;
  }
}

export async function fetchGitHubProfile(githubToken?: string): Promise<GitHubProfile> {
  if (cachedProfile && cachedProfile.expiresAt > Date.now()) {
    return cachedProfile.data;
  }
  const freshProfile = await fetchGitHubProfileFromApi(githubToken);
  return freshProfile ?? cachedProfile?.data ?? FALLBACK_PROFILE;
}

export async function fetchOwnedPublicRepos(
  githubToken?: string,
  forceRefresh = false
): Promise<GitHubRepo[]> {
  if (!forceRefresh && cachedRepos && cachedRepos.expiresAt > Date.now()) {
    return cachedRepos.data;
  }
  const freshRepos = await fetchOwnedPublicReposFromApi(githubToken);
  return freshRepos ?? cachedRepos?.data ?? FALLBACK_REPOS;
}

const DEFAULT_LANGUAGE_COLOR = '#8B949E';

const LANGUAGE_COLORS: Record<string, string> = {
  Astro: '#FF5A03',
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
  if (!language) return DEFAULT_LANGUAGE_COLOR;
  return LANGUAGE_COLORS[language] ?? DEFAULT_LANGUAGE_COLOR;
}

export function formatYearMonth(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}.${month}`;
}

export function formatDateDot(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate.slice(0, 10).replace(/-/g, '.');
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}
