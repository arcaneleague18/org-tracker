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

  // Close on outside click
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
        <div className="repo-filter-dropdown">
          <div className="rfd-header">
            <span className="rfd-title">[ REPO_FILTER ]</span>
            <span className="rfd-count">{activeCount}/{allRepoNames.length} ACTIVE</span>
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
        </div>
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
        }
        .btn-tactical:hover .filter-badge {
          background: #ffffff;
          color: var(--accent-hazard) !important;
        }
        .repo-filter-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          width: 280px;
          max-height: 420px;
          background: var(--bg-panel);
          border: 1px solid var(--border-tactical);
          z-index: 200;
          display: flex;
          flex-direction: column;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          box-shadow: 0 4px 24px rgba(0,0,0,0.4);
        }
        .rfd-header {
          padding: 0.65rem 0.75rem;
          border-bottom: 1px solid var(--border-tactical);
          display: flex;
          align-items: center;
          justify-content: space-between;
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
        .rfd-search-row {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid var(--border-tactical);
        }
        .rfd-search-input {
          width: 100%;
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          color: var(--text-phosphor);
          font-family: var(--font-mono);
          font-size: 0.68rem;
          padding: 0.4rem 0.5rem;
          outline: none;
        }
        .rfd-search-input::placeholder {
          color: var(--text-ghost);
        }
        .rfd-search-input:focus {
          border-color: var(--accent-hazard);
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
          font-size: 0.6rem;
          padding: 0.25rem 0.5rem;
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
        }
        .rfd-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.75rem;
          cursor: pointer;
          transition: background 0.1s;
        }
        .rfd-item:hover {
          background: rgba(255,255,255,0.03);
        }
        .rfd-item-excluded {
          opacity: 0.5;
        }
        .rfd-checkbox {
          appearance: none;
          width: 12px;
          height: 12px;
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
          left: 3px;
          width: 4px;
          height: 7px;
          border: solid var(--bg-crt);
          border-width: 0 1.5px 1.5px 0;
          transform: rotate(45deg);
        }
        .rfd-repo-name {
          color: var(--text-phosphor);
          font-size: 0.68rem;
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
          padding: 1rem 0.75rem;
          color: var(--text-ghost);
          text-align: center;
          font-size: 0.65rem;
        }
      `}</style>
    </div>
  );
};
