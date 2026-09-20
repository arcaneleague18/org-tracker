import React from 'react';
import { OrgOverview } from '../types';

interface OverviewCardsProps {
  overview: OrgOverview;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ overview }) => {
  const mergeRate = overview.totalPrs > 0
    ? Math.round((overview.totalPrsMerged / overview.totalPrs) * 100)
    : 100;

  // Generate ASCII progress bar
  const renderAsciiMeter = (pct: number) => {
    const totalBars = 16;
    const filledBars = Math.round((pct / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    return `[${'='.repeat(Math.max(0, filledBars))}>${' '.repeat(Math.max(0, emptyBars))}]`;
  };

  return (
    <section className="overview-tactical">
      <div className="section-telemetry-header">
        <span className="telemetry-eyebrow">DIAGNOSTICS // AGGREGATE_METRICS</span>
        <span className="telemetry-serial font-mono">SECTOR_ID: M2M-ALPHA-TELEMETRY</span>
      </div>

      <div className="tactical-grid overview-grid with-crosshairs">
        {/* Cell 1: Active Personnel */}
        <div className="tactical-cell metric-module">
          <div className="module-top">
            <span className="module-code">[ 01 // PERSONNEL ]</span>
            <span className="module-status">ACTIVE</span>
          </div>
          <div className="module-value-area">
            <span className="macro-title metric-large">{overview.totalContributors}</span>
            <span className="metric-unit font-mono">DEV_UNITS</span>
          </div>
          <div className="module-footer font-mono">
            <span>MONITORED_REPOS: {overview.activeReposCount}</span>
            <span className="sub-data">STATUS: LOGGED</span>
          </div>
        </div>

        {/* Cell 2: Git Commits */}
        <div className="tactical-cell metric-module">
          <div className="module-top">
            <span className="module-code">[ 02 // COMMIT_BURST ]</span>
            <span className="module-status">RATE: HIGH</span>
          </div>
          <div className="module-value-area">
            <span className="macro-title metric-large">{overview.totalCommits.toLocaleString()}</span>
            <span className="metric-unit font-mono">DELIVERIES</span>
          </div>
          <div className="module-footer font-mono">
            <span>VELOCITY: SUSTAINED</span>
            <span className="sub-data">CYCLE: 90D_WINDOW</span>
          </div>
        </div>

        {/* Cell 3: Pull Requests */}
        <div className="tactical-cell metric-module">
          <div className="module-top">
            <span className="module-code">[ 03 // PR_SUCCESS_IDX ]</span>
            <span className="module-status">{mergeRate}% MERGED</span>
          </div>
          <div className="module-value-area">
            <span className="macro-title metric-large">{overview.totalPrsMerged}</span>
            <span className="metric-unit font-mono">/ {overview.totalPrs} PRS</span>
          </div>
          <div className="module-footer font-mono">
            <span className="ascii-meter font-mono">{renderAsciiMeter(mergeRate)}</span>
            <span className="sub-data">MERGE_INDEX: OPTIMAL</span>
          </div>
        </div>

        {/* Cell 4: Code Churn */}
        <div className="tactical-cell metric-module">
          <div className="module-top">
            <span className="module-code">[ 04 // LOC_FLUX_DELTA ]</span>
            <span className="module-status">NET_DELTA</span>
          </div>
          <div className="module-value-area churn-layout">
            <div className="churn-row">
              <span className="churn-symbol font-mono">+</span>
              <span className="macro-title churn-val-add">{overview.totalLinesAdded.toLocaleString()}</span>
            </div>
            <div className="churn-row">
              <span className="churn-symbol font-mono">-</span>
              <span className="macro-title churn-val-del">{overview.totalLinesDeleted.toLocaleString()}</span>
            </div>
          </div>
          <div className="module-footer font-mono">
            <span>NET: {(overview.totalLinesAdded - overview.totalLinesDeleted).toLocaleString()} LINES</span>
            <span className="sub-data">EFFICIENCY: POSITIVE</span>
          </div>
        </div>

        {/* Cell 5: Peer Reviews */}
        <div className="tactical-cell metric-module">
          <div className="module-top">
            <span className="module-code">[ 05 // REVIEW_DENSITY ]</span>
            <span className="module-status">{overview.reviewParticipationRate}% PARTICIPATION</span>
          </div>
          <div className="module-value-area">
            <span className="macro-title metric-large">{overview.totalReviews}</span>
            <span className="metric-unit font-mono">AUDITS</span>
          </div>
          <div className="module-footer font-mono">
            <span>PEER_SURFACE: VERIFIED</span>
            <span className="sub-data">CO-SIGNS: RECORDED</span>
          </div>
        </div>
      </div>

      <style>{`
        .overview-tactical {
          margin: 1.75rem 0 2.25rem 0;
        }
        .section-telemetry-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-tactical);
          margin-bottom: 0.75rem;
        }
        .telemetry-serial {
          font-size: 0.65rem;
          font-weight: 600;
          color: var(--text-ghost);
          letter-spacing: 0.1em;
        }
        .overview-grid {
          grid-template-columns: repeat(5, 1fr);
        }
        .metric-module {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 150px;
          border-top: 2px solid var(--border-bright);
        }
        .metric-module:hover {
          border-top-color: var(--accent-hazard);
          background: var(--bg-elevated);
        }
        .module-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-dim);
          border-bottom: 1px solid var(--border-tactical);
          padding-bottom: 0.35rem;
        }
        .module-code {
          color: var(--text-phosphor);
          letter-spacing: 0.05em;
        }
        .module-status {
          font-size: 0.6rem;
          color: var(--accent-hazard);
          font-family: var(--font-mono);
        }
        .module-value-area {
          margin: 1rem 0;
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .metric-large {
          font-size: clamp(2rem, 3.2vw, 3.2rem);
          color: var(--text-phosphor);
          line-height: 0.9;
        }
        .metric-unit {
          font-size: 0.65rem;
          color: var(--text-dim);
          letter-spacing: 0.05em;
        }
        .churn-layout {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          margin: 0.6rem 0;
        }
        .churn-row {
          display: flex;
          align-items: baseline;
          gap: 0.35rem;
        }
        .churn-symbol {
          font-size: 0.9rem;
          font-weight: 700;
        }
        .churn-val-add {
          font-size: clamp(1.2rem, 1.8vw, 1.8rem);
          color: var(--accent-radar);
          line-height: 1;
        }
        .churn-val-del {
          font-size: clamp(1.2rem, 1.8vw, 1.8rem);
          color: var(--accent-hazard);
          line-height: 1;
        }
        .module-footer {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.68rem;
          font-weight: 500;
          color: var(--text-dim);
          border-top: 1px solid var(--border-tactical);
          padding-top: 0.45rem;
        }
        .ascii-meter {
          color: var(--accent-radar);
          font-weight: 700;
          letter-spacing: -0.05em;
        }
        .sub-data {
          color: var(--text-ghost);
          font-size: 0.63rem;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        @media (max-width: 1200px) {
          .overview-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 768px) {
          .overview-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
};
