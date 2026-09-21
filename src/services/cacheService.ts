import { ContributorStats, OrgOverview, RepositorySummary, GitHubCredentials } from '../types';

const TOKEN_KEY = 'm2m_github_token';
const ORG_KEY = 'm2m_github_org';
const EXCLUDED_REPOS_KEY = 'm2m_excluded_repos';
const LAST_EXCLUDED_REPOS_HASH = 'm2m_last_excluded_repos_hash';
const CACHE_DATA_KEY = 'm2m_cached_dashboard_data';
const CACHE_TIMESTAMP_KEY = 'm2m_cache_timestamp';

export interface CachedDashboardPayload {
  contributors: ContributorStats[];
  repositories: RepositorySummary[];
  overview: OrgOverview;
  timestamp: string;
}

export const cacheService = {
  getEnvExcludedRepos(): string[] {
    const raw = (import.meta.env.VITE_EXCLUDED_REPOS as string | undefined) || '';
    return raw
      .split(',')
      .map((s) => s.replace(/["']/g, '').trim())
      .filter(Boolean);
  },

  getExcludedRepos(): string[] {
    const envRepos = this.getEnvExcludedRepos();
    const stored = localStorage.getItem(EXCLUDED_REPOS_KEY);
    if (!stored) {
      return envRepos;
    }
    try {
      const parsed = JSON.parse(stored) as string[];
      // Combine unique repo names from both .env and manual configuration
      const combined = Array.from(new Set([...envRepos, ...parsed].map((s) => s.trim()))).filter(Boolean);
      return combined;
    } catch {
      return envRepos;
    }
  },

  saveExcludedRepos(repos: string[]): void {
    const cleaned = Array.from(new Set(repos.map((s) => s.trim()))).filter(Boolean);
    localStorage.setItem(EXCLUDED_REPOS_KEY, JSON.stringify(cleaned));
  },

  isRepoExcluded(repoName: string, excludedList?: string[]): boolean {
    const list = excludedList ?? this.getExcludedRepos();
    const target = repoName.trim().toLowerCase();
    return list.some((ex) => ex.trim().toLowerCase() === target);
  },

  hasExcludedReposChanged(): boolean {
    const currentSignature = this.getExcludedRepos().map((s) => s.toLowerCase()).sort().join(',');
    const lastSignature = localStorage.getItem(LAST_EXCLUDED_REPOS_HASH);
    return lastSignature !== null && lastSignature !== currentSignature;
  },

  recordCurrentExcludedRepos(): void {
    const currentSignature = this.getExcludedRepos().map((s) => s.toLowerCase()).sort().join(',');
    localStorage.setItem(LAST_EXCLUDED_REPOS_HASH, currentSignature);
  },

  getCredentials(): GitHubCredentials {
    const token = localStorage.getItem(TOKEN_KEY) || (import.meta.env.VITE_GITHUB_TOKEN as string) || '';
    const org = localStorage.getItem(ORG_KEY) || (import.meta.env.VITE_GITHUB_ORG as string) || 'Move2Move';
    const excludedRepos = this.getExcludedRepos();
    return { token, org, excludedRepos };
  },

  saveCredentials(credentials: GitHubCredentials): void {
    localStorage.setItem(TOKEN_KEY, credentials.token.trim());
    localStorage.setItem(ORG_KEY, credentials.org.trim());
    if (credentials.excludedRepos) {
      this.saveExcludedRepos(credentials.excludedRepos);
    }
  },

  clearCredentials(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXCLUDED_REPOS_KEY);
    localStorage.removeItem(LAST_EXCLUDED_REPOS_HASH);
  },

  getCachedData(): CachedDashboardPayload | null {
    try {
      const raw = localStorage.getItem(CACHE_DATA_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as CachedDashboardPayload;
    } catch {
      return null;
    }
  },

  saveCachedData(data: Omit<CachedDashboardPayload, 'timestamp'>): void {
    try {
      const payload: CachedDashboardPayload = {
        ...data,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(CACHE_DATA_KEY, JSON.stringify(payload));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, payload.timestamp);
      this.recordCurrentExcludedRepos();
    } catch (e) {
      console.warn('Failed to save to localStorage (quota exceeded or disabled):', e);
    }
  },

  getLastSyncTime(): string | null {
    return localStorage.getItem(CACHE_TIMESTAMP_KEY);
  },

  getTheme(): 'dark' | 'light' {
    const saved = localStorage.getItem('m2m_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  },

  setTheme(theme: 'dark' | 'light'): void {
    localStorage.setItem('m2m_theme', theme);
  },

  clearCache(): void {
    localStorage.removeItem(CACHE_DATA_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    localStorage.removeItem(LAST_EXCLUDED_REPOS_HASH);
  }
};
