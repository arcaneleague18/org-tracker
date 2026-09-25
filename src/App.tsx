import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ContributorStats,
  RepositorySummary,
  OrgOverview,
  DateRangeOption,
  SyncStatus,
  GitHubCredentials,
  PunchcardSlot,
  DailyActivityPoint
} from './types';
import { cacheService } from './services/cacheService';
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
import { SecurityGateModal } from './components/SecurityGateModal';

const emptyOrgOverview: OrgOverview = {
  orgName: 'Move2Move',
  totalContributors: 0,
  totalCommits: 0,
  totalPrs: 0,
  totalPrsMerged: 0,
  totalReviews: 0,
  totalIssues: 0,
  totalLinesAdded: 0,
  totalLinesDeleted: 0,
  reviewParticipationRate: 0,
  activeReposCount: 0,
  dailyActivity: []
};

/**
 * Neutralizes spreadsheet formula injection (CWE-1236) in CSV exports.
 * If a value starts with formula triggers (=, +, -, @, \t, \r), prepends a single quote (').
 * Also escapes inner double quotes and encloses the value in quotes.
 */
function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export const App: React.FC = () => {
  const [credentials, setCredentials] = useState<GitHubCredentials>(() => cacheService.getCredentials());
  const [dateRange, setDateRange] = useState<DateRangeOption>('90d');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => cacheService.getTheme());

  // Excluded repos -- client-side filter, persisted to localStorage
  const [excludedRepos, setExcludedRepos] = useState<string[]>(() => cacheService.getExcludedRepos());

  // Raw cached data (ALL repos, unfiltered)
  const [rawContributors, setRawContributors] = useState<ContributorStats[]>(() => {
    return cacheService.getCachedData()?.contributors ?? [];
  });
  const [rawRepositories, setRawRepositories] = useState<RepositorySummary[]>(() => {
    return cacheService.getCachedData()?.repositories ?? [];
  });
  const [rawOverview, setRawOverview] = useState<OrgOverview>(() => {
    return cacheService.getCachedData()?.overview ?? emptyOrgOverview;
  });

  const [selectedContributor, setSelectedContributor] = useState<ContributorStats | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Security Gate / First-Time Captcha
  const [isCaptchaVerified, setIsCaptchaVerified] = useState<boolean>(() => cacheService.isCaptchaVerified());
  const [isSecurityGateOpen, setIsSecurityGateOpen] = useState<boolean>(() => !cacheService.isCaptchaVerified());

  const handleCaptchaVerified = useCallback(() => {
    cacheService.setCaptchaVerified(true);
    setIsCaptchaVerified(true);
    setIsSecurityGateOpen(false);
  }, []);

  const handleOpenSecurityGate = useCallback(() => {
    setIsSecurityGateOpen(true);
  }, []);


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

  // --- Derived filtered data (useMemo, instant recomputation) ---

  const excludedSet = useMemo(() => {
    return new Set(excludedRepos.map((r) => r.trim().toLowerCase()));
  }, [excludedRepos]);

  const allRepoNames = useMemo(() => {
    return rawRepositories.map((r) => r.name).sort((a, b) => a.localeCompare(b));
  }, [rawRepositories]);

  // Filtered contributors: calculate exact stats for included repos,
  // recompute impact scores, sort, re-rank (rankings/placeings),
  // and filter out contributors who have no activity in the included repos.
  const contributors = useMemo((): ContributorStats[] => {
    if (excludedSet.size === 0) return rawContributors;

    // 1. Process each contributor against included repos
    const list = rawContributors
      .map((c) => {
        const filteredRepos = c.repositories.filter(
          (r) => !excludedSet.has(r.name.toLowerCase())
        );
        const filteredActivity = c.recentActivity.filter(
          (a) => !excludedSet.has(a.repo.toLowerCase())
        );

        // If contributor has no repos and no activity in included repos, omit them
        if (filteredRepos.length === 0 && filteredActivity.length === 0) {
          return null;
        }

        // Exact totals from included repos
        const commitsCount = filteredRepos.reduce((s, r) => s + (r.commits || 0), 0);
        const prsCreated = filteredRepos.reduce((s, r) => s + (r.prs || 0), 0);

        // Fallback to counting from filteredActivity if prsMerged/reviews/issues not on cached repo
        const prsMerged = filteredRepos.reduce(
          (s, r) =>
            s +
            (r.prsMerged !== undefined
              ? r.prsMerged
              : filteredActivity.filter(
                  (a) => a.repo.toLowerCase() === r.name.toLowerCase() && a.type === 'pr_merged'
                ).length),
          0
        );

        const prsClosed = filteredRepos.reduce(
          (s, r) =>
            s +
            (r.prsClosed !== undefined
              ? r.prsClosed
              : filteredActivity.filter(
                  (a) => a.repo.toLowerCase() === r.name.toLowerCase() && a.type === 'pr_opened'
                ).length),
          0
        );

        const reviewsCount = filteredRepos.reduce(
          (s, r) =>
            s +
            (r.reviews !== undefined
              ? r.reviews
              : filteredActivity.filter(
                  (a) => a.repo.toLowerCase() === r.name.toLowerCase() && a.type === 'review'
                ).length),
          0
        );

        const issuesCount = filteredRepos.reduce(
          (s, r) =>
            s +
            (r.issues !== undefined
              ? r.issues
              : filteredActivity.filter(
                  (a) => a.repo.toLowerCase() === r.name.toLowerCase() && a.type === 'issue'
                ).length),
          0
        );

        const linesAdded = filteredRepos.reduce(
          (s, r) => s + (r.linesAdded ?? Math.round((r.linesChanged || 0) * 0.75)),
          0
        );

        const linesDeleted = filteredRepos.reduce(
          (s, r) => s + (r.linesDeleted ?? Math.round((r.linesChanged || 0) * 0.25)),
          0
        );

        // Raw impact formula matching dataAggregator.ts:
        // commitsCount * 3 + prsMerged * 5 + reviewsCount * 4 + issuesCount * 2 + Math.round((linesAdded + linesDeleted) / 250)
        const rawImpactScore =
          commitsCount * 3 +
          prsMerged * 5 +
          reviewsCount * 4 +
          issuesCount * 2 +
          Math.round((linesAdded + linesDeleted) / 250);

        // Recompute punchcard for included repos
        const punchMap: Record<string, { count: number; dates: Set<string> }> = {};
        for (let day = 0; day < 7; day++) {
          for (let hour = 0; hour < 24; hour++) {
            punchMap[`${day}-${hour}`] = { count: 0, dates: new Set<string>() };
          }
        }
        const activeDatesSet = new Set<string>();
        const activityByDate: Record<string, number> = {};

        for (const ev of filteredActivity) {
          const dateStr = ev.dateStr || (ev.isoDate ? ev.isoDate.split('T')[0] : '');
          if (dateStr) {
            activeDatesSet.add(dateStr);
            activityByDate[dateStr] = (activityByDate[dateStr] || 0) + 1;
          }
          if (typeof ev.dayOfWeek === 'number' && typeof ev.hour === 'number') {
            const key = `${ev.dayOfWeek}-${ev.hour}`;
            if (punchMap[key]) {
              punchMap[key].count++;
              if (dateStr) punchMap[key].dates.add(dateStr);
            }
          }
        }

        const punchcardSlots: PunchcardSlot[] = [];
        for (let day = 0; day < 7; day++) {
          for (let hour = 0; hour < 24; hour++) {
            const slot = punchMap[`${day}-${hour}`];
            punchcardSlots.push({
              day,
              hour,
              count: slot.count,
              dates: Array.from(slot.dates).sort()
            });
          }
        }

        return {
          ...c,
          commitsCount,
          prsCreated,
          prsMerged,
          prsClosed,
          reviewsCount,
          issuesCount,
          linesAdded,
          linesDeleted,
          impactScore: rawImpactScore, // temporary raw score for sorting
          activeDays: activeDatesSet.size || (filteredRepos.length > 0 ? 1 : 0),
          repositories: filteredRepos.sort((a, b) => (b.commits || 0) - (a.commits || 0)),
          recentActivity: filteredActivity,
          punchcard: punchcardSlots,
          activityByDate
        };
      })
      .filter((c): c is ContributorStats => c !== null);

    // 2. Sort by raw impact score descending (ties broken by commits, then login)
    list.sort((a, b) => {
      if (b.impactScore !== a.impactScore) {
        return b.impactScore - a.impactScore;
      }
      if (b.commitsCount !== a.commitsCount) {
        return b.commitsCount - a.commitsCount;
      }
      return a.login.localeCompare(b.login);
    });

    // 3. Normalize impact score to 0 - 100 with 1 decimal place and assign ranks (rankings / placeings)
    const maxScore = list[0]?.impactScore || 1;
    list.forEach((c, idx) => {
      c.rank = idx + 1;
      c.impactScore = maxScore > 0 ? Number(((c.impactScore / maxScore) * 100).toFixed(1)) : 0;
    });

    return list;
  }, [rawContributors, excludedSet]);

  const repositories = useMemo(() => {
    if (excludedSet.size === 0) return rawRepositories;
    return rawRepositories.filter((r) => !excludedSet.has(r.name.toLowerCase()));
  }, [rawRepositories, excludedSet]);

  const overview = useMemo((): OrgOverview => {
    if (excludedSet.size === 0) return rawOverview;
    // Recalculate overview from filtered data
    const totalCommits = contributors.reduce((s, c) => s + c.commitsCount, 0);
    const totalPrs = contributors.reduce((s, c) => s + c.prsCreated, 0);
    const totalPrsMerged = contributors.reduce((s, c) => s + c.prsMerged, 0);
    const totalReviews = contributors.reduce((s, c) => s + c.reviewsCount, 0);
    const totalIssues = contributors.reduce((s, c) => s + c.issuesCount, 0);
    const totalLinesAdded = contributors.reduce((s, c) => s + c.linesAdded, 0);
    const totalLinesDeleted = contributors.reduce((s, c) => s + c.linesDeleted, 0);
    const activeContributors = contributors.filter((c) => c.commitsCount > 0 || c.prsCreated > 0);

    // Reconstruct daily activity from filtered events
    const dailyMap: Record<string, { commits: number; prs: number; reviews: number }> = {};
    for (const c of contributors) {
      for (const ev of c.recentActivity) {
        const dateStr = ev.dateStr || (ev.isoDate ? ev.isoDate.split('T')[0] : '');
        if (!dateStr) continue;
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = { commits: 0, prs: 0, reviews: 0 };
        }
        if (ev.type === 'commit') dailyMap[dateStr].commits++;
        else if (ev.type === 'pr_opened' || ev.type === 'pr_merged') dailyMap[dateStr].prs++;
        else if (ev.type === 'review') dailyMap[dateStr].reviews++;
      }
    }

    const sortedDates = Object.keys(dailyMap).sort();
    const dailyActivity: DailyActivityPoint[] = sortedDates.map((date) => ({
      date,
      commits: dailyMap[date].commits,
      prs: dailyMap[date].prs,
      reviews: dailyMap[date].reviews,
      total: dailyMap[date].commits + dailyMap[date].prs + dailyMap[date].reviews
    }));

    return {
      ...rawOverview,
      totalContributors: activeContributors.length,
      totalCommits,
      totalPrs,
      totalPrsMerged,
      totalReviews,
      totalIssues,
      totalLinesAdded,
      totalLinesDeleted,
      activeReposCount: repositories.length,
      reviewParticipationRate: totalPrs > 0 ? Math.round((totalReviews / totalPrs) * 100) : 0,
      dailyActivity: dailyActivity.length > 0 ? dailyActivity : rawOverview.dailyActivity
    };
  }, [rawOverview, contributors, repositories, excludedSet]);

  // Apply theme class to body
  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light');
  }, [theme]);



  // Live Sync Trigger -- fetches ALL repos (no exclusion during fetch)
  const handleTriggerSync = useCallback(async () => {
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

      // 2. Fetch ALL Repositories (no exclusion filter)
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

      // Store raw unfiltered data
      setRawContributors(aggregated.contributors);
      setRawRepositories(aggregated.repositories);
      setRawOverview(aggregated.overview);

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
  }, [credentials, dateRange, syncStatus.lastSyncedAt]);

  // Auto-sync on load only if security captcha is verified and no data is loaded
  useEffect(() => {
    if (isCaptchaVerified && !syncStatus.isSyncing && rawContributors.length === 0) {
      handleTriggerSync();
    }
  }, [isCaptchaVerified, syncStatus.isSyncing, rawContributors.length, handleTriggerSync]);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    cacheService.setTheme(nextTheme);
  };

  const handleSaveCredentials = (newCreds: GitHubCredentials) => {
    setCredentials(newCreds);
    cacheService.saveCredentials(newCreds);
    setTimeout(() => {
      handleTriggerSync();
    }, 100);
  };

  const handleClearCredentials = () => {
    cacheService.clearCredentials();
    cacheService.clearCache();
    setCredentials({ token: '', org: 'Move2Move' });
    setRawContributors([]);
    setRawRepositories([]);
    setRawOverview(emptyOrgOverview);
    setTimeout(() => {
      handleTriggerSync();
    }, 100);
  };

  // --- Repo Exclusion Handlers ---

  const handleToggleRepoExclusion = useCallback((repoName: string) => {
    setExcludedRepos((prev) => {
      const lower = repoName.trim().toLowerCase();
      const isCurrentlyExcluded = prev.some((r) => r.trim().toLowerCase() === lower);
      let next: string[];
      if (isCurrentlyExcluded) {
        next = prev.filter((r) => r.trim().toLowerCase() !== lower);
      } else {
        next = [...prev, repoName.trim()];
      }
      cacheService.saveExcludedRepos(next);
      return next;
    });
  }, []);

  const handleSetAllReposIncluded = useCallback(() => {
    setExcludedRepos([]);
    cacheService.saveExcludedRepos([]);
  }, []);

  const handleSetAllReposExcluded = useCallback(() => {
    const all = rawRepositories.map((r) => r.name);
    setExcludedRepos(all);
    cacheService.saveExcludedRepos(all);
  }, [rawRepositories]);

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
    ].map(sanitizeCsvCell);

    const rows = contributors.map((c) => [
      sanitizeCsvCell(c.rank),
      sanitizeCsvCell(`@${c.login}`),
      sanitizeCsvCell(c.name),
      sanitizeCsvCell(c.role),
      sanitizeCsvCell(c.impactScore),
      sanitizeCsvCell(c.commitsCount),
      sanitizeCsvCell(c.prsMerged),
      sanitizeCsvCell(c.prsCreated),
      sanitizeCsvCell(c.reviewsCount),
      sanitizeCsvCell(c.linesAdded),
      sanitizeCsvCell(c.linesDeleted),
      sanitizeCsvCell(c.activeDays),
      sanitizeCsvCell(c.repositories.map((r) => r.name).join(', '))
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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="app-tactical-root">
      {/* Tactical HUD Header */}
      <Header
        orgName={credentials.org || 'Move2Move'}
        dateRange={dateRange}
        onChangeDateRange={setDateRange}
        syncStatus={syncStatus}
        onTriggerSync={handleTriggerSync}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExportCsv={handleExportCsv}
        hasToken={Boolean(credentials.token) || cacheService.hasServerProxy()}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        allRepoNames={allRepoNames}
        excludedRepos={excludedRepos}
        onToggleRepoExclusion={handleToggleRepoExclusion}
        onIncludeAllRepos={handleSetAllReposIncluded}
        onExcludeAllRepos={handleSetAllReposExcluded}
      />

      {/* Main Tactical Canvas */}
      <main className="container main-tactical-content">
        {/* Token Required Banner (Only if neither token nor server proxy is available) */}
        {!credentials.token && !cacheService.hasServerProxy() && (
          <div className="tactical-unconfigured-banner font-mono">
            <div className="unconfigured-left">
              <span className="unconfigured-tag">[ RESTRICTED_ACCESS // TOKEN_REQUIRED ]</span>
              <p className="unconfigured-text">
                Move2Move organization repositories are private. Configure a GitHub Personal Access Token (PAT) in .env (VITE_GITHUB_TOKEN) or override in system configuration to index live commits, PRs, and code audits.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="btn-tactical btn-tactical-hazard unconfigured-btn"
            >
              [ CONFIGURE_CREDENTIALS ]
            </button>
          </div>
        )}

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
        <ActivityHeatmap dailyActivity={overview.dailyActivity} />

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
              onClick={handleOpenSecurityGate}
              className="footer-link-tactical"
              title="Identity & Hardware Security Gateway (Poké Claw Captcha)"
            >
              {isCaptchaVerified ? '[SECURITY: VERIFIED]' : '[SECURITY: GATE_ACTIVE]'}
            </button>
            <span className="footer-pipe">|</span>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="footer-link-tactical"
            >
              [CONFIG]
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

      {/* First-Time Access Control Security Gate (Claw Machine Captcha) */}
      <SecurityGateModal
        isOpen={isSecurityGateOpen}
        onVerified={handleCaptchaVerified}
        onDismiss={isCaptchaVerified ? () => setIsSecurityGateOpen(false) : undefined}
        allowBypass={isCaptchaVerified}
      />

      {/* Declassified Contributor Dossier Modal */}
      {selectedContributor && (
        <ContributorDetailModal
          contributor={
            contributors.find((c) => c.login.toLowerCase() === selectedContributor.login.toLowerCase()) ||
            selectedContributor
          }
          onClose={() => setSelectedContributor(null)}
        />
      )}

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
        .tactical-unconfigured-banner {
          margin: 1.5rem 0 0.5rem 0;
          background: var(--bg-panel);
          border: 1px solid var(--accent-hazard);
          border-left-width: 4px;
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1.5rem;
          max-width: 100%;
          box-sizing: border-box;
        }
        .unconfigured-left {
          flex: 1;
          min-width: 0;
        }
        .unconfigured-tag {
          color: var(--accent-hazard);
          font-weight: 700;
          font-size: 0.85rem;
          display: block;
          margin-bottom: 0.35rem;
        }
        .unconfigured-text {
          font-size: 0.78rem;
          color: var(--text-dim);
          line-height: 1.5;
          margin: 0;
        }
        .unconfigured-btn {
          white-space: nowrap;
          padding: 0.6rem 1.2rem;
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
          max-width: 100%;
          box-sizing: border-box;
        }
        .error-prefix {
          color: var(--accent-hazard);
          font-weight: 700;
        }
        .error-body {
          color: var(--text-phosphor);
          flex: 1;
          min-width: 0;
          word-break: break-word;
        }
        .error-ctrls {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .tactical-footer {
          border-top: 1px solid var(--border-tactical);
          background: var(--bg-panel);
          margin-top: auto;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
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
          flex-wrap: wrap;
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

        @media (max-width: 768px) {
          .tactical-unconfigured-banner {
            padding: 0.85rem 1rem;
            gap: 1rem;
          }
          .tactical-error-banner {
            padding: 0.75rem 1rem;
            gap: 0.75rem;
          }
          .footer-content-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
            padding: 1rem 0;
          }
        }
      `}</style>
    </div>
  );
};
