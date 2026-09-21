import React, { useState, useRef, useEffect } from 'react';

interface RepoFilterDropdownProps {
  allRepoNames: string[];
  excludedRepos: string[];
  onToggleRepo: (repoName: string) => void;
  onIncludeAll: () => void;
  onExcludeAll: () => void;
}

export const RepoFilterDropdown: React.FC<RepoFilterDropdownProps> = ({
  allRepoNames,
  excludedRepos,
  onToggleRepo,
  onIncludeAll,
  onExcludeAll
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const excludedSet = new Set(excludedRepos.map((r) => r.trim().toLowerCase()));
  const excludedCount = excludedSet.size;
  const activeCount = allRepoNames.length - excludedCount;

  // Close on outside click (desktop)
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Lock background scroll when drawer is open on mobile
  useEffect(() => {
    if (isOpen && window.innerWidth <= 640) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    setSearch('');
  };

  const filteredNames = allRepoNames.filter((name) =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  if (allRepoNames.length === 0) return null;

  return (
    <div className="repo-filter-container" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`btn-tactical ${excludedCount > 0 ? 'btn-tactical-hazard' : ''}`}
        title="Filter repositories"
      >
        <span>FILTER_REPOS</span>
        {excludedCount > 0 && (
          <span className="filter-badge">{excludedCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="rfd-backdrop"
            onClick={handleClose}
            aria-hidden="true"
          />

          <div className="repo-filter-dropdown" role="dialog" aria-label="Filter repositories">
            <div className="rfd-header">
              <div className="rfd-header-meta">
                <span className="rfd-title">[ REPO_FILTER ]</span>
                <span className="rfd-count">{activeCount}/{allRepoNames.length} ACTIVE</span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rfd-close-btn"
                title="Close"
                aria-label="Close"
              >
                [✕]
              </button>
            </div>

            <div className="rfd-search-row">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="SEARCH_REPOS..."
                className="rfd-search-input"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="rfd-search-clear"
                  title="Clear search"
                >
                  [✕]
                </button>
              )}
            </div>

            <div className="rfd-bulk-actions">
              <button
                type="button"
                onClick={onIncludeAll}
                className="rfd-bulk-btn"
              >
                [SELECT_ALL]
              </button>
              <button
                type="button"
                onClick={onExcludeAll}
                className="rfd-bulk-btn"
              >
                [CLEAR_ALL]
              </button>
            </div>

            <div className="rfd-list">
              {filteredNames.map((name) => {
                const isExcluded = excludedSet.has(name.toLowerCase());
                return (
                  <label
                    key={name}
                    className={`rfd-item ${isExcluded ? 'rfd-item-excluded' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={!isExcluded}
                      onChange={() => onToggleRepo(name)}
                      className="rfd-checkbox"
                    />
                    <span className="rfd-repo-name">{name}</span>
                    {isExcluded && <span className="rfd-excluded-tag">EXCLUDED</span>}
                  </label>
                );
              })}
              {filteredNames.length === 0 && (
                <div className="rfd-empty">NO_MATCH</div>
              )}
            </div>

            {/* Mobile bottom confirm action */}
            <div className="rfd-mobile-actions">
              <button
                type="button"
                onClick={handleClose}
                className="rfd-mobile-apply-btn"
              >
                [ APPLY_FILTER ({activeCount}/{allRepoNames.length}) ]
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        .repo-filter-container {
          position: relative;
          display: inline-flex;
        }
        .filter-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-hazard);
          color: #ffffff !important;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          font-weight: 900;
          padding: 0 0.35rem;
          margin-left: 0.35rem;
          min-width: 1.25rem;
          height: 1.25rem;
          line-height: 1;
          text-align: center;
          letter-spacing: 0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
          flex-shrink: 0;
        }
        .btn-tactical:hover .filter-badge {
          background: #ffffff;
          color: var(--accent-hazard) !important;
        }
        .rfd-backdrop {
          display: none;
        }
        .repo-filter-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          width: 300px;
          max-height: 440px;
          background: var(--bg-panel);
          border: 1px solid var(--border-tactical);
          z-index: 200;
          display: flex;
          flex-direction: column;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          box-shadow: 0 4px 24px rgba(0,0,0,0.5);
        }
        .rfd-header {
          padding: 0.65rem 0.75rem;
          border-bottom: 1px solid var(--border-tactical);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-crt);
        }
        .rfd-header-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .rfd-title {
          color: var(--accent-hazard);
          font-weight: 700;
          font-size: 0.68rem;
        }
        .rfd-count {
          color: var(--text-dim);
          font-size: 0.62rem;
        }
        .rfd-close-btn {
          background: transparent;
          border: none;
          color: var(--text-ghost);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          cursor: pointer;
          padding: 0.2rem 0.4rem;
          line-height: 1;
        }
        .rfd-close-btn:hover {
          color: var(--accent-hazard);
        }
        .rfd-search-row {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid var(--border-tactical);
          position: relative;
          display: flex;
          align-items: center;
        }
        .rfd-search-input {
          width: 100%;
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          color: var(--text-phosphor);
          font-family: var(--font-mono);
          font-size: 0.7rem;
          padding: 0.45rem 0.55rem;
          outline: none;
        }
        .rfd-search-input::placeholder {
          color: var(--text-ghost);
        }
        .rfd-search-input:focus {
          border-color: var(--accent-hazard);
        }
        .rfd-search-clear {
          position: absolute;
          right: 1.1rem;
          background: transparent;
          border: none;
          color: var(--text-ghost);
          font-family: var(--font-mono);
          font-size: 0.7rem;
          cursor: pointer;
        }
        .rfd-search-clear:hover {
          color: var(--accent-hazard);
        }
        .rfd-bulk-actions {
          padding: 0.4rem 0.75rem;
          border-bottom: 1px solid var(--border-tactical);
          display: flex;
          gap: 0.5rem;
        }
        .rfd-bulk-btn {
          background: transparent;
          border: 1px solid var(--border-tactical);
          color: var(--text-dim);
          font-family: var(--font-mono);
          font-size: 0.62rem;
          padding: 0.3rem 0.5rem;
          cursor: pointer;
          flex: 1;
          text-align: center;
        }
        .rfd-bulk-btn:hover {
          color: var(--accent-hazard);
          border-color: var(--accent-hazard);
        }
        .rfd-list {
          overflow-y: auto;
          max-height: 280px;
          padding: 0.25rem 0;
          -webkit-overflow-scrolling: touch;
        }
        .rfd-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.45rem 0.75rem;
          cursor: pointer;
          transition: background 0.1s;
        }
        .rfd-item:hover {
          background: rgba(255,255,255,0.04);
        }
        .rfd-item-excluded {
          opacity: 0.5;
        }
        .rfd-checkbox {
          appearance: none;
          width: 14px;
          height: 14px;
          border: 1px solid var(--border-tactical);
          background: var(--bg-cell);
          cursor: pointer;
          flex-shrink: 0;
          position: relative;
        }
        .rfd-checkbox:checked {
          background: var(--accent-radar);
          border-color: var(--accent-radar);
        }
        .rfd-checkbox:checked::after {
          content: '';
          position: absolute;
          top: 1px;
          left: 4px;
          width: 4px;
          height: 7px;
          border: solid var(--bg-crt);
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }
        .rfd-repo-name {
          color: var(--text-phosphor);
          font-size: 0.7rem;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .rfd-excluded-tag {
          color: var(--accent-hazard);
          font-size: 0.55rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .rfd-empty {
          padding: 1.25rem 0.75rem;
          color: var(--text-ghost);
          text-align: center;
          font-size: 0.68rem;
        }
        .rfd-mobile-actions {
          display: none;
        }

        /* Mobile Viewport Optimization (<= 640px) */
        @media (max-width: 640px) {
          .rfd-backdrop {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(2px);
            z-index: 998;
          }
          .repo-filter-dropdown {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            max-width: 100vw;
            max-height: 82vh;
            z-index: 999;
            border-top: 2px solid var(--accent-hazard);
            border-left: none;
            border-right: none;
            border-bottom: none;
            box-shadow: 0 -8px 36px rgba(0, 0, 0, 0.85);
            animation: rfdSlideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          }
          @keyframes rfdSlideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          .rfd-header {
            padding: 0.85rem 1rem;
          }
          .rfd-title {
            font-size: 0.75rem;
          }
          .rfd-count {
            font-size: 0.68rem;
          }
          .rfd-close-btn {
            font-size: 0.9rem;
            padding: 0.3rem 0.6rem;
          }
          .rfd-search-row {
            padding: 0.65rem 1rem;
          }
          .rfd-search-input {
            font-size: 16px; /* Prevents iOS auto-zoom */
            padding: 0.6rem 0.75rem;
          }
          .rfd-search-clear {
            right: 1.4rem;
            font-size: 0.85rem;
          }
          .rfd-bulk-actions {
            padding: 0.5rem 1rem;
            gap: 0.75rem;
          }
          .rfd-bulk-btn {
            font-size: 0.7rem;
            padding: 0.5rem 0.75rem;
            min-height: 38px;
          }
          .rfd-list {
            max-height: calc(82vh - 220px);
            padding: 0.35rem 0;
          }
          .rfd-item {
            padding: 0.75rem 1rem;
            min-height: 44px; /* Accessible touch target */
            gap: 0.75rem;
          }
          .rfd-checkbox {
            width: 18px;
            height: 18px;
          }
          .rfd-checkbox:checked::after {
            top: 2px;
            left: 5px;
            width: 5px;
            height: 9px;
            border-width: 0 2px 2px 0;
          }
          .rfd-repo-name {
            font-size: 0.78rem;
          }
          .rfd-mobile-actions {
            display: block;
            padding: 0.75rem 1rem;
            border-top: 1px solid var(--border-tactical);
            background: var(--bg-panel);
          }
          .rfd-mobile-apply-btn {
            width: 100%;
            background: var(--accent-hazard);
            color: #ffffff;
            border: 1px solid var(--accent-hazard);
            font-family: var(--font-mono);
            font-size: 0.75rem;
            font-weight: 800;
            letter-spacing: 0.05em;
            padding: 0.75rem 1rem;
            cursor: pointer;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};
