import React from 'react';
import { DateRangeOption, SyncStatus } from '../types';
import { RefreshIcon, SettingsIcon, LockIcon, DownloadIcon } from './Icons';

interface HeaderProps {
  orgName: string;
  dateRange: DateRangeOption;
  onChangeDateRange: (range: DateRangeOption) => void;
  syncStatus: SyncStatus;
  onTriggerSync: () => void;
  onOpenSettings: () => void;
  onExportCsv: () => void;
  hasToken: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  excludedCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  orgName,
  dateRange,
  onChangeDateRange,
  syncStatus,
  onTriggerSync,
  onOpenSettings,
  onExportCsv,
  hasToken,
  theme,
  onToggleTheme,
  excludedCount = 0
}) => {
  return (
    <header className="header-tactical">
      <div className="hazard-stripe" />
      <div className="container">
        <div className="header-body">
          {/* Left: Organization Telemetry Callout */}
          <div className="telemetry-identity">
            <div className="unit-id-box">
              <span className="unit-label">SYS_ID</span>
              <span className="unit-val">M2M-01</span>
            </div>
            <div className="org-heading-group">
              <div className="title-row">
                <h1 className="macro-title org-macro-name">{orgName}</h1>
                <span className="tactical-tag tag-private">
                  <LockIcon size={10} color="#888888" />
                  [ SEC_CLASS: PRIVATE ]
                </span>
                {hasToken ? (
                  <span className="tactical-tag tag-live">
                    <span className="radar-square" />
                    [ TELEMETRY: ACTIVE ]
                  </span>
                ) : (
                  <span className="tactical-tag tag-unconfigured">
                    <span className="radar-square-offline" />
                    [ STANDBY // UNCONFIGURED ]
                  </span>
                )}
              </div>
              <div className="org-telemetry-sub">
                <span>/// REPO_MONITOR: CLASSIFIED_ACCESS</span>
                <span className="sub-sep">|</span>
                <span>PERSONNEL_CONTRIBUTIONS_INDEX</span>
              </div>
            </div>
          </div>

          {/* Right: Telemetry Controls & Actions */}
          <div className="telemetry-controls">
            {/* Time Filter Track */}
            <div className="time-filter-track">
              <span className="filter-label">WINDOW:</span>
              {(['7d', '30d', '90d', 'year', 'all'] as DateRangeOption[]).map((range) => {
                const labels: Record<DateRangeOption, string> = {
                  '7d': '7D',
                  '30d': '30D',
                  '90d': '90D',
                  year: '1Y',
                  all: 'ALL'
                };
                return (
                  <button
                    key={range}
                    type="button"
                    onClick={() => onChangeDateRange(range)}
                    className={`time-bracket-btn ${dateRange === range ? 'active' : ''}`}
                  >
                    [{labels[range]}]
                  </button>
                );
              })}
            </div>

            {/* Tactical Action Grid */}
            <div className="tactical-actions-grid">
              <button
                type="button"
                onClick={onExportCsv}
                className="btn-tactical"
                title="Dump dataset to CSV report"
              >
                <DownloadIcon size={12} />
                <span>EXPORT_CSV</span>
              </button>

              <button
                type="button"
                onClick={onTriggerSync}
                disabled={syncStatus.isSyncing || !hasToken}
                className={`btn-tactical ${hasToken ? 'btn-tactical-hazard' : ''}`}
                title="Poll GitHub API for latest commits & PRs"
              >
                <RefreshIcon size={12} spinning={syncStatus.isSyncing} />
                <span>{syncStatus.isSyncing ? 'SYNCING...' : 'RE-INDEX'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleTheme}
                className="btn-tactical"
                title={theme === 'dark' ? "Switch to Swiss Industrial Print (Light Mode)" : "Switch to Tactical Telemetry (Dark Mode)"}
              >
                <span>{theme === 'dark' ? '[THEME: LIGHT]' : '[THEME: DARK]'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                className="btn-tactical"
                title="System Configuration"
              >
                <SettingsIcon size={12} />
                <span>CONFIG</span>
              </button>
            </div>
          </div>
        </div>

        {/* Telemetry Status Register */}
        <div className="telemetry-register-bar">
          <div className="register-item">
            <span className="reg-key">STATUS:</span>
            <span className="reg-val">{hasToken ? 'CONNECTED_TO_ENDPOINT' : 'TOKEN_REQUIRED'}</span>
          </div>
          <div className="register-item">
            <span className="reg-key">LAST_POLL:</span>
            <span className="reg-val font-mono">
              {syncStatus.lastSyncedAt
                ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString()
                : 'STANDBY'}
            </span>
          </div>
          {syncStatus.rateLimitRemaining !== null && (
            <div className="register-item">
              <span className="reg-key">API_QUOTA_REGISTER:</span>
              <span className="reg-val font-mono quota-highlight">
                {syncStatus.rateLimitRemaining} / 5000 CALLS
              </span>
            </div>
          )}
          {excludedCount > 0 && (
            <div className="register-item">
              <span className="reg-key">FILTER_EXCLUSIONS:</span>
              <span className="reg-val font-mono quota-highlight">
                [{excludedCount} REPOS EXCLUDED]
              </span>
            </div>
          )}
          {!hasToken && (
            <div className="register-item alert-register">
              <span className="alert-blink">!</span>
              <span>PAT_KEY_MISSING // ACCESS_RESTRICTED</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .header-tactical {
          background: var(--bg-panel);
          border-bottom: 2px solid var(--border-tactical);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .header-body {
          padding: 1.25rem 0 1rem 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1.5rem;
        }
        .telemetry-identity {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .unit-id-box {
          background: var(--bg-crt);
          border: 1px solid var(--border-bright);
          padding: 0.35rem 0.6rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .unit-label {
          font-size: 0.55rem;
          color: var(--text-dim);
          letter-spacing: 0.1em;
        }
        .unit-val {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--accent-hazard);
        }
        .org-heading-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .title-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .org-macro-name {
          font-size: 1.6rem;
          color: var(--text-phosphor);
          letter-spacing: -0.02em;
        }
        .tactical-tag {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border: 1px solid var(--border-bright);
          background: var(--bg-crt);
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .tag-private {
          color: var(--text-dim);
        }
        .tag-unconfigured {
          color: var(--accent-hazard);
          border-color: var(--accent-hazard);
        }
        .radar-square-offline {
          width: 6px;
          height: 6px;
          background: var(--accent-hazard);
        }
        .tag-live {
          color: var(--accent-radar);
          border-color: var(--accent-radar);
        }
        .radar-square {
          width: 6px;
          height: 6px;
          background: var(--accent-radar);
        }
        .org-telemetry-sub {
          font-size: 0.68rem;
          color: var(--text-dim);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .sub-sep {
          color: var(--text-ghost);
        }
        .telemetry-controls {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          flex-wrap: wrap;
        }
        .time-filter-track {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 0.25rem 0.5rem;
        }
        .filter-label {
          font-size: 0.65rem;
          color: var(--text-dim);
          margin-right: 0.25rem;
        }
        .time-bracket-btn {
          background: transparent;
          border: none;
          color: var(--text-dim);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
          padding: 0.2rem 0.4rem;
        }
        .time-bracket-btn:hover {
          color: var(--text-phosphor);
        }
        .time-bracket-btn.active {
          background: var(--text-phosphor);
          color: var(--bg-crt);
        }
        .tactical-actions-grid {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .telemetry-register-bar {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          border-top: 1px solid var(--border-tactical);
          padding: 0.5rem 0;
          font-size: 0.68rem;
          color: var(--text-dim);
          flex-wrap: wrap;
        }
        .register-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .reg-key {
          color: var(--text-ghost);
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .reg-val {
          color: var(--text-phosphor);
        }
        .quota-highlight {
          color: var(--accent-radar);
        }
        .alert-register {
          color: var(--accent-hazard);
          margin-left: auto;
        }
        .alert-blink {
          font-weight: 900;
          animation: blink 1s step-start infinite;
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
        @media (max-width: 960px) {
          .header-body {
            flex-direction: column;
            align-items: flex-start;
          }
          .telemetry-controls {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </header>
  );
};
