export interface RateLimitStatus {
  remaining: number;
  limit: number;
  resetDate: Date;
}

export interface RawMember {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  site_admin: boolean;
}

export interface RawRepo {
  name: string;
  private: boolean;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
}

export interface RawCommit {
  sha: string;
  commit: {
    author?: {
      name: string;
      email: string;
      date: string;
    };
    committer?: {
      name: string;
      email: string;
      date: string;
    };
    message?: string;
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  html_url: string;
}

export interface RawPull {
  id: number;
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
}

export interface RawReview {
  id: number;
  user: {
    login: string;
  };
  state: string;
  submitted_at: string;
}

export interface RawIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  created_at: string;
  pull_request?: unknown;
  user: {
    login: string;
  };
}

class GitHubApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

let lastRateLimit: RateLimitStatus | null = null;

export const getLatestRateLimit = (): RateLimitStatus | null => lastRateLimit;

/**
 * Requests GitHub API via backend serverless proxy (/api/github).
 * If a custom client override token is present in localStorage, it is passed via x-github-token.
 * Otherwise, the serverless proxy uses the secure server-side GITHUB_TOKEN.
 */
async function requestGitHub<T>(apiPath: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json'
  };

  const cleanToken = token ? token.trim() : '';
  if (cleanToken) {
    headers['x-github-token'] = cleanToken;
  }

  // Call the secure backend proxy
  const proxyUrl = `/api/github?path=${encodeURIComponent(apiPath)}`;
  const response = await fetch(proxyUrl, { headers });

  const remainingHeader = response.headers.get('x-ratelimit-remaining');
  const limitHeader = response.headers.get('x-ratelimit-limit');
  const resetHeader = response.headers.get('x-ratelimit-reset');

  if (remainingHeader && limitHeader && resetHeader) {
    lastRateLimit = {
      remaining: parseInt(remainingHeader, 10),
      limit: parseInt(limitHeader, 10),
      resetDate: new Date(parseInt(resetHeader, 10) * 1000)
    };
  }

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson.message) {
        errorDetail = errJson.message;
      }
    } catch {
      // ignore json parse errors
    }

    if (response.status === 401) {
      throw new GitHubApiError(
        `Authentication Failed (401): ${errorDetail || 'Invalid token or missing GITHUB_TOKEN on server.'}`,
        401
      );
    }
    if (response.status === 403) {
      if (lastRateLimit && lastRateLimit.remaining === 0) {
        throw new GitHubApiError(
          `GitHub API rate limit exceeded. Reset time: ${lastRateLimit.resetDate.toLocaleTimeString()}`,
          403
        );
      }
      throw new GitHubApiError(
        `Access forbidden (403): ${errorDetail}. Ensure token has 'repo' and 'read:org' permissions.`,
        403
      );
    }
    if (response.status === 404) {
      throw new GitHubApiError(
        `Resource not found (404): ${errorDetail}. Ensure organization name is exact and token has access to private repos.`,
        404
      );
    }
    throw new GitHubApiError(`GitHub API error (${response.status}): ${errorDetail}`, response.status);
  }

  return response.json() as Promise<T>;
}

export const githubApi = {
  async testConnection(token: string | undefined, org: string): Promise<{ userLogin: string; orgName: string; rateLimit: RateLimitStatus | null }> {
    const safeOrg = encodeURIComponent(org.trim());
    const user = await requestGitHub<{ login: string }>('/user', token);
    const orgData = await requestGitHub<{ login: string; name?: string }>(`/orgs/${safeOrg}`, token);
    return {
      userLogin: user.login,
      orgName: orgData.name || orgData.login,
      rateLimit: lastRateLimit
    };
  },

  async fetchOrgMembers(token: string | undefined, org: string): Promise<RawMember[]> {
    const safeOrg = encodeURIComponent(org.trim());
    return requestGitHub<RawMember[]>(`/orgs/${safeOrg}/members?per_page=100`, token);
  },

  async fetchOrgRepos(token: string | undefined, org: string): Promise<RawRepo[]> {
    const safeOrg = encodeURIComponent(org.trim());
    return requestGitHub<RawRepo[]>(`/orgs/${safeOrg}/repos?type=all&per_page=100&sort=updated`, token);
  },

  async fetchRepoCommits(token: string | undefined, org: string, repo: string, sinceDate?: string): Promise<RawCommit[]> {
    const safeOrg = encodeURIComponent(org.trim());
    const safeRepo = encodeURIComponent(repo.trim());
    let path = `/repos/${safeOrg}/${safeRepo}/commits?per_page=100`;
    if (sinceDate) {
      path += `&since=${encodeURIComponent(sinceDate)}`;
    }
    try {
      return await requestGitHub<RawCommit[]>(path, token);
    } catch (err: unknown) {
      const e = err as { status?: number };
      if (e.status === 409) {
        // Git Repository is empty
        return [];
      }
      throw err;
    }
  },

  async fetchRepoPulls(token: string | undefined, org: string, repo: string): Promise<RawPull[]> {
    const safeOrg = encodeURIComponent(org.trim());
    const safeRepo = encodeURIComponent(repo.trim());
    const path = `/repos/${safeOrg}/${safeRepo}/pulls?state=all&per_page=100&sort=updated&direction=desc`;
    return requestGitHub<RawPull[]>(path, token);
  },

  async fetchPullReviews(token: string | undefined, org: string, repo: string, pullNumber: number): Promise<RawReview[]> {
    const safeOrg = encodeURIComponent(org.trim());
    const safeRepo = encodeURIComponent(repo.trim());
    const path = `/repos/${safeOrg}/${safeRepo}/pulls/${pullNumber}/reviews?per_page=100`;
    try {
      return await requestGitHub<RawReview[]>(path, token);
    } catch {
      return [];
    }
  },

  async fetchRepoIssues(token: string | undefined, org: string, repo: string, sinceDate?: string): Promise<RawIssue[]> {
    const safeOrg = encodeURIComponent(org.trim());
    const safeRepo = encodeURIComponent(repo.trim());
    let path = `/repos/${safeOrg}/${safeRepo}/issues?state=all&per_page=100`;
    if (sinceDate) {
      path += `&since=${encodeURIComponent(sinceDate)}`;
    }
    try {
      const issues = await requestGitHub<RawIssue[]>(path, token);
      // Filter out Pull Requests because GitHub API returns PRs in /issues endpoint
      return issues.filter((i) => !i.pull_request);
    } catch {
      return [];
    }
  }
};
