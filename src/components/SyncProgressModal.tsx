import React from 'react';
import { SyncStatus } from '../types';
import { RefreshIcon } from './Icons';

interface SyncProgressModalProps {
  status: SyncStatus;
  onCancel?: () => void;
}

export const SyncProgressModal: React.FC<SyncProgressModalProps> = ({ status }) => {
  if (!status.isSyncing) return null;

  const getPhaseDescription = () => {
    switch (status.phase) {
      case 'members':
        return 'FETCHING_ORG_ROSTER_&_ACCESS_LEVELS...';
      case 'repos':
        return 'SCANNING_PRIVATE_REPOSITORIES_DIRECTORY...';
      case 'commits':
        return `INDEXING_COMMITS_BURST_FOR: [${status.currentRepo || 'REPO'}]...`;
      case 'pulls':
        return `EXTRACTING_PRS_&_AUDITS_FOR: [${status.currentRepo || 'REPO'}]...`;
      case 'aggregating':
        return 'CALCULATING_IMPACT_SCORES_&_TEMPORAL_MATRICES...';
      default:
        return 'INITIATING_REST_HANDSHAKE...';
    }
  };

  const renderAsciiProgressBar = (pct: number) => {
    const totalBars = 24;
    const filledBars = Math.round((pct / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    return `[${'#'.repeat(Math.max(0, filledBars))}${'-'.repeat(Math.max(0, emptyBars))}]`;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog-tactical sync-dialog with-crosshairs font-mono" onClick={(e) => e.stopPropagation()}>
        <div className="hazard-stripe" />
        <div className="sync-inner-content">
          <div className="sync-icon-frame">
            <RefreshIcon size={20} color="#ff2a2a" spinning={true} />
          </div>

          <div className="sync-heading-block">
            <span className="telemetry-eyebrow">TELEMETRY_INGRESS // BATCH_SYNC</span>
            <h3 className="macro-title sync-headline">Indexing Move2Move Repos</h3>
            <p className="sync-phase-text font-mono">{getPhaseDescription()}</p>
          </div>

          <div className="sync-progress-console">
            <div className="sync-ascii-display">
              <span className="ascii-bar-text">{renderAsciiProgressBar(status.progress)}</span>
              <span className="ascii-pct-text">{status.progress}%</span>
            </div>
            <div className="sync-hardware-bar">
              <div
                className="sync-hardware-fill"
                style={{ width: `${Math.max(5, Math.min(100, status.progress))}%` }}
              />
            </div>
            <div className="sync-sub-numbers">
              <span>STATUS: IN_PROGRESS</span>
              {status.rateLimitRemaining !== null && (
                <span>QUOTA_REMAINING: {status.rateLimitRemaining} / 5,000 CALLS</span>
              )}
            </div>
          </div>

          <div className="sync-telemetry-notice">
            <span>/// NOTICE: CALLS ARE DETERMINISTICALLY RATE-LIMITED & PERSISTED TO LOCAL STORAGE MATRIX.</span>
          </div>
        </div>
      </div>

      <style>{`
        .sync-dialog {
          max-width: 520px;
        }
        .sync-inner-content {
          padding: 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 1.25rem;
        }
        .sync-icon-frame {
          width: 3rem;
          height: 3rem;
          border: 1px solid var(--accent-hazard);
          background: var(--bg-crt);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sync-heading-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
        }
        .sync-headline {
          font-size: 1.35rem;
          color: var(--text-phosphor);
        }
        .sync-phase-text {
          font-size: 0.72rem;
          color: var(--accent-hazard);
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        .sync-progress-console {
          width: 100%;
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .sync-ascii-display {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-phosphor);
          font-weight: 700;
        }
        .ascii-bar-text {
          letter-spacing: -0.05em;
          color: var(--accent-radar);
        }
        .sync-hardware-bar {
          width: 100%;
          height: 6px;
          background: #222;
        }
        .sync-hardware-fill {
          height: 100%;
          background: var(--accent-hazard);
        }
        .sync-sub-numbers {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.65rem;
          color: var(--text-dim);
        }
        .sync-telemetry-notice {
          font-size: 0.65rem;
          color: var(--text-ghost);
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
};
