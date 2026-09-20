import { ContributorStats, OrgOverview, RepositorySummary, GitHubCredentials } from '../types';

const TOKEN_KEY = 'm2m_github_token';
const ORG_KEY = 'm2m_github_org';
const CACHE_DATA_KEY = 'm2m_cached_dashboard_data';
const CACHE_TIMESTAMP_KEY = 'm2m_cache_timestamp';
const DEMO_MODE_KEY = 'm2m_demo_mode_active';

export interface CachedDashboardPayload {
  contributors: ContributorStats[];
  repositories: RepositorySummary[];
  overview: OrgOverview;
  timestamp: string;
}

export const cacheService = {
  getCredentials(): GitHubCredentials {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    const org = localStorage.getItem(ORG_KEY) || 'Move2Move';
    return { token, org };
  },

  saveCredentials(credentials: GitHubCredentials): void {
    localStorage.setItem(TOKEN_KEY, credentials.token.trim());
    localStorage.setItem(ORG_KEY, credentials.org.trim());
  },

  clearCredentials(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  isDemoMode(): boolean {
    const stored = localStorage.getItem(DEMO_MODE_KEY);
    // Default to true if no token is saved yet
    if (stored === null) {
      return !localStorage.getItem(TOKEN_KEY);
    }
    return stored === 'true';
  },

  setDemoMode(enabled: boolean): void {
    localStorage.setItem(DEMO_MODE_KEY, String(enabled));
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
  }
};
