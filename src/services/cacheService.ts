import { ContributorStats, OrgOverview, RepositorySummary, GitHubCredentials } from '../types';

const TOKEN_KEY = 'm2m_github_token';
const ORG_KEY = 'm2m_github_org';
const EXCLUDED_REPOS_KEY = 'm2m_excluded_repos';
const CACHE_DATA_KEY = 'm2m_cached_dashboard_data';
const CACHE_TIMESTAMP_KEY = 'm2m_cache_timestamp';

export interface CachedDashboardPayload {
  contributors: ContributorStats[];
  repositories: RepositorySummary[];
  overview: OrgOverview;
  timestamp: string;
}

export const cacheService = {
  // --- Excluded Repos (client-side filter, persisted to localStorage) ---

  getExcludedRepos(): string[] {
    const stored = localStorage.getItem(EXCLUDED_REPOS_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored) as string[];
      return parsed.map((s) => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  },

  saveExcludedRepos(repos: string[]): void {
    const cleaned = Array.from(new Set(repos.map((s) => s.trim()))).filter(Boolean);
    localStorage.setItem(EXCLUDED_REPOS_KEY, JSON.stringify(cleaned));
  },

  // --- Token Management (Server Proxy default, localStorage optional override) ---

  getOverrideToken(): string {
    return (localStorage.getItem(TOKEN_KEY) || '').trim();
  },

  hasTokenOverride(): boolean {
    return Boolean(this.getOverrideToken());
  },

  clearTokenOverride(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  hasServerProxy(): boolean {
    return true;
  },

  // --- Credentials ---

  getCredentials(): GitHubCredentials {
    const overrideToken = this.getOverrideToken();
    const org = localStorage.getItem(ORG_KEY) || (import.meta.env.VITE_GITHUB_ORG as string) || 'Move2Move';
    return { token: overrideToken, org };
  },

  saveCredentials(credentials: GitHubCredentials): void {
    const cleanToken = credentials.token ? credentials.token.trim() : '';
    if (cleanToken) {
      localStorage.setItem(TOKEN_KEY, cleanToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    localStorage.setItem(ORG_KEY, credentials.org.trim());
  },

  clearCredentials(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  // --- Cached Dashboard Data ---

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
    } catch (e) {
      console.warn('Failed to save to localStorage (quota exceeded or disabled):', e);
    }
  },

  getLastSyncTime(): string | null {
    return localStorage.getItem(CACHE_TIMESTAMP_KEY);
  },

  // --- Theme ---

  getTheme(): 'dark' | 'light' {
    const saved = localStorage.getItem('m2m_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  },

  setTheme(theme: 'dark' | 'light'): void {
    localStorage.setItem('m2m_theme', theme);
  },

  // --- Cache Clear ---

  clearCache(): void {
    localStorage.removeItem(CACHE_DATA_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  }
};
