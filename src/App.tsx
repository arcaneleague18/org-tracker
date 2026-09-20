import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ContributorStats,
  RepositorySummary,
  OrgOverview,
  DateRangeOption,
  SyncStatus,
  GitHubCredentials
} from './types';
import { cacheService } from './services/cacheService';
import { mockContributors, mockRepositories, mockOrgOverview } from './services/mockData';
import { githubApi, getLatestRateLimit, RawCommit, RawPull, RawReview, RawIssue } from './services/githubApi';
import { aggregateOrgData } from './services/dataAggregator';
import { Header } from './components/Header';
import { OverviewCards } from './components/OverviewCards';
import { ActivityHeatmap } from './components/ActivityHeatmap';
import { ContributorLeaderboard } from './components/ContributorLeaderboard';
import { ContributorDetailModal } from './components/ContributorDetailModal';
import { RepoBreakdown } from './components/RepoBreakdown';
import { SettingsModal } from './components/SettingsModal';
import { SyncProgressModal } from './components/SyncProgressModal';

export const App: React.FC = () => {
  const [credentials, setCredentials] = useState<GitHubCredentials>(() => cacheService.getCredentials());
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => cacheService.isDemoMode());
  const [dateRange, setDateRange] = useState<DateRangeOption>('90d');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => cacheService.getTheme());

  const [contributors, setContributors] = useState<ContributorStats[]>([]);
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [overview, setOverview] = useState<OrgOverview>(mockOrgOverview);

  const [selectedContributor, setSelectedContributor] = useState<ContributorStats | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    phase: 'idle',
    currentRepo: '',
    progress: 0,
    rateLimitRemaining: null,
    rateLimitReset: null,
    lastSyncedAt: cacheService.getLastSyncTime(),
    errorMessage: null
  });

  // Apply theme class to body
  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light');
  }, [theme]);

  // Load Initial Data (Cached or Demo)
  useEffect(() => {
    if (isDemoMode) {
      setContributors(mockContributors);
      setRepositories(mockRepositories);
      setOverview(mockOrgOverview);
    } else {
      const cached = cacheService.getCachedData();
      if (cached) {
        setContributors(cached.contributors);
        setRepositories(cached.repositories);
        setOverview(cached.overview);
      } else {
        setContributors(mockContributors);
        setRepositories(mockRepositories);
        setOverview(mockOrgOverview);
      }
    }
  }, [isDemoMode]);

  // Date Range Filtering computation
  const filteredDailyPoints = useMemo(() => {
    let daysToInclude = 90;
    if (dateRange === '7d') daysToInclude = 7;
    else if (dateRange === '30d') daysToInclude = 30;
    else if (dateRange === '90d') daysToInclude = 90;
    else if (dateRange === 'year') daysToInclude = 365;
    else daysToInclude = 9999;

    return overview.dailyActivity.slice(-daysToInclude);
  }, [overview.dailyActivity, dateRange]);

  // Live Sync Trigger
  const handleTriggerSync = useCallback(async () => {
    if (isDemoMode) {
      setSyncStatus({
        isSyncing: true,
        phase: 'members',
        currentRepo: '',
        progress: 15,
        rateLimitRemaining: 4982,
        rateLimitReset: null,
        lastSyncedAt: syncStatus.lastSyncedAt,
        errorMessage: null
      });

      await new Promise((r) => setTimeout(r, 500));
      setSyncStatus((prev) => ({ ...prev, phase: 'repos', progress: 40 }));
      await new Promise((r) => setTimeout(r, 500));
      setSyncStatus((prev) => ({ ...prev, phase: 'commits', currentRepo: 'move2move-core', progress: 70 }));
      await new Promise((r) => setTimeout(r, 500));
      setSyncStatus((prev) => ({ ...prev, phase: 'aggregating', progress: 95 }));
      await new Promise((r) => setTimeout(r, 300));

      const now = new Date().toISOString();
      setSyncStatus({
        isSyncing: false,
        phase: 'done',
        currentRepo: '',
        progress: 100,
        rateLimitRemaining: 4975,
        rateLimitReset: null,
        lastSyncedAt: now,
        errorMessage: null
      });
      return;
    }

    if (!credentials.token) {
      setIsSettingsOpen(true);
      return;
    }

    setErrorMessage(null);
    setSyncStatus({
      isSyncing: true,
      phase: 'members',
      currentRepo: '',
      progress: 5,
      rateLimitRemaining: null,
      rateLimitReset: null,
      lastSyncedAt: syncStatus.lastSyncedAt,
      errorMessage: null
    });

    try {
      const org = credentials.org || 'Move2Move';
      const token = credentials.token;

      // 1. Fetch Members
      const members = await githubApi.fetchOrgMembers(token, org);
      setSyncStatus((prev) => ({
        ...prev,
        phase: 'repos',
        progress: 15,
        rateLimitRemaining: getLatestRateLimit()?.remaining ?? null
      }));

      // 2. Fetch Repositories
      const repos = await githubApi.fetchOrgRepos(token, org);
      const commitsByRepo: Record<string, RawCommit[]> = {};
      const pullsByRepo: Record<string, RawPull[]> = {};
      const reviewsByRepoPull: Record<string, RawReview[]> = {};
      const issuesByRepo: Record<string, RawIssue[]> = {};

      let sinceDate: string | undefined;
      if (dateRange === '7d' || dateRange === '30d' || dateRange === '90d') {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const d = new Date();
        d.setDate(d.getDate() - days);
        sinceDate = d.toISOString();
      }

      const totalRepos = repos.length || 1;
      for (let i = 0; i < repos.length; i++) {
        const repo = repos[i];
        const progressBase = 20 + Math.floor(((i + 1) / totalRepos) * 60);

        setSyncStatus((prev) => ({
          ...prev,
          phase: 'commits',
          currentRepo: repo.name,
          progress: progressBase - 5,
          rateLimitRemaining: getLatestRateLimit()?.remaining ?? null
        }));

        const commits = await githubApi.fetchRepoCommits(token, org, repo.name, sinceDate);
        commitsByRepo[repo.name] = commits;

        setSyncStatus((prev) => ({
          ...prev,
          phase: 'pulls',
          currentRepo: repo.name,
          progress: progressBase
        }));

        const pulls = await githubApi.fetchRepoPulls(token, org, repo.name);
        pullsByRepo[repo.name] = pulls;

        const recentPulls = pulls.slice(0, 15);
        for (const pr of recentPulls) {
          const reviews = await githubApi.fetchPullReviews(token, org, repo.name, pr.number);
          reviewsByRepoPull[`${repo.name}:${pr.number}`] = reviews;
        }

        const issues = await githubApi.fetchRepoIssues(token, org, repo.name, sinceDate);
        issuesByRepo[repo.name] = issues;
      }

      setSyncStatus((prev) => ({ ...prev, phase: 'aggregating', progress: 90 }));

      const aggregated = aggregateOrgData(
        {
          members,
          repos,
          commitsByRepo,
          pullsByRepo,
          reviewsByRepoPull,
          issuesByRepo
        },
        org
      );

      setContributors(aggregated.contributors);
      setRepositories(aggregated.repositories);
      setOverview(aggregated.overview);

      cacheService.saveCachedData(aggregated);

      const now = new Date().toISOString();
      setSyncStatus({
        isSyncing: false,
        phase: 'done',
        currentRepo: '',
        progress: 100,
        rateLimitRemaining: getLatestRateLimit()?.remaining ?? null,
        rateLimitReset: null,
        lastSyncedAt: now,
        errorMessage: null
      });
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMessage(e.message || 'GITHUB_REST_API_EXCEPTION.');
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        phase: 'error',
        errorMessage: e.message || 'SYNC_FAILURE'
      }));
    }
  }, [credentials, isDemoMode, dateRange, syncStatus.lastSyncedAt]);

  const handleToggleDemoMode = () => {
    const nextVal = !isDemoMode;
    setIsDemoMode(nextVal);
    cacheService.setDemoMode(nextVal);
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    cacheService.setTheme(nextTheme);
  };

  const handleSaveCredentials = (newCreds: GitHubCredentials) => {
    setCredentials(newCreds);
    cacheService.saveCredentials(newCreds);
    setIsDemoMode(false);
    cacheService.setDemoMode(false);
  };

  const handleClearCredentials = () => {
    setCredentials({ token: '', org: 'Move2Move' });
    cacheService.clearCredentials();
    cacheService.clearCache();
    setIsDemoMode(true);
    cacheService.setDemoMode(true);
  };

  const handleExportCsv = () => {
    if (contributors.length === 0) return;

    const headers = [
      'Rank',
      'Handle',
      'Name',
      'Role',
      'Impact Score',
      'Commits',
      'PRs Merged',
      'PRs Created',
      'Code Reviews',
      'Lines Added',
      'Lines Deleted',
      'Active Days',
      'Primary Repositories'
    ];

    const rows = contributors.map((c) => [
      c.rank,
      `@${c.login}`,
      `"${c.name.replace(/"/g, '""')}"`,
      c.role,
      c.impactScore,
      c.commitsCount,
      c.prsMerged,
      c.prsCreated,
      c.reviewsCount,
      c.linesAdded,
      c.linesDeleted,
      c.activeDays,
      `"${c.repositories.map((r) => r.name).join(', ')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Move2Move_contributions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app-tactical-root">
      {/* Tactical HUD Header */}
      <Header
        orgName={credentials.org || 'Move2Move'}
        isDemoMode={isDemoMode}
        onToggleDemoMode={handleToggleDemoMode}
        dateRange={dateRange}
        onChangeDateRange={setDateRange}
        syncStatus={syncStatus}
        onTriggerSync={handleTriggerSync}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExportCsv={handleExportCsv}
        hasToken={Boolean(credentials.token)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Tactical Canvas */}
      <main className="container main-tactical-content">
        {/* Error Alert Bar */}
        {errorMessage && (
          <div className="tactical-error-banner font-mono">
            <span className="error-prefix">[ CRITICAL_ALERT // API_ERROR ]</span>
            <span className="error-body">{errorMessage}</span>
            <div className="error-ctrls">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="btn-tactical btn-tactical-hazard"
              >
                [OPEN_CONFIG]
              </button>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="btn-tactical"
              >
                [DISMISS]
              </button>
            </div>
          </div>
        )}

        {/* 1. Diagnostics: Overview Metrics Modules */}
        <OverviewCards overview={overview} />

        {/* 2. Temporal Matrix: Organization Heatmap */}
        <ActivityHeatmap dailyActivity={filteredDailyPoints} />

        {/* 3. Personnel: Contributor Leaderboard Dossier */}
        <ContributorLeaderboard
          contributors={contributors}
          onSelectContributor={(c) => setSelectedContributor(c)}
        />

        {/* 4. Inventory: Repositories Directory */}
        <RepoBreakdown repositories={repositories} />
      </main>

      {/* Tactical Sub-Footer */}
      <footer className="tactical-footer font-mono">
        <div className="hazard-stripe" />
        <div className="container footer-content-row">
          <div className="footer-meta-left">
            <span className="footer-sys">[ MOVE2MOVE_TELEMETRY_ENGINE // REV_2.4 ]</span>
            <span className="footer-class">[ CLASSIFICATION: PRIVATE // PROTOCOL: GITHUB_REST_V3 ]</span>
          </div>
          <div className="footer-meta-right">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="footer-link-tactical"
            >
              [AUTH_CONFIG]
            </button>
            <span className="footer-pipe">|</span>
            <button
              type="button"
              onClick={handleToggleDemoMode}
              className="footer-link-tactical"
            >
              {isDemoMode ? '[SWITCH_LIVE]' : '[SWITCH_SIM]'}
            </button>
            <span className="footer-pipe">|</span>
            <button
              type="button"
              onClick={handleToggleTheme}
              className="footer-link-tactical"
            >
              {theme === 'dark' ? '[THEME: LIGHT]' : '[THEME: DARK]'}
            </button>
            <span className="footer-pipe">|</span>
            <span className="footer-status-tag">[STATUS: ONLINE]</span>
          </div>
        </div>
      </footer>

      {/* Declassified Contributor Dossier Modal */}
      <ContributorDetailModal
        contributor={selectedContributor}
        onClose={() => setSelectedContributor(null)}
      />

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          initialCredentials={credentials}
          onSave={handleSaveCredentials}
          onClear={handleClearCredentials}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Syncing Modal */}
      <SyncProgressModal status={syncStatus} />

      <style>{`
        .app-tactical-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .main-tactical-content {
          flex: 1;
        }
        .tactical-error-banner {
          margin: 1.25rem 0 0.5rem 0;
          background: var(--bg-panel);
          border: 1px solid var(--accent-hazard);
          border-left-width: 4px;
          padding: 0.85rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          font-size: 0.72rem;
        }
        .error-prefix {
          color: var(--accent-hazard);
          font-weight: 700;
        }
        .error-body {
          color: var(--text-phosphor);
          flex: 1;
        }
        .error-ctrls {
          display: flex;
          gap: 0.5rem;
        }
        .tactical-footer {
          border-top: 1px solid var(--border-tactical);
          background: var(--bg-panel);
          margin-top: auto;
        }
        .footer-content-row {
          padding: 1.5rem 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          font-size: 0.68rem;
        }
        .footer-meta-left {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .footer-sys {
          color: var(--text-phosphor);
          font-weight: 700;
        }
        .footer-class {
          color: var(--text-ghost);
        }
        .footer-meta-right {
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }
        .footer-link-tactical {
          background: transparent;
          border: none;
          color: var(--text-dim);
          font-family: var(--font-mono);
          font-size: 0.68rem;
          cursor: pointer;
        }
        .footer-link-tactical:hover {
          color: var(--accent-hazard);
        }
        .footer-pipe {
          color: var(--text-ghost);
        }
        .footer-status-tag {
          color: var(--accent-radar);
          font-weight: 700;
        }
      `}</style>
    </div>
  );
};
