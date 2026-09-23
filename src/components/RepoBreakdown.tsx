import React, { useState } from 'react';
import { RepositorySummary } from '../types';
import { LockIcon } from './Icons';

interface RepoBreakdownProps {
  repositories: RepositorySummary[];
}

export const RepoBreakdown: React.FC<RepoBreakdownProps> = ({ repositories }) => {
  const [filterLang, setFilterLang] = useState<string>('all');

  const languages = Array.from(
    new Set(repositories.map((r) => r.language).filter(Boolean) as string[])
  );

  const filteredRepos = repositories.filter((r) => {
    if (filterLang === 'all') return true;
    return r.language === filterLang;
  });

  return (
    <section className="repos-tactical">
      <div className="section-telemetry-header">
        <span className="telemetry-eyebrow">INVENTORY // PRIVATE_REPOSITORIES_MANIFEST</span>
        <span className="telemetry-serial font-mono">SECTOR: CLASSIFIED_CODEBASES</span>
      </div>

      <div className="repos-controls-row font-mono">
        <div className="repos-title-block">
          <h2 className="macro-title repos-heading">Repository Directory</h2>
          <span className="repos-sub">[ SEC_CLASS: PRIVATE // INGRESS: REST_V3 ]</span>
        </div>

        {languages.length > 0 && (
          <div className="lang-filter-bar">
            <button
              type="button"
              onClick={() => setFilterLang('all')}
              className={`lang-tactical-btn ${filterLang === 'all' ? 'active' : ''}`}
            >
              [ALL: {repositories.length}]
            </button>
            {languages.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setFilterLang(lang)}
                className={`lang-tactical-btn ${filterLang === lang ? 'active' : ''}`}
              >
                [{lang.toUpperCase()}]
              </button>
            ))}
          </div>
        )}
      </div>

      {filteredRepos.length === 0 ? (
        <div className="tactical-empty-box with-crosshairs font-mono">
          <p className="empty-title">[ STANDBY // NO_REPOSITORIES_INDEXED ]</p>
          <p className="empty-desc">CONFIGURE GITHUB PERSONAL ACCESS TOKEN TO ENUMERATE AND MONITOR ORGANIZATION REPOSITORIES.</p>
        </div>
      ) : (
        <div className="tactical-grid repos-matrix-grid with-crosshairs font-mono">
          {filteredRepos.map((repo) => (
            <div key={repo.name} className="tactical-cell repo-module">
              <div className="repo-module-top">
                <div className="repo-name-group">
                  <span className="repo-macro-name">{repo.name}</span>
                  {repo.isPrivate && (
                    <span className="repo-private-tag">
                      <LockIcon size={10} color="#888888" />
                      [RESTRICTED]
                    </span>
                  )}
                </div>
                {repo.language && (
                  <span className="repo-lang-tag">
                    [STACK: {repo.language.toUpperCase()}]
                  </span>
                )}
              </div>

              <p className="repo-desc-text">
                {repo.description || 'NO SPECIFICATION PROVIDED IN REPO METADATA.'}
              </p>

              <div className="repo-telemetry-payload">
                <div className="payload-stat">
                  <span className="payload-label">COMMITS:</span>
                  <span className="payload-value">{repo.commitsCount}</span>
                </div>
                <div className="payload-stat">
                  <span className="payload-label">PRS:</span>
                  <span className="payload-value">{repo.prsCount}</span>
                </div>
              </div>

              {repo.topContributors.length > 0 && (
                <div className="repo-maintainers-manifest">
                  <span className="manifest-title">CORE_OPERATIVES:</span>
                  <div className="maintainers-cluster">
                    {repo.topContributors.map((c) => (
                      <span key={c.login} className="maintainer-code">
                        @{c.login} [{c.commits}]
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .tactical-empty-box {
          background: var(--bg-panel);
          border: 1px dashed var(--border-tactical);
          padding: 3rem 2rem;
          text-align: center;
          margin-bottom: 2rem;
        }
        .empty-title {
          color: var(--accent-hazard);
          font-weight: 700;
          font-size: 0.95rem;
          margin: 0 0 0.5rem 0;
        }
        .empty-desc {
          color: var(--text-dim);
          font-size: 0.75rem;
          margin: 0;
        }
        .repos-tactical {
          margin-bottom: 4rem;
        }
        .repos-controls-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1.25rem;
          margin-bottom: 1.25rem;
        }
        .repos-title-block {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .repos-heading {
          font-size: 1.4rem;
          color: var(--text-phosphor);
        }
        .repos-sub {
          font-size: 0.68rem;
          color: var(--text-dim);
        }
        .lang-filter-bar {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          flex-wrap: wrap;
        }
        .lang-tactical-btn {
          background: var(--bg-panel);
          border: 1px solid var(--border-tactical);
          color: var(--text-dim);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.3rem 0.65rem;
          cursor: pointer;
        }
        .lang-tactical-btn:hover {
          color: var(--text-phosphor);
          border-color: var(--border-bright);
        }
        .lang-tactical-btn.active {
          background: var(--text-phosphor);
          color: var(--bg-crt);
        }
        .repos-matrix-grid {
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
        }
        .repo-module {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 1rem;
          border-top: 2px solid var(--border-bright);
        }
        .repo-module:hover {
          border-top-color: var(--accent-hazard);
          background: var(--bg-elevated);
        }
        .repo-module-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-tactical);
          padding-bottom: 0.5rem;
          gap: 0.5rem;
        }
        .repo-name-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .repo-macro-name {
          font-weight: 700;
          font-size: 1rem;
          color: var(--text-phosphor);
        }
        .repo-private-tag {
          font-size: 0.6rem;
          color: var(--text-dim);
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }
        .repo-lang-tag {
          font-size: 0.65rem;
          color: var(--accent-hazard);
          font-weight: 700;
        }
        .repo-desc-text {
          font-size: 0.75rem;
          color: var(--text-dim);
          line-height: 1.45;
          min-height: 2.2rem;
        }
        .repo-telemetry-payload {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 0.5rem 0.85rem;
        }
        .payload-stat {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.72rem;
        }
        .payload-label {
          color: var(--text-dim);
        }
        .payload-value {
          color: var(--text-phosphor);
          font-weight: 700;
        }
        .repo-maintainers-manifest {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          border-top: 1px solid var(--border-tactical);
          padding-top: 0.5rem;
        }
        .manifest-title {
          font-size: 0.6rem;
          color: var(--text-ghost);
        }
        .maintainers-cluster {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .maintainer-code {
          font-size: 0.68rem;
          color: var(--text-phosphor);
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 0.15rem 0.45rem;
        }

        @media (max-width: 768px) {
          .repos-tactical {
            margin-bottom: 2rem;
          }
          .repos-matrix-grid {
            grid-template-columns: 1fr;
          }
          .repo-telemetry-payload {
            flex-wrap: wrap;
            gap: 0.75rem;
          }
          .repos-controls-row {
            gap: 0.75rem;
          }
        }
      `}</style>
    </section>
  );
};
