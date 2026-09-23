import React, { useState, useMemo } from 'react';
import { ContributorStats } from '../types';
import { ArrowUpRightIcon } from './Icons';

interface ContributorLeaderboardProps {
  contributors: ContributorStats[];
  onSelectContributor: (contributor: ContributorStats) => void;
}

type SortField = 'impactScore' | 'commitsCount' | 'prsMerged' | 'reviewsCount' | 'linesAdded' | 'activeDays';

export const ContributorLeaderboard: React.FC<ContributorLeaderboardProps> = ({
  contributors,
  onSelectContributor
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('impactScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const filteredAndSorted = useMemo(() => {
    return contributors
      .filter((c) => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
          c.login.toLowerCase().includes(query) ||
          c.name.toLowerCase().includes(query) ||
          c.repositories.some((r) => r.name.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (sortDirection === 'desc') {
          return valB > valA ? 1 : valB < valA ? -1 : 0;
        }
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      });
  }, [contributors, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getRoleTag = (role: string) => {
    switch (role) {
      case 'Owner':
        return <span className="tactical-role-tag role-owner">[ OWNER_LEAD ]</span>;
      case 'Admin':
        return <span className="tactical-role-tag role-admin">[ ADMIN_OPS ]</span>;
      case 'Member':
        return <span className="tactical-role-tag role-member">[ CORE_DEV ]</span>;
      default:
        return <span className="tactical-role-tag role-collab">[ EXT_COLLAB ]</span>;
    }
  };

  const renderRankCallsign = (rank: number) => {
    const formatted = rank < 10 ? `0${rank}` : `${rank}`;
    if (rank === 1) return `UNIT_#${formatted} // LEAD`;
    if (rank === 2) return `UNIT_#${formatted} // SECND`;
    if (rank === 3) return `UNIT_#${formatted} // THIRD`;
    return `UNIT_#${formatted}`;
  };

  return (
    <section className="leaderboard-tactical">
      <div className="section-telemetry-header">
        <span className="telemetry-eyebrow">PERSONNEL // CONTRIBUTOR_DOSSIER_INDEX</span>
        <span className="telemetry-serial font-mono">RECORDS: {filteredAndSorted.length} ENTRIES</span>
      </div>

      <div className="leaderboard-controls-bar">
        <div className="controls-left">
          <h2 className="macro-title leaderboard-heading">Contributor Registry</h2>
          <span className="leaderboard-sub font-mono">
            [ METRICS_INDEX: COMMITS // MERGED_PRS // PEER_AUDITS // CODE_DELTA ]
          </span>
        </div>

        <div className="controls-right font-mono">
          {/* Tactical Search Box */}
          <div className="tactical-search">
            <span className="search-prompt">&gt;</span>
            <input
              type="text"
              placeholder="SEARCH_OPERATIVE_OR_REPO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="tactical-input"
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

          {/* View Mode Switcher */}
          <div className="tactical-view-toggle">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
            >
              [TABULAR]
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
            >
              [MODULES]
            </button>
          </div>
        </div>
      </div>

      {filteredAndSorted.length === 0 ? (
        <div className="tactical-empty-box with-crosshairs font-mono">
          <p className="empty-title">[ ERROR // NO_MATCHING_RECORDS_FOUND ]</p>
          <p className="empty-desc">QUERY RETURNED ZERO MATCHES FOR THE SPECIFIED FILTER.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* Tactical Tabular Dossier */
        <div className="tactical-table-wrapper with-crosshairs font-mono">
          <table className="dossier-table">
            <thead>
              <tr>
                <th className="th-unit">UNIT_CALLSIGN</th>
                <th className="th-operative">OPERATIVE_ID</th>
                <th className="th-sortable" onClick={() => handleSort('impactScore')}>
                  IMPACT_IDX {sortField === 'impactScore' ? (sortDirection === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th className="th-sortable" onClick={() => handleSort('commitsCount')}>
                  COMMITS {sortField === 'commitsCount' ? (sortDirection === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th className="th-sortable" onClick={() => handleSort('prsMerged')}>
                  MERGED_PRS {sortField === 'prsMerged' ? (sortDirection === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th className="th-sortable" onClick={() => handleSort('reviewsCount')}>
                  AUDITS {sortField === 'reviewsCount' ? (sortDirection === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th className="th-sortable" onClick={() => handleSort('linesAdded')}>
                  LOC_DELTA {sortField === 'linesAdded' ? (sortDirection === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th className="th-repos">ASSIGNED_REPOS</th>
                <th className="th-action">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((c) => (
                <tr
                  key={c.login}
                  onClick={() => onSelectContributor(c)}
                  className={`dossier-row ${c.rank === 1 ? 'row-lead' : ''}`}
                >
                  <td className="td-unit">
                    <span className={`rank-callsign ${c.rank === 1 ? 'rank-lead-tag' : ''}`}>
                      {renderRankCallsign(c.rank)}
                    </span>
                  </td>
                  <td className="td-operative">
                    <div className="operative-profile">
                      <div className="operative-avatar-frame">
                        <img
                          src={c.avatarUrl}
                          alt={c.login}
                          className="operative-avatar-img"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.onerror = null;
                            target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.login)}&background=141414&color=fff`;
                          }}
                        />
                      </div>
                      <div className="operative-meta">
                        <div className="op-name-row">
                          <span className="op-name">{c.name}</span>
                          {getRoleTag(c.role)}
                        </div>
                        <span className="op-handle">@{c.login}</span>
                      </div>
                    </div>
                  </td>
                  <td className="td-impact">
                    <div className="impact-indicator">
                      <span className="impact-number">{c.impactScore}</span>
                      <div className="impact-ascii-bar">
                        <div
                          className="impact-ascii-fill"
                          style={{ width: `${Math.min(100, c.impactScore)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="td-num">
                    <span className="num-highlight">{c.commitsCount}</span>
                  </td>
                  <td className="td-num">
                    <span className="num-highlight">{c.prsMerged}</span>
                    <span className="num-denom">/{c.prsCreated}</span>
                  </td>
                  <td className="td-num">
                    <span className="num-highlight">{c.reviewsCount}</span>
                  </td>
                  <td className="td-churn">
                    <span className="churn-add-txt">+{c.linesAdded.toLocaleString()}</span>
                    <span className="churn-del-txt">-{c.linesDeleted.toLocaleString()}</span>
                  </td>
                  <td className="td-repos">
                    <div className="repo-cluster">
                      {c.repositories.slice(0, 2).map((r) => (
                        <span key={r.name} className="tactical-repo-chip">
                          {r.name} ({r.commits})
                        </span>
                      ))}
                      {c.repositories.length > 2 && (
                        <span className="tactical-repo-more">+{c.repositories.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="td-action">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectContributor(c);
                      }}
                      className="btn-tactical btn-row-inspect"
                    >
                      [DOSSIER]
                      <ArrowUpRightIcon size={10} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Tactical Modular Cards */
        <div className="tactical-modules-grid font-mono">
          {filteredAndSorted.map((c) => (
            <div
              key={c.login}
              className={`module-dossier-card with-crosshairs ${c.rank === 1 ? 'card-lead' : ''}`}
              onClick={() => onSelectContributor(c)}
            >
              <div className="card-top-strip">
                <span className="card-callsign">{renderRankCallsign(c.rank)}</span>
                {getRoleTag(c.role)}
              </div>

              <div className="card-identity-block">
                <div className="card-avatar-box">
                  <img
                    src={c.avatarUrl}
                    alt={c.login}
                    className="card-avatar-img"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.onerror = null;
                      target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.login)}&background=141414&color=fff`;
                    }}
                  />
                </div>
                <div className="card-person-details">
                  <span className="card-person-name">{c.name}</span>
                  <span className="card-person-handle">@{c.login}</span>
                </div>
              </div>

              <div className="card-score-telemetry">
                <div className="score-label-row">
                  <span>IMPACT_COEFFICIENT:</span>
                  <span className="score-val-large">{c.impactScore}</span>
                </div>
                <div className="card-score-track">
                  <div
                    className="card-score-bar"
                    style={{ width: `${Math.min(100, c.impactScore)}%` }}
                  />
                </div>
              </div>

              <div className="card-metrics-quartet">
                <div className="quartet-item">
                  <span className="q-label">COMMITS</span>
                  <span className="q-val">{c.commitsCount}</span>
                </div>
                <div className="quartet-item">
                  <span className="q-label">PRS_MERGED</span>
                  <span className="q-val">{c.prsMerged}</span>
                </div>
                <div className="quartet-item">
                  <span className="q-label">AUDITS</span>
                  <span className="q-val">{c.reviewsCount}</span>
                </div>
                <div className="quartet-item">
                  <span className="q-label">ACTIVE_D</span>
                  <span className="q-val">{c.activeDays}</span>
                </div>
              </div>

              <div className="card-repos-manifest">
                <span className="manifest-label">PRIMARY_REPOS:</span>
                <div className="manifest-list">
                  {c.repositories.slice(0, 3).map((r) => (
                    <span key={r.name} className="manifest-chip">
                      {r.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card-action-bar">
                <span className="inspect-prompt">&gt;&gt;&gt; CLICK TO DECLASSIFY FULL PROFILE</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .leaderboard-tactical {
          margin-bottom: 3.5rem;
        }
        .leaderboard-controls-bar {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1.5rem;
          margin-bottom: 1.25rem;
        }
        .controls-left {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .leaderboard-heading {
          font-size: 1.4rem;
          color: var(--text-phosphor);
        }
        .leaderboard-sub {
          font-size: 0.68rem;
          color: var(--text-dim);
        }
        .controls-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .tactical-search {
          display: flex;
          align-items: center;
          background: var(--bg-panel);
          border: 1px solid var(--border-bright);
          padding: 0.4rem 0.65rem;
          gap: 0.45rem;
          width: 290px;
        }
        .search-prompt {
          color: var(--accent-hazard);
          font-weight: 700;
        }
        .tactical-input {
          background: transparent;
          border: none;
          color: var(--text-phosphor);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          outline: none;
          width: 100%;
        }
        .tactical-input::placeholder {
          color: var(--text-ghost);
        }
        .tactical-search-clear {
          background: transparent;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          font-size: 0.75rem;
        }
        .tactical-view-toggle {
          display: flex;
          gap: 2px;
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 2px;
        }
        .view-btn {
          background: transparent;
          border: none;
          color: var(--text-dim);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.35rem 0.65rem;
          cursor: pointer;
        }
        .view-btn.active {
          background: var(--text-phosphor);
          color: var(--bg-crt);
        }

        /* Tabular Layout */
        .tactical-table-wrapper {
          background: var(--bg-panel);
          border: 1px solid var(--border-tactical);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .dossier-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.75rem;
        }
        .dossier-table th {
          background: var(--bg-crt);
          padding: 0.75rem 1rem;
          color: var(--text-dim);
          font-weight: 700;
          letter-spacing: 0.08em;
          border-bottom: 2px solid var(--border-tactical);
          user-select: none;
        }
        .th-sortable {
          cursor: pointer;
        }
        .th-sortable:hover {
          color: var(--text-phosphor);
        }
        .dossier-row {
          border-bottom: 1px solid var(--border-tactical);
          cursor: pointer;
        }
        .dossier-row:hover {
          background: var(--bg-elevated);
        }
        .row-lead {
          border-left: 3px solid var(--accent-hazard);
        }
        .dossier-table td {
          padding: 0.85rem 1rem;
        }
        .rank-callsign {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-dim);
        }
        .rank-lead-tag {
          color: var(--accent-hazard);
          font-weight: 900;
        }
        .operative-profile {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .operative-avatar-frame {
          width: 2rem;
          height: 2rem;
          border: 1px solid var(--border-bright);
          background: #000;
        }
        .operative-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .operative-meta {
          display: flex;
          flex-direction: column;
        }
        .op-name-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .op-name {
          font-weight: 700;
          color: var(--text-phosphor);
        }
        .op-handle {
          font-size: 0.68rem;
          color: var(--text-dim);
        }
        .tactical-role-tag {
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        .role-owner { color: var(--accent-hazard); }
        .role-admin { color: var(--text-phosphor); }
        .role-member { color: var(--text-dim); }
        .role-collab { color: var(--accent-radar); }

        .impact-indicator {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          width: 80px;
        }
        .impact-number {
          font-weight: 700;
          color: var(--text-phosphor);
        }
        .impact-ascii-bar {
          width: 100%;
          height: 3px;
          background: #222;
        }
        .impact-ascii-fill {
          height: 100%;
          background: var(--text-phosphor);
        }
        .num-highlight {
          font-weight: 700;
          color: var(--text-phosphor);
        }
        .num-denom {
          color: var(--text-ghost);
          font-size: 0.65rem;
        }
        .churn-add-txt {
          display: block;
          color: var(--accent-radar);
          font-size: 0.7rem;
        }
        .churn-del-txt {
          display: block;
          color: var(--accent-hazard);
          font-size: 0.7rem;
        }
        .repo-cluster {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }
        .tactical-repo-chip {
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 0.15rem 0.4rem;
          font-size: 0.65rem;
          color: var(--text-dim);
        }
        .tactical-repo-more {
          font-size: 0.65rem;
          color: var(--text-ghost);
        }
        .btn-row-inspect {
          padding: 0.3rem 0.6rem;
          font-size: 0.68rem;
        }

        /* Modules Grid View */
        .tactical-modules-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 1.25rem;
        }
        .module-dossier-card {
          background: var(--bg-panel);
          border: 1px solid var(--border-tactical);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          cursor: pointer;
        }
        .module-dossier-card:hover {
          border-color: var(--border-bright);
          background: var(--bg-elevated);
        }
        .card-lead {
          border-top: 3px solid var(--accent-hazard);
        }
        .card-top-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-tactical);
          padding-bottom: 0.5rem;
        }
        .card-callsign {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--text-dim);
        }
        .card-identity-block {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }
        .card-avatar-box {
          width: 3rem;
          height: 3rem;
          border: 1px solid var(--border-bright);
          background: #000;
        }
        .card-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .card-person-details {
          display: flex;
          flex-direction: column;
        }
        .card-person-name {
          font-weight: 700;
          font-size: 1rem;
          color: var(--text-phosphor);
        }
        .card-person-handle {
          font-size: 0.72rem;
          color: var(--text-dim);
        }
        .card-score-telemetry {
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .score-label-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          font-size: 0.68rem;
          color: var(--text-dim);
        }
        .score-val-large {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-phosphor);
        }
        .card-score-track {
          width: 100%;
          height: 4px;
          background: #222;
        }
        .card-score-bar {
          height: 100%;
          background: var(--accent-hazard);
        }
        .card-metrics-quartet {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: var(--border-tactical);
          border: 1px solid var(--border-tactical);
          text-align: center;
        }
        .quartet-item {
          background: var(--bg-panel);
          padding: 0.6rem 0.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .q-label {
          font-size: 0.55rem;
          color: var(--text-dim);
          letter-spacing: 0.05em;
        }
        .q-val {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-phosphor);
        }
        .card-repos-manifest {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .manifest-label {
          font-size: 0.6rem;
          color: var(--text-dim);
        }
        .manifest-list {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }
        .manifest-chip {
          font-size: 0.65rem;
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 0.15rem 0.4rem;
          color: var(--text-dim);
        }
        .card-action-bar {
          border-top: 1px solid var(--border-tactical);
          padding-top: 0.6rem;
        }
        .inspect-prompt {
          font-size: 0.65rem;
          color: var(--accent-hazard);
          letter-spacing: 0.05em;
        }

        .tactical-empty-box {
          background: var(--bg-panel);
          border: 1px solid var(--border-tactical);
          padding: 3rem 2rem;
          text-align: center;
        }
        .empty-title {
          font-weight: 700;
          color: var(--accent-hazard);
        }
        .empty-desc {
          font-size: 0.72rem;
          color: var(--text-dim);
          margin-top: 0.5rem;
        }

        @media (max-width: 768px) {
          .tactical-modules-grid {
            grid-template-columns: 1fr;
          }
          .tactical-table-wrapper {
            width: 100%;
            max-width: 100%;
            min-width: 0;
          }
          .leaderboard-controls-bar {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }
          .controls-right {
            width: 100%;
            flex-direction: column;
            gap: 0.5rem;
          }
          .tactical-search {
            width: 100%;
          }
          .tactical-view-toggle {
            width: 100%;
            display: flex;
          }
          .view-btn {
            flex: 1;
            text-align: center;
          }
        }
      `}</style>
    </section>
  );
};
