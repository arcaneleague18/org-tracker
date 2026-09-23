import React, { useState, useEffect, useMemo } from 'react';
import { ContributorStats, ActivityEvent } from '../types';
import { ArrowUpRightIcon } from './Icons';

interface ContributorDetailModalProps {
  contributor: ContributorStats | null;
  onClose: () => void;
}

interface CalendarDay {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  month: number; // 0 to 11
  monthName: string;
  dayOfMonth: number;
  commits: number;
  prs: number;
  reviews: number;
  total: number;
  isFuture: boolean;
}

interface CalendarWeek {
  weekIndex: number;
  days: CalendarDay[];
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const ContributorDetailModal: React.FC<ContributorDetailModalProps> = ({
  contributor,
  onClose
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<CalendarDay | null>(null);

  useEffect(() => {
    setSelectedDate(null);
    setHoveredDay(null);
  }, [contributor?.login]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
      const parts = event.timestamp.split(/[/.-]/).map(Number);
      if (parts.length === 3) {
        if (parts[0] > 12) {
          return `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
        } else {
          return `${parts[2]}-${String(parts[0]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}`;
        }
      }
    }
    return '';
  };

  const formatDisplayDate = (canonicalDate: string): string => {
    if (!canonicalDate) return '';
    const parts = canonicalDate.split('-').map(Number);
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      if (!isNaN(d.getTime())) {
        return `${parts[1]}/${parts[2]}/${parts[0]}`;
      }
    }
    return canonicalDate;
  };

  const formatTooltipDate = (canonicalDate: string): string => {
    if (!canonicalDate) return '';
    const parts = canonicalDate.split('-').map(Number);
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    }
    return canonicalDate;
  };

  // Build full 53-week timeline for this contributor
  const {
    weeksList,
    monthLabels,
    totalTimelineCommits,
    totalTimelinePrs,
    totalTimelineReviews,
    totalTimelineEvents,
    maxTimelineDaily,
    currentStreak,
    maxStreak
  } = useMemo(() => {
    if (!contributor) {
      return {
        weeksList: [],
        monthLabels: [],
        totalTimelineCommits: 0,
        totalTimelinePrs: 0,
        totalTimelineReviews: 0,
        totalTimelineEvents: 0,
        maxTimelineDaily: 1,
        currentStreak: 0,
        maxStreak: 0
      };
    }

    const dailyMap = new Map<string, { commits: number; prs: number; reviews: number; total: number }>();

    // 1. Process recentActivity events
    if (contributor.recentActivity) {
      for (const event of contributor.recentActivity) {
        const cDate = getEventCanonicalDate(event);
        if (cDate) {
          if (!dailyMap.has(cDate)) {
            dailyMap.set(cDate, { commits: 0, prs: 0, reviews: 0, total: 0 });
          }
          const entry = dailyMap.get(cDate)!;
          if (event.type === 'commit') {
            entry.commits++;
          } else if (event.type === 'pr_merged' || event.type === 'pr_opened') {
            entry.prs++;
          } else if (event.type === 'review') {
            entry.reviews++;
          }
          entry.total++;
        }
      }
    }

    // 2. Incorporate activityByDate aggregate record
    if (contributor.activityByDate) {
      for (const [dateStr, count] of Object.entries(contributor.activityByDate)) {
        if (!dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, { commits: count, prs: 0, reviews: 0, total: count });
        } else {
          const entry = dailyMap.get(dateStr)!;
          if (count > entry.total) {
            const diff = count - entry.total;
            entry.commits += diff;
            entry.total = count;
          }
        }
      }
    }

    // 3. Incorporate punchcard dates if available
    if (contributor.punchcard) {
      for (const slot of contributor.punchcard) {
        if (slot.dates) {
          for (const d of slot.dates) {
            if (!dailyMap.has(d)) {
              dailyMap.set(d, { commits: 1, prs: 0, reviews: 0, total: 1 });
            }
          }
        }
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDate(today);

    const currentDayOfWeek = today.getDay();
    const currentSunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - currentDayOfWeek);

    const totalWeeks = 53;
    const startSunday = new Date(currentSunday.getFullYear(), currentSunday.getMonth(), currentSunday.getDate() - (totalWeeks - 1) * 7);

    let commitsCount = 0;
    let prsCount = 0;
    let reviewsCount = 0;
    let totalEventsCount = 0;
    let maxDaily = 0;

    const weeks: CalendarWeek[] = [];

    for (let w = 0; w < totalWeeks; w++) {
      const days: CalendarDay[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(startSunday.getFullYear(), startSunday.getMonth(), startSunday.getDate() + w * 7 + d);
        const dateStr = formatDate(cellDate);
        const isFuture = dateStr > todayStr;

        const p = dailyMap.get(dateStr);
        const commits = p?.commits || 0;
        const prs = p?.prs || 0;
        const reviews = p?.reviews || 0;
        const total = p?.total || 0;

        if (!isFuture) {
          commitsCount += commits;
          prsCount += prs;
          reviewsCount += reviews;
          totalEventsCount += total;
          if (total > maxDaily) {
            maxDaily = total;
          }
        }

        days.push({
          date: dateStr,
          dayOfWeek: d,
          month: cellDate.getMonth(),
          monthName: cellDate.toLocaleString('en-US', { month: 'short' }),
          dayOfMonth: cellDate.getDate(),
          commits,
          prs,
          reviews,
          total,
          isFuture
        });
      }
      weeks.push({ weekIndex: w, days });
    }

    // Identify month labels
    const labels: { label: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    let lastLabeledWeek = -99;

    weeks.forEach((week, wIdx) => {
      const month = week.days[0].month;
      if (month !== lastMonth && wIdx - lastLabeledWeek >= 2) {
        labels.push({
          label: week.days[0].monthName,
          weekIndex: wIdx
        });
        lastMonth = month;
        lastLabeledWeek = wIdx;
      }
    });

    // Calculate streaks
    const chronologicalDays: CalendarDay[] = [];
    for (const w of weeks) {
      for (const d of w.days) {
        if (!d.isFuture) {
          chronologicalDays.push(d);
        }
      }
    }

    let maxStrk = 0;
    let runningStrk = 0;
    for (const day of chronologicalDays) {
      if (day.total > 0) {
        runningStrk++;
        if (runningStrk > maxStrk) {
          maxStrk = runningStrk;
        }
      } else {
        runningStrk = 0;
      }
    }

    let curStrk = 0;
    const n = chronologicalDays.length;
    if (n > 0) {
      const todayDay = chronologicalDays[n - 1];
      const yesterdayDay = n >= 2 ? chronologicalDays[n - 2] : null;

      let startIdx = -1;
      if (todayDay.total > 0) {
        startIdx = n - 1;
      } else if (yesterdayDay && yesterdayDay.total > 0) {
        startIdx = n - 2;
      }

      if (startIdx >= 0) {
        for (let i = startIdx; i >= 0; i--) {
          if (chronologicalDays[i].total > 0) {
            curStrk++;
          } else {
            break;
          }
        }
      }
    }

    return {
      weeksList: weeks,
      monthLabels: labels,
      totalTimelineCommits: commitsCount,
      totalTimelinePrs: prsCount,
      totalTimelineReviews: reviewsCount,
      totalTimelineEvents: totalEventsCount,
      maxTimelineDaily: maxDaily > 0 ? maxDaily : 1,
      currentStreak: curStrk,
      maxStreak: maxStrk
    };
  }, [contributor]);

  const getIntensityClass = (total: number) => {
    if (total === 0) return 'cell-l0';
    if (maxTimelineDaily <= 4) {
      if (total === 1) return 'cell-l1';
      if (total === 2) return 'cell-l2';
      if (total === 3) return 'cell-l3';
      return 'cell-l4';
    }
    const ratio = total / maxTimelineDaily;
    if (ratio <= 0.25) return 'cell-l1';
    if (ratio <= 0.5) return 'cell-l2';
    if (ratio <= 0.75) return 'cell-l3';
    return 'cell-l4';
  };

  if (!contributor) return null;

  const totalRepoCommits = contributor.repositories.reduce((acc, r) => acc + r.commits, 0) || 1;

  const filteredEvents = selectedDate
    ? contributor.recentActivity.filter(
        (event) => getEventCanonicalDate(event) === selectedDate
      )
    : contributor.recentActivity;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog-tactical with-crosshairs font-mono" onClick={(e) => e.stopPropagation()}>
        <div className="hazard-stripe" />
        <div className="modal-inner-padding">
          {/* Header */}
          <div className="dossier-modal-header">
            <div className="dossier-identity-left">
              <div className="dossier-avatar-container">
                <img
                  src={contributor.avatarUrl}
                  alt={contributor.login}
                  className="dossier-avatar-img"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.onerror = null;
                    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(contributor.login)}&background=141414&color=fff`;
                  }}
                />
              </div>
              <div className="dossier-titles">
                <div className="dossier-rank-badge">
                  [ UNIT_RANK_#0{contributor.rank} // CLEARANCE: {contributor.role.toUpperCase()} ]
                </div>
                <h3 className="macro-title dossier-person-name">{contributor.name}</h3>
                <div className="dossier-links-row">
                  <span className="dossier-handle">HANDLE: @{contributor.login}</span>
                  <span className="sep-slash">/</span>
                  <a
                    href={contributor.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dossier-ext-link"
                  >
                    [GH_PROFILE_URL]
                    <ArrowUpRightIcon size={10} />
                  </a>
                </div>
              </div>
            </div>

            <button type="button" onClick={onClose} className="btn-tactical btn-close-modal">
              [ESC / CLOSE]
            </button>
          </div>

          {/* 4-Column Telemetry Module Grid */}
          <div className="tactical-grid dossier-metrics-grid">
            <div className="tactical-cell metric-cell">
              <span className="dm-label">TOTAL_COMMITS</span>
              <span className="macro-title dm-val">{contributor.commitsCount}</span>
              <span className="dm-sub">ACROSS {contributor.repositories.length} REPOSITORIES</span>
            </div>
            <div className="tactical-cell metric-cell">
              <span className="dm-label">PRS_MERGED</span>
              <span className="macro-title dm-val">{contributor.prsMerged}</span>
              <span className="dm-sub">OUT OF {contributor.prsCreated} AUTHORED</span>
            </div>
            <div className="tactical-cell metric-cell">
              <span className="dm-label">CODE_REVIEWS</span>
              <span className="macro-title dm-val">{contributor.reviewsCount}</span>
              <span className="dm-sub">AUDIT_PARTICIPATION</span>
            </div>
            <div className="tactical-cell metric-cell">
              <span className="dm-label">LOC_CHURN_DELTA</span>
              <div className="dm-churn-row">
                <span className="churn-add">+{contributor.linesAdded.toLocaleString()}</span>
                <span className="churn-del">-{contributor.linesDeleted.toLocaleString()}</span>
              </div>
              <span className="dm-sub">{contributor.activeDays} ACTIVE RECORDED DAYS</span>
            </div>
          </div>

          {/* Repository Footprint */}
          <div className="dossier-section">
            <div className="section-title-strip">
              <span>// REPOSITORY_FOOTPRINT_ALLOCATION</span>
            </div>
            <div className="repo-footprint-table">
              {contributor.repositories.map((repo) => {
                const pct = Math.round((repo.commits / totalRepoCommits) * 100);
                return (
                  <div key={repo.name} className="footprint-row">
                    <div className="footprint-meta">
                      <span className="footprint-repo-name">{repo.name}</span>
                      <span className="footprint-counts">
                        {repo.commits} COMMITS ({pct}%) // {repo.prs} PRS
                      </span>
                    </div>
                    <div className="footprint-track">
                      <div className="footprint-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full Annual Contribution Timeline */}
          <div className="dossier-section">
            <div className="section-title-strip flex-between">
              <div className="timeline-title-left">
                <span>// FULL_ANNUAL_CONTRIBUTION_TIMELINE [53_WEEK_CADENCE // GITHUB_STANDARD]</span>
                {selectedDate && (
                  <span className="timeline-filter-indicator font-mono">
                    [FILTER: {formatDisplayDate(selectedDate)}]
                  </span>
                )}
              </div>

              {/* Contributor Telemetry Stat Pills */}
              <div className="dossier-timeline-pills font-mono">
                <div
                  className={`telemetry-data-block ${currentStreak > 0 ? 'telemetry-data-block-active' : ''}`}
                  title={`Current active contribution streak: ${currentStreak} days | Longest: ${maxStreak} days`}
                >
                  <span className="tdb-key">CURRENT_STREAK:</span>
                  <span
                    className="tdb-val"
                    style={{ color: currentStreak > 0 ? 'var(--accent-radar)' : undefined }}
                  >
                    {currentStreak} {currentStreak === 1 ? 'DAY' : 'DAYS'}
                  </span>
                </div>
                <div
                  className="telemetry-data-block"
                  title={`Longest consecutive contribution streak in the 53-week timeline: ${maxStreak} days`}
                >
                  <span className="tdb-key">MAX_STREAK:</span>
                  <span className="tdb-val">
                    {maxStreak} {maxStreak === 1 ? 'DAY' : 'DAYS'}
                  </span>
                </div>
                <div className="telemetry-data-block">
                  <span className="tdb-key">COMMITS:</span>
                  <span className="tdb-val">{totalTimelineCommits}</span>
                </div>
                <div className="telemetry-data-block">
                  <span className="tdb-key">PRS:</span>
                  <span className="tdb-val">{totalTimelinePrs}</span>
                </div>
                <div className="telemetry-data-block">
                  <span className="tdb-key">REVIEWS:</span>
                  <span className="tdb-val">{totalTimelineReviews}</span>
                </div>
                <div className="telemetry-data-block">
                  <span className="tdb-key">TOTAL_BURST:</span>
                  <span className="tdb-val">{totalTimelineEvents}</span>
                </div>
              </div>
            </div>

            <div className="dossier-timeline-console">
              {/* Scrollable 53-week Canvas */}
              <div className="dossier-timeline-scroll">
                <div className="dossier-timeline-inner">
                  {/* Months Header Track */}
                  <div className="months-header-row">
                    <div className="weekday-spacer" />
                    <div className="months-track">
                      {monthLabels.map((m, idx) => (
                        <span
                          key={idx}
                          className="month-label font-mono"
                          style={{ left: `${m.weekIndex * 14}px` }}
                        >
                          {m.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Main Matrix: Weekday Labels + 53 Columns */}
                  <div className="matrix-body-row">
                    <div className="weekday-labels-col font-mono">
                      <span className="weekday-label"></span>
                      <span className="weekday-label">Mon</span>
                      <span className="weekday-label"></span>
                      <span className="weekday-label">Wed</span>
                      <span className="weekday-label"></span>
                      <span className="weekday-label">Fri</span>
                      <span className="weekday-label"></span>
                    </div>

                    <div className="weeks-container">
                      {weeksList.map((week) => (
                        <div key={week.weekIndex} className="week-column">
                          {week.days.map((day) => {
                            const isCellSelected = selectedDate === day.date;
                            return (
                              <div
                                key={day.date}
                                className={`matrix-cell ${day.isFuture ? 'cell-future' : getIntensityClass(day.total)} ${
                                  isCellSelected ? 'cell-date-selected' : ''
                                } ${hoveredDay?.date === day.date ? 'cell-active' : ''}`}
                                title={
                                  day.isFuture
                                    ? ''
                                    : `${day.total} contribution${day.total === 1 ? '' : 's'} on ${formatTooltipDate(day.date)}${
                                        day.total > 0
                                          ? ` (${day.commits} commits, ${day.prs} PRs, ${day.reviews} reviews)`
                                          : ''
                                      } // CLICK TO FILTER AUDIT LOG`
                                }
                                onClick={() => {
                                  if (day.isFuture) return;
                                  setSelectedDate(selectedDate === day.date ? null : day.date);
                                }}
                                onMouseEnter={() => !day.isFuture && setHoveredDay(day)}
                                onMouseLeave={() => setHoveredDay(null)}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Telemetry HUD readout on hover / idle / filter */}
              <div className="timeline-telemetry-hud font-mono">
                {hoveredDay ? (
                  <div className="hud-content">
                    <span className="hud-coord">COORD_DATE: [{formatDisplayDate(hoveredDay.date)}]</span>
                    <span className="hud-sep">///</span>
                    <span className="hud-event">COMMITS: {hoveredDay.commits}</span>
                    <span className="hud-sep">/</span>
                    <span className="hud-event">PRS: {hoveredDay.prs}</span>
                    <span className="hud-sep">/</span>
                    <span className="hud-event">REVIEWS: {hoveredDay.reviews}</span>
                    <span className="hud-sep">///</span>
                    <span className="hud-total">TOTAL_BURST: {hoveredDay.total} EVENT{hoveredDay.total === 1 ? '' : 'S'}</span>
                    {hoveredDay.total > 0 && <span className="hud-hint">/// CLICK CELL TO FILTER LOG</span>}
                  </div>
                ) : selectedDate ? (
                  <div className="hud-content">
                    <span className="hud-label">FILTERED_DATE:</span>
                    <span className="hud-date-pill">[{formatDisplayDate(selectedDate)}]</span>
                    <span className="hud-sep">///</span>
                    <span className="hud-hint">CLICK CELL AGAIN OR [ALL] TO RESET FILTER</span>
                  </div>
                ) : (
                  <div className="hud-content hud-idle">
                    <span>// HOVER OVER ANY CELL TO RETRIEVE TELEMETRY PAYLOAD // CLICK CELL TO FILTER AUDIT LOG</span>
                    {currentStreak > 0 && (
                      <span style={{ color: 'var(--accent-radar)', marginLeft: '0.75rem' }}>
                        /// ACTIVE_STREAK: {currentStreak} {currentStreak === 1 ? 'DAY' : 'DAYS'} (RECORD: {maxStreak})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Calibration Footer: Standard / Legend */}
              <div className="timeline-footer-row">
                <span className="matrix-footer-note font-mono">
                  [ CADENCE: 365_DAY_TEMPORAL_MATRIX // GITHUB_STANDARD ]
                </span>
                <div className="matrix-calibration font-mono">
                  <span className="scale-label">Less</span>
                  <span className="scale-cell cell-l0" title="0 contributions"></span>
                  <span className="scale-cell cell-l1" title="Low activity"></span>
                  <span className="scale-cell cell-l2" title="Medium-low activity"></span>
                  <span className="scale-cell cell-l3" title="Medium-high activity"></span>
                  <span className="scale-cell cell-l4" title="High activity"></span>
                  <span className="scale-label">More</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Chronological Audit Log */}
          <div className="dossier-section">
            <div className="section-title-strip action-log-header-strip">
              <div className="action-log-header-left">
                <span>// CHRONOLOGICAL_ACTION_LOG</span>
                {selectedDate && (
                  <span className="action-log-filter-tag font-mono">
                    [DATE: {formatDisplayDate(selectedDate)} // {filteredEvents.length} EVENT{filteredEvents.length === 1 ? '' : 'S'}]
                  </span>
                )}
              </div>
              <div className="action-log-header-right">
                <button
                  type="button"
                  className={`btn-tactical btn-action-all ${selectedDate === null ? 'active' : ''}`}
                  onClick={() => setSelectedDate(null)}
                  title="VIEW ALL CONTRIBUTIONS"
                >
                  [ALL]
                </button>
              </div>
            </div>
            <div className="action-log-stream">
              {filteredEvents.length === 0 ? (
                <p className="no-events-prompt">
                  {selectedDate
                    ? `[ ZERO RECORDED ACTIONS ON ${formatDisplayDate(selectedDate)} ]`
                    : '[ NO RECORDED ACTIONS IN CURRENT WINDOW ]'}
                </p>
              ) : (
                filteredEvents.map((event) => (
                  <div key={event.id} className="log-item">
                    <span className="log-type-tag">
                      [{event.type.toUpperCase()}]
                    </span>
                    <span className="log-desc">{event.title}</span>
                    <span className="log-repo">@{event.repo}</span>
                    <span className="log-time">{event.timestamp}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .modal-inner-padding {
          padding: 1.5rem 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .dossier-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-tactical);
          padding-bottom: 1.25rem;
        }
        .dossier-identity-left {
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }
        .dossier-avatar-container {
          width: 3.5rem;
          height: 3.5rem;
          border: 1px solid var(--border-bright);
          background: #000;
        }
        .dossier-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .dossier-titles {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .dossier-rank-badge {
          font-size: 0.65rem;
          color: var(--accent-hazard);
          font-weight: 700;
        }
        .dossier-person-name {
          font-size: 1.35rem;
          color: var(--text-phosphor);
          line-height: 1;
        }
        .dossier-links-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.72rem;
          color: var(--text-dim);
        }
        .sep-slash {
          color: var(--text-ghost);
        }
        .dossier-ext-link {
          color: var(--text-phosphor);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }
        .dossier-ext-link:hover {
          color: var(--accent-hazard);
        }
        .btn-close-modal {
          font-size: 0.7rem;
        }
        .dossier-metrics-grid {
          grid-template-columns: repeat(4, 1fr);
        }
        .metric-cell {
          padding: 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .dm-label {
          font-size: 0.6rem;
          color: var(--text-dim);
        }
        .dm-val {
          font-size: 1.6rem;
          color: var(--text-phosphor);
        }
        .dm-sub {
          font-size: 0.6rem;
          color: var(--text-ghost);
        }
        .dm-churn-row {
          display: flex;
          gap: 0.5rem;
          font-size: 0.85rem;
          font-weight: 700;
        }
        .churn-add { color: var(--accent-radar); }
        .churn-del { color: var(--accent-hazard); }

        .dossier-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .section-title-strip {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--text-dim);
          border-bottom: 1px solid var(--border-tactical);
          padding-bottom: 0.35rem;
        }
        .flex-between {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .punchcard-filter-indicator {
          color: var(--accent-radar);
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.04em;
        }
        .repo-footprint-table {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 1rem;
        }
        .footprint-row {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .footprint-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.72rem;
        }
        .footprint-repo-name {
          color: var(--text-phosphor);
          font-weight: 700;
        }
        .footprint-counts {
          color: var(--text-dim);
        }
        .footprint-track {
          width: 100%;
          height: 4px;
          background: #222;
        }
        .footprint-fill {
          height: 100%;
          background: var(--text-phosphor);
        }

        .dossier-timeline-pills {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .telemetry-data-block {
          background: var(--bg-crt);
          border: 1px solid var(--border-bright);
          padding: 0.25rem 0.55rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.65rem;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          box-sizing: border-box;
          max-width: 100%;
        }
        .telemetry-data-block-active {
          border-color: var(--accent-radar);
          box-shadow: 0 0 6px var(--accent-radar-dim);
        }
        .tdb-key {
          color: var(--text-dim);
        }
        .tdb-val {
          color: var(--text-phosphor);
          font-weight: 700;
        }
        .timeline-filter-indicator {
          color: var(--accent-radar);
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          margin-left: 0.5rem;
        }
        .dossier-timeline-console {
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          box-sizing: border-box;
        }
        .dossier-timeline-scroll {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 0.4rem;
          scrollbar-width: thin;
          scrollbar-color: var(--border-bright) transparent;
        }
        .dossier-timeline-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .dossier-timeline-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .dossier-timeline-scroll::-webkit-scrollbar-thumb {
          background: var(--border-bright);
        }
        .dossier-timeline-inner {
          display: inline-flex;
          flex-direction: column;
          min-width: 775px;
        }
        .months-header-row {
          display: flex;
          align-items: center;
          height: 18px;
          margin-bottom: 4px;
        }
        .weekday-spacer {
          width: 28px;
          flex-shrink: 0;
        }
        .months-track {
          position: relative;
          height: 18px;
          flex-grow: 1;
        }
        .month-label {
          position: absolute;
          font-size: 10px;
          color: var(--text-dim);
          user-select: none;
          top: 0;
          white-space: nowrap;
        }
        .matrix-body-row {
          display: flex;
          align-items: flex-start;
        }
        .weekday-labels-col {
          display: flex;
          flex-direction: column;
          gap: 3px;
          width: 28px;
          flex-shrink: 0;
          user-select: none;
        }
        .weekday-label {
          height: 11px;
          line-height: 11px;
          font-size: 9px;
          color: var(--text-ghost);
          text-align: left;
          padding-right: 4px;
        }
        .weeks-container {
          display: flex;
          gap: 3px;
          flex-grow: 1;
        }
        .week-column {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .matrix-cell {
          width: 11px;
          height: 11px;
          border-radius: 2px !important;
          cursor: pointer;
          transition: transform 0.05s ease;
          box-sizing: border-box;
        }
        .matrix-cell:hover,
        .cell-active {
          outline: 1.5px solid #ffffff;
          z-index: 10;
          transform: scale(1.15);
        }
        .cell-date-selected {
          outline: 2px solid var(--accent-radar) !important;
          box-shadow: 0 0 8px var(--accent-radar) !important;
          z-index: 11;
          transform: scale(1.18);
        }
        .cell-future {
          visibility: hidden;
          pointer-events: none;
        }
        .timeline-telemetry-hud {
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid var(--border-tactical);
          padding: 0.45rem 0.75rem;
          font-size: 0.65rem;
          min-height: 2.2rem;
          display: flex;
          align-items: center;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          box-sizing: border-box;
        }
        body.theme-light .timeline-telemetry-hud {
          background: rgba(0, 0, 0, 0.04);
        }
        .hud-content {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          max-width: 100%;
        }
        .hud-coord {
          color: var(--accent-hazard);
          font-weight: 700;
        }
        .hud-sep {
          color: var(--border-bright);
        }
        .hud-event {
          color: var(--text-phosphor);
        }
        .hud-total {
          color: var(--accent-radar);
          font-weight: 700;
        }
        .hud-hint {
          color: var(--text-dim);
          font-size: 0.62rem;
        }
        .hud-label {
          color: var(--text-ghost);
          font-weight: 600;
        }
        .hud-date-pill {
          color: var(--text-phosphor);
          font-weight: 700;
          background: var(--accent-radar-dim);
          border: 1px solid var(--accent-radar);
          padding: 1px 6px;
        }
        .hud-idle {
          color: var(--text-dim);
          letter-spacing: 0.04em;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .timeline-footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 0.25rem;
          font-size: 0.65rem;
          color: var(--text-dim);
          width: 100%;
          max-width: 100%;
          min-width: 0;
        }
        .matrix-footer-note {
          color: var(--text-ghost);
          letter-spacing: 0.04em;
          font-size: 0.62rem;
        }
        .matrix-calibration {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.65rem;
          color: var(--text-dim);
          flex-shrink: 0;
        }
        .scale-cell {
          width: 11px;
          height: 11px;
          border-radius: 2px !important;
          display: inline-block;
        }
        .scale-label {
          padding: 0 0.25rem;
        }

        .action-log-header-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 0.35rem;
        }
        .action-log-header-left {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          flex-wrap: wrap;
        }
        .action-log-filter-tag {
          color: var(--accent-radar);
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          background: var(--accent-radar-dim);
          border: 1px solid var(--accent-radar);
          padding: 1px 6px;
        }
        .action-log-header-right {
          display: flex;
          align-items: center;
        }
        .btn-action-all {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 10px;
          letter-spacing: 0.06em;
          cursor: pointer;
          background: transparent;
          color: var(--text-dim);
          border: 1px solid var(--border-tactical);
          transition: all 0.15s ease;
        }
        .btn-action-all:hover {
          color: var(--text-phosphor);
          border-color: var(--border-bright);
        }
        .btn-action-all.active {
          background: var(--text-phosphor);
          color: var(--bg-crt);
          border-color: var(--text-phosphor);
        }

        .action-log-stream {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          max-height: 200px;
          overflow-y: auto;
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 0.75rem;
        }
        .log-item {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.7rem;
          padding: 0.35rem 0;
          border-bottom: 1px solid var(--border-tactical);
        }
        .log-type-tag {
          color: var(--accent-hazard);
          font-weight: 700;
          font-size: 0.65rem;
        }
        .log-desc {
          color: var(--text-phosphor);
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .log-repo {
          color: var(--text-dim);
          font-size: 0.65rem;
        }
        .log-time {
          color: var(--text-ghost);
          font-size: 0.65rem;
        }
        .no-events-prompt {
          font-size: 0.75rem;
          color: var(--text-dim);
          text-align: center;
          padding: 1rem 0;
        }

        @media (max-width: 768px) {
          .modal-inner-padding {
            padding: 1rem 0.75rem;
            gap: 1rem;
          }
          .dossier-metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .dossier-timeline-console {
            padding: 0.75rem 0.5rem;
          }
          .dossier-timeline-pills {
            gap: 0.3rem;
            width: 100%;
          }
          .timeline-footer-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.4rem;
          }
          .timeline-telemetry-hud {
            padding: 0.35rem 0.5rem;
            font-size: 0.62rem;
          }
        }
      `}</style>
    </div>
  );
};
