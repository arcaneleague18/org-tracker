import React, { useState, useEffect } from 'react';
import { ContributorStats, ActivityEvent } from '../types';
import { ArrowUpRightIcon } from './Icons';

interface ContributorDetailModalProps {
  contributor: ContributorStats | null;
  onClose: () => void;
}

export const ContributorDetailModal: React.FC<ContributorDetailModalProps> = ({
  contributor,
  onClose
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{
    day: number;
    hour: number;
    count: number;
    dates: string[];
  } | null>(null);

  useEffect(() => {
    setSelectedDate(null);
    setSelectedDayIndex(null);
    setHoveredSlot(null);
  }, [contributor?.login]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!contributor) return null;

  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const maxPunch = Math.max(...contributor.punchcard.map((s) => s.count), 1);
  const totalRepoCommits = contributor.repositories.reduce((acc, r) => acc + r.commits, 0) || 1;

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

  const getEventDayOfWeek = (event: ActivityEvent): number => {
    if (typeof event.dayOfWeek === 'number' && event.dayOfWeek >= 0 && event.dayOfWeek <= 6) {
      return event.dayOfWeek;
    }
    if (event.isoDate) {
      const d = new Date(event.isoDate);
      if (!isNaN(d.getTime())) {
        return d.getDay();
      }
    }
    const cDate = getEventCanonicalDate(event);
    if (cDate) {
      const parts = cDate.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      if (!isNaN(d.getTime())) return d.getDay();
    }
    return -1;
  };

  const getEventHour = (event: ActivityEvent): number => {
    if (typeof event.hour === 'number' && event.hour >= 0 && event.hour <= 23) {
      return event.hour;
    }
    if (event.isoDate) {
      const d = new Date(event.isoDate);
      if (!isNaN(d.getTime())) return d.getHours();
    }
    return -1;
  };

  // Build a lookup map of `${day}-${hour}` -> canonical dates
  const slotDatesMap: Record<string, string[]> = {};
  const tempMap: Record<string, Set<string>> = {};
  contributor.punchcard.forEach((s) => {
    const key = `${s.day}-${s.hour}`;
    if (!tempMap[key]) tempMap[key] = new Set();
    if (s.dates) {
      s.dates.forEach((d) => tempMap[key].add(d));
    }
  });

  contributor.recentActivity.forEach((event) => {
    const cDate = getEventCanonicalDate(event);
    const day = getEventDayOfWeek(event);
    const hour = getEventHour(event);
    if (cDate && day >= 0 && hour >= 0) {
      const key = `${day}-${hour}`;
      if (!tempMap[key]) tempMap[key] = new Set();
      tempMap[key].add(cDate);
    }
  });

  for (const [key, set] of Object.entries(tempMap)) {
    slotDatesMap[key] = Array.from(set).sort().reverse();
  }

  const getSlotDates = (day: number, hour: number): string[] => {
    return slotDatesMap[`${day}-${hour}`] || [];
  };

  const getDayActiveDates = (dayIndex: number): string[] => {
    const datesSet = new Set<string>();
    for (let hour = 0; hour < 24; hour++) {
      const dates = getSlotDates(dayIndex, hour);
      dates.forEach((d) => datesSet.add(d));
    }
    return Array.from(datesSet).sort().reverse();
  };

  const filteredEvents = selectedDate
    ? contributor.recentActivity.filter(
        (event) => getEventCanonicalDate(event) === selectedDate
      )
    : selectedDayIndex !== null
    ? contributor.recentActivity.filter(
        (event) => getEventDayOfWeek(event) === selectedDayIndex
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
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${contributor.login}&background=141414&color=fff`;
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
                    rel="noreferrer"
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

          {/* 7x24 Hourly Punchcard Matrix */}
          <div className="dossier-section">
            <div className="section-title-strip flex-between">
              <span>// HOURLY_PUNCHCARD_RADAR [00:00 TO 23:00 UTC]</span>
              {selectedDate ? (
                <span className="punchcard-filter-indicator">
                  [ACTIVE_DATE: {formatDisplayDate(selectedDate)} ({daysOfWeek[selectedDayIndex ?? 0]})]
                </span>
              ) : selectedDayIndex !== null ? (
                <span className="punchcard-filter-indicator">
                  [ACTIVE_DAY: {daysOfWeek[selectedDayIndex]}]
                </span>
              ) : null}
            </div>
            <div className="punchcard-console">
              {daysOfWeek.map((dayName, dayIndex) => {
                const daySlots = contributor.punchcard.filter((s) => s.day === dayIndex);
                const dayDates = getDayActiveDates(dayIndex);
                const isSelected = selectedDayIndex === dayIndex;
                const isAnySelected = selectedDayIndex !== null || selectedDate !== null;
                const totalDayActions = daySlots.reduce((acc, s) => acc + s.count, 0);

                return (
                  <div
                    key={dayName}
                    className={`punch-console-row ${isSelected ? 'row-selected' : ''} ${isAnySelected && !isSelected ? 'row-dimmed' : ''}`}
                    onClick={() => {
                      if (dayDates.length === 0) {
                        setSelectedDayIndex(isSelected ? null : dayIndex);
                        setSelectedDate(null);
                        return;
                      }
                      if (selectedDayIndex === dayIndex) {
                        if (selectedDate) {
                          const idx = dayDates.indexOf(selectedDate);
                          if (idx >= 0 && idx < dayDates.length - 1) {
                            setSelectedDate(dayDates[idx + 1]);
                          } else {
                            setSelectedDate(null);
                            setSelectedDayIndex(null);
                          }
                        } else {
                          setSelectedDate(dayDates[0]);
                        }
                      } else {
                        setSelectedDayIndex(dayIndex);
                        setSelectedDate(dayDates[0]);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    title={`CLICK TO ${isSelected ? 'CLEAR FILTER' : `FILTER BY ${dayName}`} [${totalDayActions} ACTIONS // ${dayDates.length} ACTIVE DATE${dayDates.length === 1 ? '' : 'S'}]`}
                  >
                    <span className={`punch-day-code ${isSelected ? 'day-code-selected' : ''}`}>
                      {dayName}
                    </span>
                    <div className="punch-grid-track">
                      {daySlots.map((slot) => {
                        const slotDates = getSlotDates(dayIndex, slot.hour);
                        const dateDisplayList = slotDates.map(formatDisplayDate);
                        const hasSelectedDate = selectedDate ? slotDates.includes(selectedDate) : false;

                        const getPunchIntensityClass = (count: number) => {
                          if (count === 0) return 'cell-l0';
                          const ratio = count / maxPunch;
                          if (ratio < 0.25) return 'cell-l1';
                          if (ratio < 0.5) return 'cell-l2';
                          if (ratio < 0.75) return 'cell-l3';
                          return 'cell-l4';
                        };

                        let tooltipText = `${dayName} @ ${slot.hour.toString().padStart(2, '0')}:00 UTC // ${slot.count} ACTION${slot.count === 1 ? '' : 'S'}`;
                        if (slotDates.length > 0) {
                          tooltipText += ` ON ${dateDisplayList.join(', ')}`;
                        } else if (slot.count === 0) {
                          tooltipText += ` (NO RECORDED ACTIONS)`;
                        }

                        return (
                          <div
                            key={slot.hour}
                            className={`punch-square ${getPunchIntensityClass(slot.count)} ${
                              hasSelectedDate ? 'cell-date-selected' : ''
                            } ${selectedDate && !hasSelectedDate ? 'cell-date-other' : ''}`}
                            title={tooltipText}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (slotDates.length > 0) {
                                if (selectedDate === slotDates[0]) {
                                  if (slotDates.length > 1) {
                                    setSelectedDate(slotDates[1]);
                                  } else {
                                    setSelectedDate(null);
                                    setSelectedDayIndex(null);
                                  }
                                } else {
                                  setSelectedDate(slotDates[0]);
                                  setSelectedDayIndex(dayIndex);
                                }
                              } else {
                                setSelectedDayIndex(isSelected ? null : dayIndex);
                                setSelectedDate(null);
                              }
                            }}
                            onMouseEnter={() => {
                              setHoveredSlot({
                                day: dayIndex,
                                hour: slot.hour,
                                count: slot.count,
                                dates: slotDates
                              });
                            }}
                            onMouseLeave={() => setHoveredSlot(null)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Real-time Telemetry HUD readout on hover */}
              <div className="punch-telemetry-hud font-mono">
                {hoveredSlot ? (
                  <div className="hud-content">
                    <span className="hud-coord">COORD: [{daysOfWeek[hoveredSlot.day]} @ {hoveredSlot.hour.toString().padStart(2, '0')}:00 UTC]</span>
                    <span className="hud-sep">///</span>
                    <span className="hud-accent">{hoveredSlot.count} ACTION{hoveredSlot.count === 1 ? '' : 'S'}</span>
                    {hoveredSlot.dates.length > 0 ? (
                      <>
                        <span className="hud-sep">///</span>
                        <span className="hud-date-pill">DATE: {hoveredSlot.dates.map(formatDisplayDate).join(', ')}</span>
                      </>
                    ) : (
                      <span className="hud-dim"> /// NO ACTIVITY</span>
                    )}
                  </div>
                ) : selectedDate ? (
                  <div className="hud-content">
                    <span className="hud-label">FILTERED_DATE:</span>
                    <span className="hud-date-pill">[{formatDisplayDate(selectedDate)} ({daysOfWeek[selectedDayIndex ?? 0]})]</span>
                    <span className="hud-sep">///</span>
                    <span className="hud-hint">CLICK ANY CELL TO SWITCH DATE // CLICK [ALL] TO RESET</span>
                  </div>
                ) : (
                  <div className="hud-content hud-idle">
                    <span>// HOVER OVER ANY CELL TO VIEW EXACT DATE & TIME // CLICK TO FILTER BY DATE</span>
                  </div>
                )}
              </div>

              <div className="punch-calibration-row">
                <div className="punch-footer-axis">
                  <span>00H</span>
                  <span>06H</span>
                  <span>12H</span>
                  <span>18H</span>
                  <span>23H</span>
                </div>
                <div className="matrix-calibration font-mono">
                  <span className="scale-label">Less</span>
                  <span className="scale-cell cell-l0"></span>
                  <span className="scale-cell cell-l1"></span>
                  <span className="scale-cell cell-l2"></span>
                  <span className="scale-cell cell-l3"></span>
                  <span className="scale-cell cell-l4"></span>
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
                {selectedDate ? (
                  <span className="action-log-filter-tag">
                    [DATE: {formatDisplayDate(selectedDate)} // {filteredEvents.length} EVENT{filteredEvents.length === 1 ? '' : 'S'}]
                  </span>
                ) : selectedDayIndex !== null ? (
                  <span className="action-log-filter-tag">
                    [DAY: {daysOfWeek[selectedDayIndex]} // {filteredEvents.length} EVENT{filteredEvents.length === 1 ? '' : 'S'}]
                  </span>
                ) : null}

                {/* Quick-switch date pills if multiple dates available on the selected day */}
                {selectedDayIndex !== null && getDayActiveDates(selectedDayIndex).length > 1 && (
                  <div className="action-log-date-pills">
                    {getDayActiveDates(selectedDayIndex).map((dStr) => (
                      <button
                        key={dStr}
                        type="button"
                        className={`btn-date-pill ${selectedDate === dStr ? 'is-active' : ''}`}
                        onClick={() => setSelectedDate(dStr)}
                        title={`FILTER STRICTLY BY ${formatDisplayDate(dStr)}`}
                      >
                        {formatDisplayDate(dStr)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="action-log-header-right">
                <button
                  type="button"
                  className={`btn-tactical btn-action-all ${selectedDate === null && selectedDayIndex === null ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedDate(null);
                    setSelectedDayIndex(null);
                  }}
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
                    : selectedDayIndex !== null
                    ? `[ ZERO RECORDED ACTIONS ON ${daysOfWeek[selectedDayIndex]} ]`
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

        .punchcard-console {
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .punch-console-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 2px 4px;
          cursor: pointer;
          transition: background 0.15s ease, opacity 0.15s ease, border-left 0.15s ease;
          border-left: 2px solid transparent;
          user-select: none;
        }
        .punch-console-row:hover {
          background: rgba(255, 255, 255, 0.04);
          border-left-color: var(--border-bright);
        }
        .punch-console-row.row-selected {
          background: var(--accent-radar-dim);
          border-left-color: var(--accent-radar);
        }
        .punch-console-row.row-dimmed {
          opacity: 0.38;
        }
        .punch-console-row.row-dimmed:hover {
          opacity: 0.85;
        }
        .punch-day-code {
          width: 32px;
          font-size: 0.65rem;
          color: var(--text-dim);
          font-weight: 700;
          transition: color 0.15s ease;
        }
        .punch-day-code.day-code-selected {
          color: var(--accent-radar);
          font-weight: 900;
          text-shadow: 0 0 6px var(--accent-radar);
        }
        .punch-grid-track {
          display: flex;
          gap: 2px;
          flex: 1;
        }
        .punch-square {
          flex: 1;
          height: 14px;
          cursor: pointer;
        }
        .punch-square:hover {
          outline: 2px solid var(--text-phosphor);
          z-index: 5;
        }
        .punch-square.cell-date-selected {
          outline: 2px solid var(--text-phosphor);
          box-shadow: 0 0 6px var(--accent-radar);
          z-index: 6;
        }
        .punch-square.cell-date-other {
          opacity: 0.25;
        }

        .punch-telemetry-hud {
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid var(--border-tactical);
          padding: 0.45rem 0.75rem;
          margin-top: 0.6rem;
          font-size: 0.65rem;
          min-height: 2rem;
          display: flex;
          align-items: center;
        }
        body.theme-light .punch-telemetry-hud {
          background: rgba(0, 0, 0, 0.04);
        }
        .hud-content {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .hud-coord {
          color: var(--text-phosphor);
          font-weight: 700;
        }
        .hud-sep {
          color: var(--border-bright);
        }
        .hud-accent {
          color: var(--accent-radar);
          font-weight: 700;
        }
        .hud-date-pill {
          color: var(--text-phosphor);
          font-weight: 700;
          background: var(--accent-radar-dim);
          border: 1px solid var(--accent-radar);
          padding: 1px 5px;
        }
        .hud-dim {
          color: var(--text-ghost);
        }
        .hud-hint {
          color: var(--text-dim);
        }
        .hud-idle {
          color: var(--text-ghost);
          font-size: 0.62rem;
        }

        .punch-calibration-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-left: 36px;
          margin-top: 0.6rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .punch-footer-axis {
          display: flex;
          gap: 2.5rem;
          font-size: 0.6rem;
          color: var(--text-ghost);
        }
        .matrix-calibration {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.65rem;
          color: var(--text-dim);
        }
        .scale-cell {
          width: 10px;
          height: 10px;
          display: inline-block;
        }
        .scale-label {
          padding: 0 0.2rem;
          font-size: 0.65rem;
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
        .action-log-date-pills {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          flex-wrap: wrap;
        }
        .btn-date-pill {
          font-size: 0.6rem;
          font-weight: 700;
          font-family: var(--font-mono);
          padding: 1px 6px;
          background: transparent;
          color: var(--text-dim);
          border: 1px solid var(--border-tactical);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-date-pill:hover {
          color: var(--text-phosphor);
          border-color: var(--border-bright);
        }
        .btn-date-pill.is-active {
          background: var(--text-phosphor);
          color: var(--bg-crt);
          border-color: var(--text-phosphor);
          font-weight: 900;
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
          .dossier-metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
};
