import { ContributorStats, OrgOverview, RepositorySummary, DailyActivityPoint, PunchcardSlot } from '../types';

// Helper to generate past dates
function generatePastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// Generate realistic daily activity for past 90 days
function generateDailyPoints(days: number): DailyActivityPoint[] {
  const points: DailyActivityPoint[] = [];
  for (let i = days; i >= 0; i--) {
    const date = generatePastDate(i);
    const dayOfWeek = new Date(date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const factor = isWeekend ? 0.3 : 1;
    
    const commits = Math.floor((Math.random() * 14 + 3) * factor);
    const prs = Math.floor((Math.random() * 4 + 1) * factor);
    const reviews = Math.floor((Math.random() * 6 + 2) * factor);

    points.push({
      date,
      commits,
      prs,
      reviews,
      total: commits + prs + reviews
    });
  }
  return points;
}

// Generate punchcard data
function generatePunchcard(): PunchcardSlot[] {
  const slots: PunchcardSlot[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      let count = 0;
      // Heavier activity during 10:00 - 20:00 on weekdays
      if (day >= 1 && day <= 5) {
        if (hour >= 10 && hour <= 19) {
          count = Math.floor(Math.random() * 15 + 4);
        } else if (hour >= 8 && hour <= 23) {
          count = Math.floor(Math.random() * 5 + 1);
        }
      } else {
        if (hour >= 13 && hour <= 18) {
          count = Math.floor(Math.random() * 6);
        }
      }
      slots.push({ day, hour, count });
    }
  }
  return slots;
}

// Generate date map for a contributor
function generateDateMap(frequency: number): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 90; i >= 0; i--) {
    const d = generatePastDate(i);
    if (Math.random() < frequency) {
      map[d] = Math.floor(Math.random() * 8 + 1);
    }
  }
  return map;
}

export const mockContributors: ContributorStats[] = [
  {
    login: 'varun-m2m',
    name: 'Varun (Owner)',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    profileUrl: 'https://github.com/Move2Move',
    role: 'Owner',
    commitsCount: 384,
    prsCreated: 42,
    prsMerged: 39,
    prsClosed: 3,
    reviewsCount: 118,
    issuesCount: 28,
    linesAdded: 28410,
    linesDeleted: 8940,
    impactScore: 98.4,
    rank: 1,
    activeDays: 78,
    repositories: [
      { name: 'move2move-core', commits: 184, prs: 18, linesChanged: 19400 },
      { name: 'move2move-api', commits: 112, prs: 14, linesChanged: 9850 },
      { name: 'move2move-contracts', commits: 64, prs: 6, linesChanged: 5600 },
      { name: 'move2move-infra', commits: 24, prs: 4, linesChanged: 2500 }
    ],
    recentActivity: [
      {
        id: 'act-1',
        type: 'commit',
        title: 'feat(core): optimize state machine and batch verification',
        repo: 'move2move-core',
        timestamp: '2 hours ago'
      },
      {
        id: 'act-2',
        type: 'review',
        title: 'Approved PR #142: asynchronous transaction processor',
        repo: 'move2move-api',
        timestamp: '5 hours ago'
      },
      {
        id: 'act-3',
        type: 'pr_merged',
        title: 'Merge PR #140: upgrade consensus validator client',
        repo: 'move2move-core',
        timestamp: 'Yesterday'
      },
      {
        id: 'act-4',
        type: 'commit',
        title: 'fix(infra): update cluster ingress certificates',
        repo: 'move2move-infra',
        timestamp: '2 days ago'
      }
    ],
    punchcard: generatePunchcard(),
    activityByDate: generateDateMap(0.85)
  },
  {
    login: 'alex-systems',
    name: 'Alex Mercer',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    profileUrl: 'https://github.com/Move2Move',
    role: 'Admin',
    commitsCount: 294,
    prsCreated: 36,
    prsMerged: 34,
    prsClosed: 2,
    reviewsCount: 86,
    issuesCount: 19,
    linesAdded: 19450,
    linesDeleted: 6120,
    impactScore: 89.2,
    rank: 2,
    activeDays: 69,
    repositories: [
      { name: 'move2move-api', commits: 160, prs: 20, linesChanged: 14200 },
      { name: 'move2move-core', commits: 88, prs: 10, linesChanged: 7800 },
      { name: 'move2move-web', commits: 46, prs: 6, linesChanged: 3570 }
    ],
    recentActivity: [
      {
        id: 'act-5',
        type: 'commit',
        title: 'perf(api): introduce redis connection pool pooling',
        repo: 'move2move-api',
        timestamp: '4 hours ago'
      },
      {
        id: 'act-6',
        type: 'pr_opened',
        title: 'PR #145: Rate limiter middleware and token bucket',
        repo: 'move2move-api',
        timestamp: '1 day ago'
      },
      {
        id: 'act-7',
        type: 'review',
        title: 'Reviewed PR #88: dashboard analytics feed',
        repo: 'move2move-web',
        timestamp: '2 days ago'
      }
    ],
    punchcard: generatePunchcard(),
    activityByDate: generateDateMap(0.78)
  },
  {
    login: 'priya-frontend',
    name: 'Priya Sharma',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    profileUrl: 'https://github.com/Move2Move',
    role: 'Member',
    commitsCount: 215,
    prsCreated: 29,
    prsMerged: 28,
    prsClosed: 1,
    reviewsCount: 52,
    issuesCount: 14,
    linesAdded: 24100,
    linesDeleted: 11200,
    impactScore: 82.5,
    rank: 3,
    activeDays: 61,
    repositories: [
      { name: 'move2move-web', commits: 172, prs: 22, linesChanged: 28400 },
      { name: 'move2move-mobile', commits: 43, prs: 7, linesChanged: 6900 }
    ],
    recentActivity: [
      {
        id: 'act-8',
        type: 'commit',
        title: 'feat(web): add responsive high-contrast bento metrics grid',
        repo: 'move2move-web',
        timestamp: 'Yesterday'
      },
      {
        id: 'act-9',
        type: 'pr_merged',
        title: 'Merge PR #89: UI micro-interaction polish',
        repo: 'move2move-web',
        timestamp: '3 days ago'
      }
    ],
    punchcard: generatePunchcard(),
    activityByDate: generateDateMap(0.68)
  },
  {
    login: 'david-contract',
    name: 'David Vance',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    profileUrl: 'https://github.com/Move2Move',
    role: 'Member',
    commitsCount: 168,
    prsCreated: 22,
    prsMerged: 20,
    prsClosed: 2,
    reviewsCount: 64,
    issuesCount: 11,
    linesAdded: 8400,
    linesDeleted: 2900,
    impactScore: 74.8,
    rank: 4,
    activeDays: 52,
    repositories: [
      { name: 'move2move-contracts', commits: 144, prs: 18, linesChanged: 9800 },
      { name: 'move2move-core', commits: 24, prs: 4, linesChanged: 1500 }
    ],
    recentActivity: [
      {
        id: 'act-10',
        type: 'commit',
        title: 'feat(contracts): add non-reentrant guard to deposit vault',
        repo: 'move2move-contracts',
        timestamp: '3 days ago'
      },
      {
        id: 'act-11',
        type: 'review',
        title: 'Approved PR #39: multisig wallet test harness',
        repo: 'move2move-contracts',
        timestamp: '4 days ago'
      }
    ],
    punchcard: generatePunchcard(),
    activityByDate: generateDateMap(0.58)
  },
  {
    login: 'elena-devops',
    name: 'Elena Rostova',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    profileUrl: 'https://github.com/Move2Move',
    role: 'Member',
    commitsCount: 142,
    prsCreated: 19,
    prsMerged: 18,
    prsClosed: 1,
    reviewsCount: 41,
    issuesCount: 16,
    linesAdded: 6900,
    linesDeleted: 4300,
    impactScore: 68.2,
    rank: 5,
    activeDays: 48,
    repositories: [
      { name: 'move2move-infra', commits: 118, prs: 15, linesChanged: 9200 },
      { name: 'move2move-api', commits: 24, prs: 4, linesChanged: 2000 }
    ],
    recentActivity: [
      {
        id: 'act-12',
        type: 'commit',
        title: 'ci: configure parallel runner matrix and caching',
        repo: 'move2move-infra',
        timestamp: '1 day ago'
      },
      {
        id: 'act-13',
        type: 'pr_merged',
        title: 'Merge PR #22: automated staging rollback webhook',
        repo: 'move2move-infra',
        timestamp: '5 days ago'
      }
    ],
    punchcard: generatePunchcard(),
    activityByDate: generateDateMap(0.52)
  },
  {
    login: 'marcus-mobile',
    name: 'Marcus Thorne',
    avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    profileUrl: 'https://github.com/Move2Move',
    role: 'Collaborator',
    commitsCount: 96,
    prsCreated: 14,
    prsMerged: 13,
    prsClosed: 1,
    reviewsCount: 22,
    issuesCount: 9,
    linesAdded: 9800,
    linesDeleted: 3100,
    impactScore: 57.1,
    rank: 6,
    activeDays: 38,
    repositories: [
      { name: 'move2move-mobile', commits: 86, prs: 12, linesChanged: 11200 },
      { name: 'move2move-api', commits: 10, prs: 2, linesChanged: 1700 }
    ],
    recentActivity: [
      {
        id: 'act-14',
        type: 'commit',
        title: 'fix(ios): resolve keychain token persistence on background resume',
        repo: 'move2move-mobile',
        timestamp: '4 days ago'
      }
    ],
    punchcard: generatePunchcard(),
    activityByDate: generateDateMap(0.42)
  }
];

export const mockRepositories: RepositorySummary[] = [
  {
    name: 'move2move-core',
    isPrivate: true,
    description: 'Core blockchain and state consensus verification engine for Move2Move protocol',
    language: 'Rust',
    stars: 0,
    forks: 0,
    updatedAt: '2026-09-20T16:00:00Z',
    commitsCount: 296,
    prsCount: 32,
    topContributors: [
      { login: 'varun-m2m', commits: 184 },
      { login: 'alex-systems', commits: 88 },
      { login: 'david-contract', commits: 24 }
    ]
  },
  {
    name: 'move2move-api',
    isPrivate: true,
    description: 'High-throughput backend REST and gRPC gateway services',
    language: 'Go',
    stars: 0,
    forks: 0,
    updatedAt: '2026-09-20T14:30:00Z',
    commitsCount: 306,
    prsCount: 40,
    topContributors: [
      { login: 'alex-systems', commits: 160 },
      { login: 'varun-m2m', commits: 112 },
      { login: 'elena-devops', commits: 24 }
    ]
  },
  {
    name: 'move2move-contracts',
    isPrivate: true,
    description: 'Move and Solidity smart contracts, liquidity pools, and cross-chain relays',
    language: 'Move',
    stars: 0,
    forks: 0,
    updatedAt: '2026-09-18T19:00:00Z',
    commitsCount: 208,
    prsCount: 24,
    topContributors: [
      { login: 'david-contract', commits: 144 },
      { login: 'varun-m2m', commits: 64 }
    ]
  },
  {
    name: 'move2move-web',
    isPrivate: true,
    description: 'Modern web client application and administrative governance portal',
    language: 'TypeScript',
    stars: 0,
    forks: 0,
    updatedAt: '2026-09-20T10:15:00Z',
    commitsCount: 218,
    prsCount: 28,
    topContributors: [
      { login: 'priya-frontend', commits: 172 },
      { login: 'alex-systems', commits: 46 }
    ]
  },
  {
    name: 'move2move-infra',
    isPrivate: true,
    description: 'Terraform, Kubernetes Helm charts, and automated multi-cloud CI/CD deployment pipelines',
    language: 'HCL',
    stars: 0,
    forks: 0,
    updatedAt: '2026-09-19T22:45:00Z',
    commitsCount: 142,
    prsCount: 19,
    topContributors: [
      { login: 'elena-devops', commits: 118 },
      { login: 'varun-m2m', commits: 24 }
    ]
  },
  {
    name: 'move2move-mobile',
    isPrivate: true,
    description: 'Cross-platform mobile application and secure signer client',
    language: 'Kotlin / Swift',
    stars: 0,
    forks: 0,
    updatedAt: '2026-09-17T11:20:00Z',
    commitsCount: 129,
    prsCount: 19,
    topContributors: [
      { login: 'marcus-mobile', commits: 86 },
      { login: 'priya-frontend', commits: 43 }
    ]
  }
];

export const mockOrgOverview: OrgOverview = {
  orgName: 'Move2Move',
  totalContributors: 6,
  totalCommits: 1299,
  totalPrs: 162,
  totalPrsMerged: 154,
  totalReviews: 383,
  totalIssues: 97,
  totalLinesAdded: 97060,
  totalLinesDeleted: 36560,
  reviewParticipationRate: 84.5,
  activeReposCount: 6,
  dailyActivity: generateDailyPoints(90)
};
