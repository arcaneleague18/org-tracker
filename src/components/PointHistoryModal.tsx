import React, { useState, useMemo, useEffect } from 'react';
import { ContributorStats, ActivityEvent } from '../types';
import {
  GitCommitIcon,
  GitPullRequestIcon,
  GitMergeIcon,
  MessageSquareIcon,
  CodeIcon,
  ArrowUpRightIcon,
  CheckIcon,
  SearchIcon
} from './Icons';

interface PointHistoryModalProps {
  contributor: ContributorStats | null;
  allContributors?: ContributorStats[];
  onClose: () => void;
  onOpenDossier?: (contributor: ContributorStats) => void;
}

type TabMode = 'breakdown' | 'ledger' | 'daily';
type FilterType = 'all' | 'commit' | 'pr_merged' | 'review' | 'issue';

export const PointHistoryModal: React.FC<PointHistoryModalProps> = ({
  contributor,
  allContributors = [],
  onClose,
  onOpenDossier
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('breakdown');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Scoring calculations
  const scoringData = useMemo(() => {
    if (!contributor) return null;

    const commitPts = contributor.commitsCount * 3;
    const prMergedPts = contributor.prsMerged * 5;
    const reviewPts = contributor.reviewsCount * 4;
    const issuePts = contributor.issuesCount * 2;
    const totalChurn = (contributor.linesAdded || 0) + (contributor.linesDeleted || 0);
    const churnPts = Math.round(totalChurn / 250);

    const rawTotal = commitPts + prMergedPts + reviewPts + issuePts + churnPts;

    // Calculate max raw score across all contributors for benchmark reference
    let maxRaw = rawTotal;
    if (allContributors && allContributors.length > 0) {
      maxRaw = Math.max(
        ...allContributors.map((c) => {
          const cChurn = (c.linesAdded || 0) + (c.linesDeleted || 0);
          return (
            c.commitsCount * 3 +
            c.prsMerged * 5 +
            c.reviewsCount * 4 +
            c.issuesCount * 2 +
            Math.round(cChurn / 250)
          );
        }),
        1
      );
    }

    return {
      commitPts,
      prMergedPts,
      reviewPts,
      issuePts,
      totalChurn,
      churnPts,
      rawTotal,
      maxRaw
    };
  }, [contributor, allContributors]);

  // Scored Events & Chronological Ledger
  const { scoredEvents, dailyBreakdown, totalScoredPoints } = useMemo(() => {
    if (!contributor) {
      return { scoredEvents: [], dailyBreakdown: [], totalScoredPoints: 0 };
    }

    const events = contributor.recentActivity || [];

    const getEventPoints = (ev: ActivityEvent): { points: number; label: string; tag: string } => {
      switch (ev.type) {
        case 'commit':
          return { points: 3, label: '+3 PTS', tag: 'COMMIT' };
        case 'pr_merged':
          return { points: 5, label: '+5 PTS', tag: 'PR_MERGED' };
        case 'review':
          return { points: 4, label: '+4 PTS', tag: 'PEER_AUDIT' };
        case 'issue':
          return { points: 2, label: '+2 PTS', tag: 'ISSUE_LOG' };
        case 'pr_opened':
          return { points: 0, label: '+0 PTS', tag: 'PR_OPENED' };
        default:
          return { points: 1, label: '+1 PT', tag: 'EVENT' };
      }
    };

    const getEventCanonicalDate = (event: ActivityEvent): string => {
      if (event.dateStr && /^\d{4}-\d{2}-\d{2}$/.test(event.dateStr)) {
        return event.dateStr;
      }
      if (event.isoDate) {
        return event.isoDate.split('T')[0];
      }
      if (event.timestamp) {
        if (/^\d{4}-\d{2}-\d{2}/.test(event.timestamp)) {
          return event.timestamp.substring(0, 10);
        }
        const d = new Date(event.timestamp);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        }
      }
      return '';
    };

    // Sort ascending by time to calculate accurate running total
    const sortedAsc = [...events].sort((a, b) => {
      const timeA = a.isoDate ? new Date(a.isoDate).getTime() : new Date(a.timestamp).getTime();
      const timeB = b.isoDate ? new Date(b.isoDate).getTime() : new Date(b.timestamp).getTime();
      return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
    });

    let runningSum = 0;
    const runningMap = new Map<string, number>();

    const scoredAsc = sortedAsc.map((ev) => {
      const meta = getEventPoints(ev);
      runningSum += meta.points;
      runningMap.set(ev.id, runningSum);
      const canonicalDate = getEventCanonicalDate(ev);
      return {
        ...ev,
        canonicalDate,
        points: meta.points,
        pointLabel: meta.label,
        tag: meta.tag,
        runningTotal: runningSum
      };
    });

    // Daily breakdown mapping
    const dailyMap = new Map<
      string,
      {
        date: string;
        commits: number;
        prsMerged: number;
        reviews: number;
        issues: number;
        points: number;
        events: typeof scoredAsc;
      }
    >();

    for (const item of scoredAsc) {
      const d = item.canonicalDate || 'UNKNOWN_DATE';
      if (!dailyMap.has(d)) {
        dailyMap.set(d, {
          date: d,
          commits: 0,
          prsMerged: 0,
          reviews: 0,
          issues: 0,
          points: 0,
          events: []
        });
      }
      const entry = dailyMap.get(d)!;
      if (item.type === 'commit') entry.commits++;
      else if (item.type === 'pr_merged') entry.prsMerged++;
      else if (item.type === 'review') entry.reviews++;
      else if (item.type === 'issue') entry.issues++;

      entry.points += item.points;
      entry.events.push(item);
    }

    // Incorporate any extra dates from activityByDate for completeness
    if (contributor.activityByDate) {
      for (const [dateStr, count] of Object.entries(contributor.activityByDate)) {
        if (!dailyMap.has(dateStr)) {
          const estimatedPts = count * 3;
          dailyMap.set(dateStr, {
            date: dateStr,
            commits: count,
            prsMerged: 0,
            reviews: 0,
            issues: 0,
            points: estimatedPts,
            events: []
          });
        }
      }
    }

    const sortedDaily = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    // Sort events descending (newest first) for user-facing audit ledger
    const scoredDesc = [...scoredAsc].reverse();

    return {
      scoredEvents: scoredDesc,
      dailyBreakdown: sortedDaily,
      totalScoredPoints: runningSum
    };
  }, [contributor]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return scoredEvents.filter((ev) => {
      if (filterType !== 'all') {
        if (filterType === 'pr_merged' && ev.type !== 'pr_merged') return false;
        if (filterType === 'commit' && ev.type !== 'commit') return false;
        if (filterType === 'review' && ev.type !== 'review') return false;
        if (filterType === 'issue' && ev.type !== 'issue') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = ev.title.toLowerCase().includes(q);
        const matchRepo = ev.repo.toLowerCase().includes(q);
        const matchTag = ev.tag.toLowerCase().includes(q);
        if (!matchTitle && !matchRepo && !matchTag) return false;
      }
      return true;
    });
  }, [scoredEvents, filterType, searchQuery]);

  if (!contributor || !scoringData) return null;

  const handleCopyAudit = () => {
    const text = [
      '=========================================================',
      `POINT HISTORY & IMPACT AUDIT // OPERATIVE: ${contributor.name} (@${contributor.login})`,
      '=========================================================',
      `UNIT_RANK: #${contributor.rank} | IMPACT_IDX: ${contributor.impactScore} / 100`,
      `TOTAL_RAW_POINTS: ${scoringData.rawTotal} PTS (ORG_BENCHMARK_MAX: ${scoringData.maxRaw} PTS)`,
      '',
      '--- POINT BREAKDOWN FORMULA ---',
      `• Commits: ${contributor.commitsCount} x 3 pts = ${scoringData.commitPts} pts`,
      `• Merged PRs: ${contributor.prsMerged} x 5 pts = ${scoringData.prMergedPts} pts`,
      `• Peer Reviews / Audits: ${contributor.reviewsCount} x 4 pts = ${scoringData.reviewPts} pts`,
      `• Issues Logged: ${contributor.issuesCount} x 2 pts = ${scoringData.issuePts} pts`,
      `• LOC Churn: ${scoringData.totalChurn.toLocaleString()} lines / 250 = ${scoringData.churnPts} pts`,
      `• RAW_SCORE_SUM: ${scoringData.rawTotal} pts`,
      `• IMPACT_INDEX: Number(((${scoringData.rawTotal} / ${scoringData.maxRaw}) * 100).toFixed(1)) = ${contributor.impactScore}`,
      '',
      `RECORDED_AUDIT_EVENTS: ${scoredEvents.length} entries`,
      '========================================================='
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const commitPct = Math.round((scoringData.commitPts / (scoringData.rawTotal || 1)) * 100);
  const prPct = Math.round((scoringData.prMergedPts / (scoringData.rawTotal || 1)) * 100);
  const reviewPct = Math.round((scoringData.reviewPts / (scoringData.rawTotal || 1)) * 100);
  const issuePct = Math.round((scoringData.issuePts / (scoringData.rawTotal || 1)) * 100);
  const churnPct = Math.max(0, 100 - (commitPct + prPct + reviewPct + issuePct));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog-tactical point-history-dialog with-crosshairs font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hazard-stripe" />

        <div className="point-history-inner">
          {/* Modal Header */}
          <div className="ph-modal-header">
            <div className="ph-header-left">
              <div className="ph-avatar-box">
                <img
                  src={contributor.avatarUrl}
                  alt={contributor.login}
                  className="ph-avatar-img"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.onerror = null;
                    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(contributor.login)}&background=141414&color=fff`;
                  }}
                />
              </div>
              <div className="ph-meta">
                <div className="ph-callsign-row">
                  <span className="ph-callsign">UNIT_#0{contributor.rank} // IMPACT_SCORING_AUDIT</span>
                  <span className="ph-role-badge">[{contributor.role.toUpperCase()}]</span>
                </div>
                <h3 className="macro-title ph-name">{contributor.name}</h3>
                <span className="ph-handle">OPERATIVE_HANDLE: @{contributor.login}</span>
              </div>
            </div>

            <div className="ph-header-actions">
              {onOpenDossier && (
                <button
                  type="button"
                  onClick={() => onOpenDossier(contributor)}
                  className="btn-tactical btn-ph-dossier"
                >
                  [FULL_DOSSIER]
                  <ArrowUpRightIcon size={12} />
                </button>
              )}
              <button type="button" onClick={onClose} className="btn-tactical btn-ph-close">
                [ESC / CLOSE]
              </button>
            </div>
          </div>

          {/* Primary Score Hero Telemetry */}
          <div className="tactical-grid ph-hero-grid">
            <div className="tactical-cell ph-hero-cell hero-impact">
              <span className="telemetry-eyebrow">NORMALIZED_METRIC</span>
              <div className="hero-score-row">
                <span className="macro-title hero-score-val">{contributor.impactScore}</span>
                <span className="hero-denom font-mono">/ 100.0</span>
              </div>
              <span className="ph-subtext">
                IMPACT_IDX COEFFICIENT (RELATIVE TO ORG BENCHMARK)
              </span>
            </div>

            <div className="tactical-cell ph-hero-cell hero-raw">
              <span className="telemetry-eyebrow">RAW_POINTS_ACCUMULATED</span>
              <div className="hero-score-row">
                <span className="macro-title hero-score-val text-radar">
                  {scoringData.rawTotal.toLocaleString()}
                </span>
                <span className="hero-denom font-mono">PTS</span>
              </div>
              <span className="ph-subtext">
                BENCHMARK LEAD: {scoringData.maxRaw.toLocaleString()} PTS (RANK #{contributor.rank})
              </span>
            </div>

            <div className="tactical-cell ph-hero-cell hero-formula">
              <span className="telemetry-eyebrow">ALGORITHM_SPECIFICATION</span>
              <div className="formula-box">
                <code>
                  RAW = (COMMITS×3) + (PRS_MERGED×5) + (REVIEWS×4) + (ISSUES×2) + ROUND(LOC/250)
                </code>
              </div>
              <span className="ph-subtext formula-norm-note">
                INDEX = ((RAW_SCORE / TOP_OPERATIVE_RAW) * 100).toFixed(1)
              </span>
            </div>
          </div>

          {/* Proportional Contribution Bar */}
          <div className="ph-proportion-section">
            <div className="proportion-header font-mono">
              <span>POINT_COMPOSITION_DISTRIBUTION:</span>
              <span className="proportion-legend">
                <span className="dot dot-commits" /> COMMITS ({commitPct}%) &nbsp;
                <span className="dot dot-prs" /> PRS ({prPct}%) &nbsp;
                <span className="dot dot-reviews" /> AUDITS ({reviewPct}%) &nbsp;
                <span className="dot dot-issues" /> ISSUES ({issuePct}%) &nbsp;
                <span className="dot dot-churn" /> LOC ({churnPct}%)
              </span>
            </div>
            <div className="proportion-bar-track">
              <div
                className="proportion-slice slice-commits"
                style={{ width: `${commitPct}%` }}
                title={`Commits: ${scoringData.commitPts} pts (${commitPct}%)`}
              />
              <div
                className="proportion-slice slice-prs"
                style={{ width: `${prPct}%` }}
                title={`Merged PRs: ${scoringData.prMergedPts} pts (${prPct}%)`}
              />
              <div
                className="proportion-slice slice-reviews"
                style={{ width: `${reviewPct}%` }}
                title={`Audits/Reviews: ${scoringData.reviewPts} pts (${reviewPct}%)`}
              />
              <div
                className="proportion-slice slice-issues"
                style={{ width: `${issuePct}%` }}
                title={`Issues: ${scoringData.issuePts} pts (${issuePct}%)`}
              />
              <div
                className="proportion-slice slice-churn"
                style={{ width: `${churnPct}%` }}
                title={`LOC Churn: ${scoringData.churnPts} pts (${churnPct}%)`}
              />
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="ph-tabs-bar">
            <div className="ph-tabs-left">
              <button
                type="button"
                onClick={() => setActiveTab('breakdown')}
                className={`ph-tab-btn ${activeTab === 'breakdown' ? 'active' : ''}`}
              >
                [01 // SCORING_MATRIX]
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className={`ph-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
              >
                [02 // AUDIT_LEDGER_FEED] ({filteredEvents.length} REC // {totalScoredPoints} PTS)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('daily')}
                className={`ph-tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
              >
                [03 // DAILY_ACCUMULATION] ({dailyBreakdown.length} DAYS)
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyAudit}
              className="btn-tactical btn-copy-audit"
              title="Copy point scoring telemetry to clipboard"
            >
              {copied ? (
                <>
                  <CheckIcon size={12} color="var(--accent-radar)" />
                  [AUDIT_COPIED]
                </>
              ) : (
                '[COPY_AUDIT_RECORD]'
              )}
            </button>
          </div>

          {/* TAB 1: POINT SCORING MATRIX */}
          {activeTab === 'breakdown' && (
            <div className="ph-tab-content ph-breakdown-tab">
              <div className="tactical-grid matrix-grid">
                {/* Commits Factor */}
                <div className="tactical-cell factor-card">
                  <div className="factor-top">
                    <div className="factor-icon-wrap icon-commits">
                      <GitCommitIcon size={16} />
                    </div>
                    <span className="factor-weight-tag">+3 PTS / COMMIT</span>
                  </div>
                  <span className="factor-title">GIT_COMMITS</span>
                  <div className="factor-math-row">
                    <span className="factor-calc">
                      {contributor.commitsCount.toLocaleString()} × 3 pts
                    </span>
                    <span className="factor-subtotal">{scoringData.commitPts.toLocaleString()} PTS</span>
                  </div>
                  <div className="factor-progress-track">
                    <div
                      className="factor-progress-bar bar-commits"
                      style={{ width: `${Math.min(100, commitPct)}%` }}
                    />
                  </div>
                  <span className="factor-footnote">
                    CONTRIBUTES {commitPct}% OF OVERALL RAW POINT VOLUME
                  </span>
                </div>

                {/* Merged PRs Factor */}
                <div className="tactical-cell factor-card">
                  <div className="factor-top">
                    <div className="factor-icon-wrap icon-prs">
                      <GitMergeIcon size={16} />
                    </div>
                    <span className="factor-weight-tag">+5 PTS / MERGED_PR</span>
                  </div>
                  <span className="factor-title">MERGED_PULL_REQUESTS</span>
                  <div className="factor-math-row">
                    <span className="factor-calc">
                      {contributor.prsMerged} merged × 5 pts
                    </span>
                    <span className="factor-subtotal">{scoringData.prMergedPts.toLocaleString()} PTS</span>
                  </div>
                  <div className="factor-progress-track">
                    <div
                      className="factor-progress-bar bar-prs"
                      style={{ width: `${Math.min(100, prPct)}%` }}
                    />
                  </div>
                  <span className="factor-footnote">
                    {contributor.prsMerged} OF {contributor.prsCreated} AUTHORED PRS SUCCESSFULLY MERGED
                  </span>
                </div>

                {/* Code Reviews Factor */}
                <div className="tactical-cell factor-card">
                  <div className="factor-top">
                    <div className="factor-icon-wrap icon-reviews">
                      <CodeIcon size={16} />
                    </div>
                    <span className="factor-weight-tag">+4 PTS / PEER_AUDIT</span>
                  </div>
                  <span className="factor-title">PEER_CODE_REVIEWS</span>
                  <div className="factor-math-row">
                    <span className="factor-calc">
                      {contributor.reviewsCount} reviews × 4 pts
                    </span>
                    <span className="factor-subtotal">{scoringData.reviewPts.toLocaleString()} PTS</span>
                  </div>
                  <div className="factor-progress-track">
                    <div
                      className="factor-progress-bar bar-reviews"
                      style={{ width: `${Math.min(100, reviewPct)}%` }}
                    />
                  </div>
                  <span className="factor-footnote">
                    QUALITY ASSURANCE & PEER VERIFICATION ACTIVITY
                  </span>
                </div>

                {/* Issues Logged Factor */}
                <div className="tactical-cell factor-card">
                  <div className="factor-top">
                    <div className="factor-icon-wrap icon-issues">
                      <MessageSquareIcon size={16} />
                    </div>
                    <span className="factor-weight-tag">+2 PTS / ISSUE</span>
                  </div>
                  <span className="factor-title">ISSUES_LOGGED</span>
                  <div className="factor-math-row">
                    <span className="factor-calc">
                      {contributor.issuesCount} issues × 2 pts
                    </span>
                    <span className="factor-subtotal">{scoringData.issuePts.toLocaleString()} PTS</span>
                  </div>
                  <div className="factor-progress-track">
                    <div
                      className="factor-progress-bar bar-issues"
                      style={{ width: `${Math.min(100, issuePct)}%` }}
                    />
                  </div>
                  <span className="factor-footnote">
                    BUG DISCOVERY & TASK SPECIFICATION TRACKING
                  </span>
                </div>

                {/* LOC Churn Factor */}
                <div className="tactical-cell factor-card factor-churn-card">
                  <div className="factor-top">
                    <div className="factor-icon-wrap icon-churn">
                      <GitPullRequestIcon size={16} />
                    </div>
                    <span className="factor-weight-tag">+1 PT / 250 LOC</span>
                  </div>
                  <span className="factor-title">CODE_CHURN_VOLUME</span>
                  <div className="factor-math-row">
                    <span className="factor-calc">
                      +{contributor.linesAdded.toLocaleString()} / -
                      {contributor.linesDeleted.toLocaleString()} LOC
                    </span>
                    <span className="factor-subtotal">{scoringData.churnPts.toLocaleString()} PTS</span>
                  </div>
                  <div className="factor-progress-track">
                    <div
                      className="factor-progress-bar bar-churn"
                      style={{ width: `${Math.min(100, churnPct)}%` }}
                    />
                  </div>
                  <span className="factor-footnote">
                    ROUND({scoringData.totalChurn.toLocaleString()} TOTAL LINES / 250)
                  </span>
                </div>
              </div>

              {/* Formula Audit Summary Box */}
              <div className="tactical-cell calculation-summary-cell with-crosshairs">
                <span className="telemetry-eyebrow">FINAL_AUDIT_SYNTHESIS</span>
                <div className="calculation-formula-breakdown">
                  <div className="calc-term">
                    <span className="ct-num">{scoringData.commitPts}</span>
                    <span className="ct-label">COMMITS</span>
                  </div>
                  <span className="calc-op">+</span>
                  <div className="calc-term">
                    <span className="ct-num">{scoringData.prMergedPts}</span>
                    <span className="ct-label">PRS</span>
                  </div>
                  <span className="calc-op">+</span>
                  <div className="calc-term">
                    <span className="ct-num">{scoringData.reviewPts}</span>
                    <span className="ct-label">AUDITS</span>
                  </div>
                  <span className="calc-op">+</span>
                  <div className="calc-term">
                    <span className="ct-num">{scoringData.issuePts}</span>
                    <span className="ct-label">ISSUES</span>
                  </div>
                  <span className="calc-op">+</span>
                  <div className="calc-term">
                    <span className="ct-num">{scoringData.churnPts}</span>
                    <span className="ct-label">CHURN</span>
                  </div>
                  <span className="calc-op">=</span>
                  <div className="calc-term calc-total">
                    <span className="ct-num text-radar">{scoringData.rawTotal}</span>
                    <span className="ct-label">RAW_TOTAL</span>
                  </div>
                </div>

                <div className="norm-explanation">
                  <span className="norm-step">
                    NORMALIZATION FORMULA: ({scoringData.rawTotal} / {scoringData.maxRaw}) × 100 ={' '}
                    <strong className="text-phosphor">{contributor.impactScore}</strong>
                  </span>
                  <span className="norm-desc">
                    The top operative in the organization establishes the 100.0 baseline index.
                    Every other operative's impact coefficient is proportionally scaled relative to
                    this benchmark.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AUDIT LEDGER FEED */}
          {activeTab === 'ledger' && (
            <div className="ph-tab-content ph-ledger-tab">
              {/* Filter and Search Controls */}
              <div className="ledger-controls font-mono">
                <div className="ledger-filter-buttons">
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`ledger-filter-btn ${filterType === 'all' ? 'active' : ''}`}
                  >
                    ALL_EVENTS
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('commit')}
                    className={`ledger-filter-btn ${filterType === 'commit' ? 'active' : ''}`}
                  >
                    COMMITS [+3]
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('pr_merged')}
                    className={`ledger-filter-btn ${filterType === 'pr_merged' ? 'active' : ''}`}
                  >
                    MERGED_PRS [+5]
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('review')}
                    className={`ledger-filter-btn ${filterType === 'review' ? 'active' : ''}`}
                  >
                    AUDITS [+4]
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('issue')}
                    className={`ledger-filter-btn ${filterType === 'issue' ? 'active' : ''}`}
                  >
                    ISSUES [+2]
                  </button>
                </div>

                <div className="ledger-search-box">
                  <SearchIcon size={12} className="ledger-search-icon" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="SEARCH_LEDGER_RECORDS..."
                    className="tactical-input ledger-input"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="tactical-search-clear"
                    >
                      [X]
                    </button>
                  )}
                </div>
              </div>

              {/* Event Ledger List */}
              {filteredEvents.length === 0 ? (
                <div className="tactical-empty-box with-crosshairs font-mono">
                  <p className="empty-title">[ NO_RECORDS_MATCHING_FILTER ]</p>
                  <p className="empty-desc">
                    NO RECORDED ACTIVITY EVENTS FOUND MATCHING THE SELECTED CRITERIA.
                  </p>
                </div>
              ) : (
                <div className="ledger-list-wrapper">
                  <div className="ledger-table-header font-mono">
                    <span className="col-pts">DELTA</span>
                    <span className="col-date">RECORD_DATE</span>
                    <span className="col-repo">TARGET_REPO</span>
                    <span className="col-event">EVENT_DESCRIPTION</span>
                    <span className="col-run">RUNNING_PTS</span>
                  </div>

                  <div className="ledger-scroll-area">
                    {filteredEvents.map((ev) => (
                      <div key={ev.id} className="ledger-row font-mono">
                        <div className="col-pts">
                          <span
                            className={`pts-badge pts-${ev.type.replace(/[^a-z0-9]/gi, '_')}`}
                          >
                            {ev.pointLabel}
                          </span>
                        </div>
                        <div className="col-date">
                          <span className="text-dim">{ev.canonicalDate || ev.timestamp}</span>
                        </div>
                        <div className="col-repo">
                          <span className="tactical-repo-chip repo-badge">{ev.repo}</span>
                        </div>
                        <div className="col-event">
                          <span className="ev-title">{ev.title}</span>
                          {ev.url && (
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ev-ext-link"
                              title="Inspect GitHub artifact"
                            >
                              <ArrowUpRightIcon size={10} />
                            </a>
                          )}
                        </div>
                        <div className="col-run">
                          <span className="running-badge">{ev.runningTotal} PTS</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DAILY ACCUMULATION TIMELINE */}
          {activeTab === 'daily' && (
            <div className="ph-tab-content ph-daily-tab">
              <div className="daily-stats-summary font-mono">
                <div className="d-stat">
                  <span className="ds-label">ACTIVE_RECORDED_DAYS:</span>
                  <span className="ds-val">{dailyBreakdown.length}</span>
                </div>
                <div className="d-stat">
                  <span className="ds-label">AVG_POINTS_PER_DAY:</span>
                  <span className="ds-val">
                    {(scoringData.rawTotal / (dailyBreakdown.length || 1)).toFixed(1)} PTS
                  </span>
                </div>
                <div className="d-stat">
                  <span className="ds-label">HIGHEST_RECORDED_DAY:</span>
                  <span className="ds-val text-radar">
                    {Math.max(...dailyBreakdown.map((d) => d.points), 0)} PTS
                  </span>
                </div>
              </div>

              <div className="daily-table-wrapper font-mono">
                <table className="daily-table">
                  <thead>
                    <tr>
                      <th>RECORD_DATE</th>
                      <th>COMMITS (+3)</th>
                      <th>MERGED_PRS (+5)</th>
                      <th>AUDITS (+4)</th>
                      <th>ISSUES (+2)</th>
                      <th>DAILY_POINTS</th>
                      <th>DISTRIBUTION_DENSITY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyBreakdown.map((d) => {
                      const maxDay = Math.max(...dailyBreakdown.map((x) => x.points), 1);
                      const barPct = Math.min(100, Math.round((d.points / maxDay) * 100));

                      return (
                        <tr key={d.date} className="daily-row">
                          <td className="daily-date">{d.date}</td>
                          <td className="daily-metric">{d.commits}</td>
                          <td className="daily-metric">{d.prsMerged}</td>
                          <td className="daily-metric">{d.reviews}</td>
                          <td className="daily-metric">{d.issues}</td>
                          <td className="daily-pts">
                            <span className="text-radar font-bold">+{d.points} PTS</span>
                          </td>
                          <td className="daily-bar-cell">
                            <div className="mini-bar-track">
                              <div className="mini-bar-fill" style={{ width: `${barPct}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="ph-modal-footer font-mono">
            <span className="ph-footer-serial">
              AUDIT_HASH // #{contributor.login.toUpperCase()}_{contributor.commitsCount}_REC
            </span>
            <div className="ph-footer-buttons">
              {onOpenDossier && (
                <button
                  type="button"
                  onClick={() => onOpenDossier(contributor)}
                  className="btn-tactical"
                >
                  [INSPECT_FULL_PERSONNEL_DOSSIER]
                </button>
              )}
              <button type="button" onClick={onClose} className="btn-tactical btn-tactical-hazard">
                [CLOSE_TERMINAL]
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .point-history-dialog {
          max-width: 980px;
          width: 95%;
          background: var(--bg-panel);
          border: 1px solid var(--border-bright);
        }
        .point-history-inner {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* Header */
        .ph-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid var(--border-tactical);
          flex-wrap: wrap;
        }
        .ph-header-left {
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }
        .ph-avatar-box {
          width: 56px;
          height: 56px;
          border: 1px solid var(--border-bright);
          background: #000;
          overflow: hidden;
          flex-shrink: 0;
        }
        .ph-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: grayscale(20%);
        }
        .ph-meta {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .ph-callsign-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.68rem;
          color: var(--text-ghost);
        }
        .ph-callsign {
          color: var(--accent-hazard);
          font-weight: 700;
        }
        .ph-role-badge {
          color: var(--accent-radar);
        }
        .ph-name {
          font-size: 1.5rem;
          color: var(--text-phosphor);
          line-height: 1.1;
        }
        .ph-handle {
          font-size: 0.75rem;
          color: var(--text-dim);
        }
        .ph-header-actions {
          display: flex;
          gap: 0.5rem;
        }

        /* Hero Telemetry Grid */
        .ph-hero-grid {
          grid-template-columns: repeat(3, 1fr);
        }
        @media (max-width: 820px) {
          .ph-hero-grid {
            grid-template-columns: 1fr;
          }
        }
        .ph-hero-cell {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .hero-score-row {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
        }
        .hero-score-val {
          font-size: 2.25rem;
          color: var(--text-phosphor);
          line-height: 1;
        }
        .text-radar {
          color: var(--accent-radar);
        }
        .hero-denom {
          font-size: 0.85rem;
          color: var(--text-ghost);
        }
        .ph-subtext {
          font-size: 0.65rem;
          color: var(--text-dim);
          line-height: 1.3;
        }
        .formula-box {
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 0.5rem;
          font-size: 0.65rem;
          color: var(--text-phosphor);
          overflow-x: auto;
          white-space: nowrap;
        }
        .formula-norm-note {
          color: var(--text-ghost);
          font-size: 0.62rem;
        }

        /* Proportion Bar */
        .ph-proportion-section {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          background: var(--bg-cell);
          border: 1px solid var(--border-tactical);
          padding: 0.75rem 1rem;
        }
        .proportion-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.68rem;
          color: var(--text-dim);
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .proportion-legend {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.65rem;
          flex-wrap: wrap;
        }
        .dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          margin-right: 2px;
        }
        .dot-commits { background: #4af626; }
        .dot-prs { background: #38bdf8; }
        .dot-reviews { background: #facc15; }
        .dot-issues { background: #f43f5e; }
        .dot-churn { background: #a855f7; }

        .proportion-bar-track {
          width: 100%;
          height: 8px;
          background: #1a1a1a;
          display: flex;
          overflow: hidden;
        }
        .proportion-slice {
          height: 100%;
        }
        .slice-commits { background: #4af626; }
        .slice-prs { background: #38bdf8; }
        .slice-reviews { background: #facc15; }
        .slice-issues { background: #f43f5e; }
        .slice-churn { background: #a855f7; }

        /* Navigation Tabs */
        .ph-tabs-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid var(--border-tactical);
          padding-bottom: 0.5rem;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .ph-tabs-left {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .ph-tab-btn {
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          color: var(--text-dim);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.5rem 0.85rem;
          cursor: pointer;
        }
        .ph-tab-btn.active {
          background: var(--text-phosphor);
          color: var(--bg-crt);
          border-color: var(--text-phosphor);
        }
        .btn-copy-audit {
          font-size: 0.7rem;
          padding: 0.45rem 0.75rem;
        }

        /* Matrix Tab */
        .matrix-grid {
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        }
        .factor-card {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .factor-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .factor-icon-wrap {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
        }
        .icon-commits { color: #4af626; }
        .icon-prs { color: #38bdf8; }
        .icon-reviews { color: #facc15; }
        .icon-issues { color: #f43f5e; }
        .icon-churn { color: #a855f7; }

        .factor-weight-tag {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-phosphor);
          background: var(--bg-crt);
          padding: 2px 6px;
          border: 1px solid var(--border-tactical);
        }
        .factor-title {
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: var(--text-phosphor);
        }
        .factor-math-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-size: 0.75rem;
        }
        .factor-calc {
          color: var(--text-ghost);
        }
        .factor-subtotal {
          font-weight: 700;
          color: var(--text-phosphor);
          font-size: 0.95rem;
        }
        .factor-progress-track {
          width: 100%;
          height: 4px;
          background: #222;
        }
        .factor-progress-bar {
          height: 100%;
        }
        .bar-commits { background: #4af626; }
        .bar-prs { background: #38bdf8; }
        .bar-reviews { background: #facc15; }
        .bar-issues { background: #f43f5e; }
        .bar-churn { background: #a855f7; }
        .factor-footnote {
          font-size: 0.62rem;
          color: var(--text-ghost);
          line-height: 1.3;
        }

        /* Calculation Summary Cell */
        .calculation-summary-cell {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          background: var(--bg-cell);
        }
        .calculation-formula-breakdown {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          padding: 0.75rem;
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
        }
        .calc-term {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
        }
        .ct-num {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-phosphor);
        }
        .ct-label {
          font-size: 0.6rem;
          color: var(--text-ghost);
        }
        .calc-op {
          font-size: 1.1rem;
          color: var(--text-ghost);
          font-weight: 700;
        }
        .calc-total {
          border-left: 2px solid var(--border-bright);
          padding-left: 0.75rem;
        }
        .norm-explanation {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          font-size: 0.72rem;
          line-height: 1.4;
        }
        .norm-step {
          color: var(--text-phosphor);
        }
        .norm-desc {
          color: var(--text-ghost);
          font-size: 0.68rem;
        }

        /* Ledger Tab */
        .ledger-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
        }
        .ledger-filter-buttons {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }
        .ledger-filter-btn {
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          color: var(--text-dim);
          font-family: var(--font-mono);
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.35rem 0.55rem;
          cursor: pointer;
        }
        .ledger-filter-btn.active {
          background: var(--text-phosphor);
          color: var(--bg-crt);
          border-color: var(--text-phosphor);
        }
        .ledger-search-box {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 0.25rem 0.5rem;
          min-width: 220px;
        }
        .ledger-search-icon {
          color: var(--text-ghost);
        }
        .ledger-input {
          font-size: 0.7rem;
        }

        .ledger-list-wrapper {
          border: 1px solid var(--border-tactical);
          background: var(--bg-panel);
        }
        .ledger-table-header {
          display: grid;
          grid-template-columns: 90px 100px 130px 1fr 100px;
          gap: 0.75rem;
          padding: 0.6rem 0.85rem;
          background: var(--bg-crt);
          border-bottom: 2px solid var(--border-tactical);
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--text-ghost);
        }
        .ledger-scroll-area {
          max-height: 380px;
          overflow-y: auto;
        }
        .ledger-row {
          display: grid;
          grid-template-columns: 90px 100px 130px 1fr 100px;
          gap: 0.75rem;
          padding: 0.55rem 0.85rem;
          align-items: center;
          font-size: 0.72rem;
          border-bottom: 1px solid var(--border-tactical);
        }
        .ledger-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .pts-badge {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 6px;
          border: 1px solid;
          white-space: nowrap;
        }
        .pts-commit {
          color: #4af626;
          border-color: rgba(74, 246, 38, 0.4);
          background: rgba(74, 246, 38, 0.1);
        }
        .pts-pr_merged {
          color: #38bdf8;
          border-color: rgba(56, 189, 248, 0.4);
          background: rgba(56, 189, 248, 0.1);
        }
        .pts-review {
          color: #facc15;
          border-color: rgba(250, 204, 21, 0.4);
          background: rgba(250, 204, 21, 0.1);
        }
        .pts-issue {
          color: #f43f5e;
          border-color: rgba(244, 63, 94, 0.4);
          background: rgba(244, 63, 94, 0.1);
        }
        .pts-pr_opened {
          color: var(--text-ghost);
          border-color: var(--border-tactical);
        }
        .repo-badge {
          font-size: 0.65rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }
        .col-event {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          overflow: hidden;
        }
        .ev-title {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--text-phosphor);
        }
        .ev-ext-link {
          color: var(--accent-radar);
          display: inline-flex;
          flex-shrink: 0;
        }
        .running-badge {
          color: var(--text-ghost);
          font-size: 0.68rem;
        }

        @media (max-width: 720px) {
          .ledger-table-header {
            display: none;
          }
          .ledger-row {
            grid-template-columns: 1fr;
            gap: 0.35rem;
            padding: 0.75rem;
          }
        }

        /* Daily Tab */
        .daily-stats-summary {
          display: flex;
          gap: 1.5rem;
          background: var(--bg-cell);
          border: 1px solid var(--border-tactical);
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }
        .d-stat {
          display: flex;
          gap: 0.5rem;
          font-size: 0.72rem;
        }
        .ds-label {
          color: var(--text-ghost);
        }
        .ds-val {
          font-weight: 700;
          color: var(--text-phosphor);
        }
        .daily-table-wrapper {
          border: 1px solid var(--border-tactical);
          background: var(--bg-panel);
          max-height: 400px;
          overflow-y: auto;
        }
        .daily-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.72rem;
          text-align: left;
        }
        .daily-table th {
          background: var(--bg-crt);
          padding: 0.65rem 0.85rem;
          color: var(--text-ghost);
          font-size: 0.68rem;
          border-bottom: 2px solid var(--border-tactical);
        }
        .daily-row td {
          padding: 0.55rem 0.85rem;
          border-bottom: 1px solid var(--border-tactical);
        }
        .daily-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .daily-bar-cell {
          width: 180px;
        }
        .mini-bar-track {
          width: 100%;
          height: 6px;
          background: #1e1e1e;
        }
        .mini-bar-fill {
          height: 100%;
          background: var(--accent-radar);
        }

        /* Footer */
        .ph-modal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 1rem;
          border-top: 1px solid var(--border-tactical);
          gap: 1rem;
          flex-wrap: wrap;
        }
        .ph-footer-serial {
          font-size: 0.65rem;
          color: var(--text-ghost);
        }
        .ph-footer-buttons {
          display: flex;
          gap: 0.5rem;
        }
      `}</style>
    </div>
  );
};
