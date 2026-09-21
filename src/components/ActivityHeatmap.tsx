import React, { useState } from 'react';
import { DailyActivityPoint } from '../types';

interface ActivityHeatmapProps {
  dailyActivity: DailyActivityPoint[];
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ dailyActivity }) => {
  const [activeHoverPoint, setActiveHoverPoint] = useState<DailyActivityPoint | null>(null);

  // Take the last 70 days or all available
  const points = dailyActivity.slice(-70);
  const maxEvents = Math.max(...points.map((p) => p.total), 1);

  const getIntensityClass = (total: number) => {
    if (total === 0) return 'cell-l0';
    const ratio = total / maxEvents;
    if (ratio < 0.25) return 'cell-l1';
    if (ratio < 0.5) return 'cell-l2';
    if (ratio < 0.75) return 'cell-l3';
    return 'cell-l4';
  };

  const totalCommitsInPeriod = points.reduce((acc, p) => acc + p.commits, 0);
  const totalPrsInPeriod = points.reduce((acc, p) => acc + p.prs, 0);
  const totalReviewsInPeriod = points.reduce((acc, p) => acc + p.reviews, 0);

  return (
    <section className="radar-section">
      <div className="section-telemetry-header">
        <span className="telemetry-eyebrow">CADENCE // TEMPORAL_MATRIX_RADAR</span>
        <span className="telemetry-serial font-mono">GRID: 70_DAY_SAMPLE</span>
      </div>

      <div className="tactical-panel with-crosshairs">
        <div className="panel-header-row">
          <div className="panel-meta-title">
            <h2 className="macro-title radar-title">Activity Throughput Matrix</h2>
            <span className="radar-subtext font-mono">
              [ CHRONO: D-70 TO PRESENT // PROTOCOL: GIT_PULL_REV_EVENTS ]
            </span>
          </div>

          <div className="telemetry-stat-pills font-mono">
            <div className="telemetry-data-block">
              <span className="tdb-key">COMMITS:</span>
              <span className="tdb-val">{totalCommitsInPeriod}</span>
            </div>
            <div className="telemetry-data-block">
              <span className="tdb-key">PRS_AUTHORED:</span>
              <span className="tdb-val">{totalPrsInPeriod}</span>
            </div>
            <div className="telemetry-data-block">
              <span className="tdb-key">CODE_REVIEWS:</span>
              <span className="tdb-val">{totalReviewsInPeriod}</span>
            </div>
          </div>
        </div>

        {/* Matrix Grid Canvas */}
        <div className="matrix-canvas">
          <div className="matrix-grid">
            {points.map((point) => (
              <div
                key={point.date}
                className={`matrix-cell ${getIntensityClass(point.total)} ${
                  activeHoverPoint?.date === point.date ? 'cell-active' : ''
                }`}
                title={`${point.date} // TOTAL: ${point.total} (COMMITS: ${point.commits}, PRS: ${point.prs}, REVIEWS: ${point.reviews})`}
                onMouseEnter={() => setActiveHoverPoint(point)}
                onMouseLeave={() => setActiveHoverPoint(null)}
              />
            ))}
          </div>

          {/* Matrix Calibration Scale */}
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
              <span>SCANNING_MATRIX... HOVER OVER CELL TO RETRIEVE EVENT PAYLOAD</span>
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
        .matrix-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(13px, 1fr));
          gap: 4px;
        }
        .matrix-cell {
          aspect-ratio: 1 / 1;
          cursor: pointer;
          transition: none;
        }
        .matrix-cell:hover,
        .cell-active {
          outline: 2px solid #ffffff;
          z-index: 10;
        }
        .matrix-calibration {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.35rem;
          font-size: 0.65rem;
          color: var(--text-dim);
        }
        .scale-cell {
          width: 12px;
          height: 12px;
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
