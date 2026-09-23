import React, { useState, useMemo } from 'react';
import { DailyActivityPoint } from '../types';

interface ActivityHeatmapProps {
  dailyActivity: DailyActivityPoint[];
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

function formatTooltipDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ dailyActivity }) => {
  const [activeHoverPoint, setActiveHoverPoint] = useState<CalendarDay | null>(null);

  // 1. Build a full 53-week (371 days) calendar grid ending on the current week
  const {
    weeks,
    monthLabels,
    totalCommits,
    totalPrs,
    totalReviews,
    totalContributions,
    maxEvents,
    currentStreak,
    maxStreak
  } = useMemo(() => {
    const activityMap = new Map<string, DailyActivityPoint>();
    for (const p of dailyActivity) {
      activityMap.set(p.date, p);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDate(today);

    // Calculate current week's Sunday (0 = Sun)
    const currentDayOfWeek = today.getDay();
    const currentSunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - currentDayOfWeek);

    // 53 weeks = 52 full preceding weeks + current week
    const totalWeeks = 53;
    const startSunday = new Date(currentSunday.getFullYear(), currentSunday.getMonth(), currentSunday.getDate() - (totalWeeks - 1) * 7);

    let commitsCount = 0;
    let prsCount = 0;
    let reviewsCount = 0;
    let totalBurstCount = 0;
    let maxDaily = 0;

    const weeksList: CalendarWeek[] = [];

    for (let w = 0; w < totalWeeks; w++) {
      const days: CalendarDay[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(startSunday.getFullYear(), startSunday.getMonth(), startSunday.getDate() + w * 7 + d);
        const dateStr = formatDate(cellDate);
        const isFuture = dateStr > todayStr;

        const p = activityMap.get(dateStr);
        const commits = p?.commits || 0;
        const prs = p?.prs || 0;
        const reviews = p?.reviews || 0;
        const total = p?.total || 0;

        if (!isFuture) {
          commitsCount += commits;
          prsCount += prs;
          reviewsCount += reviews;
          totalBurstCount += total;
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
      weeksList.push({ weekIndex: w, days });
    }

    // 2. Identify month labels across the top
    const labels: { label: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    let lastLabeledWeek = -99;

    weeksList.forEach((week, wIdx) => {
      // Look at month of the first day or transition day in this week
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

    // 3. Calculate streak counts (current streak and longest/max streak)
    const chronologicalDays: CalendarDay[] = [];
    for (const w of weeksList) {
      for (const d of w.days) {
        if (!d.isFuture) {
          chronologicalDays.push(d);
        }
      }
    }

    let maxStreak = 0;
    let runningStreak = 0;

    for (const day of chronologicalDays) {
      if (day.total > 0) {
        runningStreak++;
        if (runningStreak > maxStreak) {
          maxStreak = runningStreak;
        }
      } else {
        runningStreak = 0;
      }
    }

    let currentStreak = 0;
    const n = chronologicalDays.length;
    if (n > 0) {
      const todayDay = chronologicalDays[n - 1];
      const yesterdayDay = n >= 2 ? chronologicalDays[n - 2] : null;

      // If today has activity, streak starts from today and counts backwards.
      // If today has 0 activity but yesterday had activity, streak is still active starting from yesterday.
      // If neither today nor yesterday had activity, current streak is 0.
      let startIdx = -1;
      if (todayDay.total > 0) {
        startIdx = n - 1;
      } else if (yesterdayDay && yesterdayDay.total > 0) {
        startIdx = n - 2;
      }

      if (startIdx >= 0) {
        for (let i = startIdx; i >= 0; i--) {
          if (chronologicalDays[i].total > 0) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    return {
      weeks: weeksList,
      monthLabels: labels,
      totalCommits: commitsCount,
      totalPrs: prsCount,
      totalReviews: reviewsCount,
      totalContributions: totalBurstCount,
      maxEvents: maxDaily > 0 ? maxDaily : 1,
      currentStreak,
      maxStreak
    };
  }, [dailyActivity]);

  const getIntensityClass = (total: number) => {
    if (total === 0) return 'cell-l0';
    if (maxEvents <= 4) {
      if (total === 1) return 'cell-l1';
      if (total === 2) return 'cell-l2';
      if (total === 3) return 'cell-l3';
      return 'cell-l4';
    }
    const ratio = total / maxEvents;
    if (ratio <= 0.25) return 'cell-l1';
    if (ratio <= 0.5) return 'cell-l2';
    if (ratio <= 0.75) return 'cell-l3';
    return 'cell-l4';
  };

  return (
    <section className="radar-section">
      <div className="section-telemetry-header">
        <span className="telemetry-eyebrow">CADENCE // TEMPORAL_MATRIX_RADAR</span>
        <span className="telemetry-serial font-mono">GRID: 53_WEEK_ANNUAL_TIMELINE</span>
      </div>

      <div className="tactical-panel with-crosshairs">
        <div className="panel-header-row">
          <div className="panel-meta-title">
            <h2 className="macro-title radar-title">Activity Throughput Matrix</h2>
            <span className="radar-subtext font-mono">
              [ 53_WEEK_CADENCE // FULL_ANNUAL_CONTRIBUTION_TIMELINE ]
            </span>
          </div>

          <div className="telemetry-stat-pills font-mono">
            <div
              className={`telemetry-data-block ${currentStreak > 0 ? 'telemetry-data-block-active' : ''}`}
              title={`Current active contribution streak: ${currentStreak} days | Longest streak: ${maxStreak} days`}
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
              <span className="tdb-val">{totalCommits}</span>
            </div>
            <div className="telemetry-data-block">
              <span className="tdb-key">PRS_AUTHORED:</span>
              <span className="tdb-val">{totalPrs}</span>
            </div>
            <div className="telemetry-data-block">
              <span className="tdb-key">CODE_REVIEWS:</span>
              <span className="tdb-val">{totalReviews}</span>
            </div>
            <div className="telemetry-data-block">
              <span className="tdb-key">TOTAL_BURST:</span>
              <span className="tdb-val">{totalContributions}</span>
            </div>
          </div>
        </div>

        {/* Matrix Contribution Canvas */}
        <div className="matrix-canvas">
          <div className="contribution-graph-scroll">
            <div className="contribution-graph-inner">
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
                {/* Y-Axis Weekday Indicators (aligned with Mon, Wed, Fri) */}
                <div className="weekday-labels-col font-mono">
                  <span className="weekday-label"></span>
                  <span className="weekday-label">Mon</span>
                  <span className="weekday-label"></span>
                  <span className="weekday-label">Wed</span>
                  <span className="weekday-label"></span>
                  <span className="weekday-label">Fri</span>
                  <span className="weekday-label"></span>
                </div>

                {/* 53 Week Columns */}
                <div className="weeks-container">
                  {weeks.map((week) => (
                    <div key={week.weekIndex} className="week-column">
                      {week.days.map((day) => (
                        <div
                          key={day.date}
                          className={`matrix-cell ${day.isFuture ? 'cell-future' : getIntensityClass(day.total)} ${
                            activeHoverPoint?.date === day.date ? 'cell-active' : ''
                          }`}
                          title={
                            day.isFuture
                              ? ''
                              : `${day.total} contribution${day.total === 1 ? '' : 's'} on ${formatTooltipDate(day.date)}${
                                  day.total > 0
                                    ? ` (${day.commits} commits, ${day.prs} PRs, ${day.reviews} reviews)`
                                    : ''
                                }`
                          }
                          onMouseEnter={() => !day.isFuture && setActiveHoverPoint(day)}
                          onMouseLeave={() => setActiveHoverPoint(null)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Matrix Calibration Scale & Legend */}
          <div className="matrix-footer font-mono">
            <div className="matrix-footer-note">
              [ CADENCE: 365_DAY_TEMPORAL_MATRIX // GITHUB_STANDARD ]
            </div>
            <div className="matrix-calibration">
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

        {/* Telemetry Output HUD Banner */}
        <div className="telemetry-readout-hud font-mono">
          {activeHoverPoint ? (
            <div className="hud-active-stream">
              <span className="hud-coord">COORD_DATE: [{activeHoverPoint.date}]</span>
              <span className="hud-sep">///</span>
              <span className="hud-event">COMMITS: {activeHoverPoint.commits}</span>
              <span className="hud-sep">/</span>
              <span className="hud-event">PRS: {activeHoverPoint.prs}</span>
              <span className="hud-sep">/</span>
              <span className="hud-event">REVIEWS: {activeHoverPoint.reviews}</span>
              <span className="hud-sep">///</span>
              <span className="hud-total">TOTAL_BURST: {activeHoverPoint.total} EVENTS</span>
            </div>
          ) : (
            <div className="hud-idle-stream">
              <span>SCANNING_MATRIX... HOVER OVER ANY CELL TO RETRIEVE EVENT PAYLOAD</span>
              {currentStreak > 0 && (
                <span style={{ color: 'var(--accent-radar)', marginLeft: '0.75rem' }}>
                  /// ACTIVE_STREAK: {currentStreak} {currentStreak === 1 ? 'DAY' : 'DAYS'} (RECORD: {maxStreak})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .radar-section {
          margin-bottom: 2.5rem;
        }
        .tactical-panel {
          background: var(--bg-panel);
          border: 1px solid var(--border-tactical);
          padding: 1.5rem;
        }
        .panel-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          border-bottom: 1px solid var(--border-tactical);
          padding-bottom: 1.25rem;
          margin-bottom: 1.25rem;
        }
        .panel-meta-title {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .radar-title {
          font-size: 1.3rem;
          color: var(--text-phosphor);
        }
        .radar-subtext {
          font-size: 0.68rem;
          color: var(--text-dim);
        }
        .telemetry-stat-pills {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .telemetry-data-block {
          background: var(--bg-crt);
          border: 1px solid var(--border-bright);
          padding: 0.35rem 0.65rem;
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.68rem;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
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
        .matrix-canvas {
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .contribution-graph-scroll {
          overflow-x: auto;
          padding-bottom: 0.5rem;
          scrollbar-width: thin;
          scrollbar-color: var(--border-bright) transparent;
        }
        .contribution-graph-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .contribution-graph-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .contribution-graph-scroll::-webkit-scrollbar-thumb {
          background: var(--border-bright);
        }
        .contribution-graph-inner {
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
        .cell-future {
          visibility: hidden;
          pointer-events: none;
        }
        .matrix-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 0.25rem;
          font-size: 0.68rem;
          color: var(--text-dim);
        }
        .matrix-footer-note {
          color: var(--text-ghost);
          letter-spacing: 0.04em;
        }
        .matrix-calibration {
          display: flex;
          align-items: center;
          gap: 0.35rem;
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
        .telemetry-readout-hud {
          margin-top: 1rem;
          background: var(--bg-crt);
          border: 1px solid var(--border-bright);
          padding: 0.6rem 0.85rem;
          min-height: 2.4rem;
          display: flex;
          align-items: center;
          font-size: 0.72rem;
        }
        .hud-active-stream {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }
        .hud-coord {
          color: var(--accent-hazard);
          font-weight: 700;
        }
        .hud-sep {
          color: var(--text-ghost);
        }
        .hud-event {
          color: var(--text-phosphor);
        }
        .hud-total {
          color: var(--accent-radar);
          font-weight: 700;
        }
        .hud-idle-stream {
          color: var(--text-dim);
          letter-spacing: 0.05em;
        }
      `}</style>
    </section>
  );
};
