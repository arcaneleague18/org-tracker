export type UserRole = 'Owner' | 'Admin' | 'Member' | 'Collaborator';

export type ActivityType = 'commit' | 'pr_merged' | 'pr_opened' | 'review' | 'issue';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  repo: string;
  timestamp: string;
  url?: string;
  isoDate?: string;
  dayOfWeek?: number; // 0 (Sun) to 6 (Sat)
  hour?: number; // 0 to 23
}

export interface RepoContribution {
  name: string;
  commits: number;
  prs: number;
  linesChanged: number;
}

export interface PunchcardSlot {
  day: number; // 0 (Sun) to 6 (Sat)
  hour: number; // 0 to 23
  count: number;
}

export interface ContributorStats {
  login: string;
  name: string;
  avatarUrl: string;
  profileUrl: string;
  role: UserRole;
  commitsCount: number;
  prsCreated: number;
  prsMerged: number;
  prsClosed: number;
  reviewsCount: number;
  issuesCount: number;
  linesAdded: number;
  linesDeleted: number;
  impactScore: number;
  rank: number;
  activeDays: number;
  repositories: RepoContribution[];
  recentActivity: ActivityEvent[];
  punchcard: PunchcardSlot[];
  activityByDate: Record<string, number>; // YYYY-MM-DD -> total events
}

export interface RepositorySummary {
  name: string;
  isPrivate: boolean;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
  commitsCount: number;
  prsCount: number;
  topContributors: { login: string; commits: number }[];
}

export interface DailyActivityPoint {
  date: string;
  commits: number;
  prs: number;
  reviews: number;
  total: number;
}

export interface OrgOverview {
  orgName: string;
  totalContributors: number;
  totalCommits: number;
  totalPrs: number;
  totalPrsMerged: number;
  totalReviews: number;
  totalIssues: number;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  reviewParticipationRate: number;
  activeReposCount: number;
  dailyActivity: DailyActivityPoint[];
}

export type DateRangeOption = '7d' | '30d' | '90d' | 'year' | 'all';

export interface SyncStatus {
  isSyncing: boolean;
  phase: 'idle' | 'members' | 'repos' | 'commits' | 'pulls' | 'aggregating' | 'done' | 'error';
  currentRepo: string;
  progress: number;
  rateLimitRemaining: number | null;
  rateLimitReset: number | null;
  lastSyncedAt: string | null;
  errorMessage: string | null;
}

export interface GitHubCredentials {
  token: string;
  org: string;
  excludedRepos?: string[];
}
