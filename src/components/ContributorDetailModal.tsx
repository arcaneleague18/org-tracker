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
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedDayIndex(null);
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
    if (event.timestamp) {
      const d = new Date(event.timestamp);
      if (!isNaN(d.getTime())) {
        return d.getDay();
      }
      const parts = event.timestamp.split(/[/.-]/).map(Number);
      if (parts.length === 3) {
        if (parts[0] > 12) {
          const fallbackDate = new Date(parts[2], parts[1] - 1, parts[0]);
          if (!isNaN(fallbackDate.getTime())) return fallbackDate.getDay();
        } else {
          const fallbackDate = new Date(parts[2], parts[0] - 1, parts[1]);
          if (!isNaN(fallbackDate.getTime())) return fallbackDate.getDay();
        }
      }
    }
    return -1;
  };

  const filteredEvents = selectedDayIndex === null
    ? contributor.recentActivity
    : contributor.recentActivity.filter((event) => getEventDayOfWeek(event) === selectedDayIndex);

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
              {selectedDayIndex !== null && (
                <span className="punchcard-filter-indicator">
                  [ACTIVE_DAY: {daysOfWeek[selectedDayIndex]}]
                </span>
              )}
            </div>
            <div className="punchcard-console">
              {daysOfWeek.map((dayName, dayIndex) => {
                const daySlots = contributor.punchcard.filter((s) => s.day === dayIndex);
                const isSelected = selectedDayIndex === dayIndex;
                const isAnySelected = selectedDayIndex !== null;
                const totalDayActions = daySlots.reduce((acc, s) => acc + s.count, 0);

                return (
                  <div
                    key={dayName}
                    className={`punch-console-row ${isSelected ? 'row-selected' : ''} ${isAnySelected && !isSelected ? 'row-dimmed' : ''}`}
                    onClick={() => setSelectedDayIndex(isSelected ? null : dayIndex)}
                    role="button"
                    tabIndex={0}
                    title={`CLICK TO ${isSelected ? 'CLEAR FILTER' : `FILTER BY ${dayName}`} [${totalDayActions} ACTIONS RECORDED]`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedDayIndex(isSelected ? null : dayIndex);
                      }
                    }}
                  >
                    <span className={`punch-day-code ${isSelected ? 'day-code-selected' : ''}`}>
                      {dayName}
                    </span>
                    <div className="punch-grid-track">
                      {daySlots.map((slot) => {
                        const getPunchIntensityClass = (count: number) => {
                          if (count === 0) return 'cell-l0';
                          const ratio = count / maxPunch;
                          if (ratio < 0.25) return 'cell-l1';
                          if (ratio < 0.5) return 'cell-l2';
                          if (ratio < 0.75) return 'cell-l3';
                          return 'cell-l4';
                        };

                        return (
                          <div
                            key={slot.hour}
                            className={`punch-square ${getPunchIntensityClass(slot.count)}`}
                            title={`${dayName} @ ${slot.hour.toString().padStart(2, '0')}:00 UTC // ${slot.count} ACTIONS`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
                {selectedDayIndex !== null && (
                  <span className="action-log-filter-tag">
                    [FILTER: {daysOfWeek[selectedDayIndex]} // {filteredEvents.length} EVENT{filteredEvents.length === 1 ? '' : 'S'}]
                  </span>
                )}
              </div>
              <div className="action-log-header-right">
                <button
                  type="button"
                  className={`btn-tactical btn-action-all ${selectedDayIndex === null ? 'active' : ''}`}
                  onClick={() => setSelectedDayIndex(null)}
                  title="VIEW ALL CONTRIBUTIONS"
                >
                  [ALL]
                </button>
              </div>
            </div>
            <div className="action-log-stream">
              {filteredEvents.length === 0 ? (
                <p className="no-events-prompt">
                  {selectedDayIndex !== null
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
