import React, { useState } from 'react';
import { GitHubCredentials } from '../types';
import { githubApi, RateLimitStatus } from '../services/githubApi';
import { cacheService } from '../services/cacheService';
import { RefreshIcon } from './Icons';

interface SettingsModalProps {
  initialCredentials: GitHubCredentials;
  onSave: (credentials: GitHubCredentials) => void;
  onClear: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  initialCredentials,
  onSave,
  onClear,
  onClose
}) => {
  const [tokenOverride, setTokenOverride] = useState(() => cacheService.getOverrideToken());
  const [org, setOrg] = useState(initialCredentials.org || 'Move2Move');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    userLogin?: string;
    orgName?: string;
    rateLimit?: RateLimitStatus | null;
    error?: string;
    tokenSource?: 'override' | 'server';
  } | null>(null);

  const handleTestConnection = async () => {
    if (!org.trim()) {
      setTestResult({ success: false, error: 'ORG_SLUG_REQUIRED: SPECIFY TARGET GITHUB ORGANIZATION.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await githubApi.testConnection(tokenOverride.trim() || undefined, org.trim());
      setTestResult({
        success: true,
        userLogin: res.userLogin,
        orgName: res.orgName,
        rateLimit: res.rateLimit,
        tokenSource: tokenOverride.trim() ? 'override' : 'server'
      });
    } catch (err: unknown) {
      const e = err as Error;
      setTestResult({
        success: false,
        error: e.message || 'CONNECTION_HANDSHAKE_FAILED.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSave({
      token: tokenOverride.trim(),
      org: org.trim()
    });
    onClose();
  };

  const handleClear = () => {
    setTokenOverride('');
    cacheService.clearTokenOverride();
    setTestResult(null);
    onClear();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog-tactical with-crosshairs font-mono" onClick={(e) => e.stopPropagation()}>
        <div className="hazard-stripe" />
        <div className="settings-inner">
          <div className="settings-header">
            <div>
              <span className="telemetry-eyebrow">SYSTEM // CONFIGURATION</span>
              <h3 className="macro-title settings-title">System Configuration</h3>
              <p className="settings-desc">
                [ ACCESS_PROTOCOL: GITHUB_REST_V3 // SECURE_PROXY ]
              </p>
            </div>
            <button type="button" onClick={onClose} className="btn-tactical btn-close">
              [ESC / CLOSE]
            </button>
          </div>

          <div className="settings-body">
            {/* Security Directive */}
            <div className="security-dossier-callout">
              <span className="sec-tag">[ SEC_DIRECTIVE // ZERO_BUNDLE_CREDENTIALS ]</span>
              <p className="sec-text">
                SERVER PROXY ROUTE (/api/github) SECURES TELEMETRY IN THE CLOUD. NO GITHUB PAT IS EVER BUNDLED INTO CLIENT JAVASCRIPT ASSETS OR EXPOSED IN NETWORK HEADERS.
              </p>
            </div>

            {/* Input Groups */}
            <div className="tactical-field-group">
              <label className="field-label" htmlFor="org-slug">
                [ TARGET_ORGANIZATION_SLUG ]
              </label>
              <input
                id="org-slug"
                type="text"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="Move2Move"
                className="tactical-text-input"
              />
              <span className="field-help">ORGANIZATION SLUG IN GITHUB.COM/Move2Move</span>
            </div>

            <div className="tactical-field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="pat-token">
                  [ GITHUB_PERSONAL_ACCESS_TOKEN ]
                </label>
                {tokenOverride.trim() ? (
                  <span className="env-badge font-mono" style={{ borderColor: 'var(--accent-hazard)', color: 'var(--accent-hazard)' }}>
                    [LOCAL OVERRIDE ACTIVE]
                  </span>
                ) : (
                  <span className="env-badge font-mono" style={{ borderColor: 'var(--accent-radar)', color: 'var(--accent-radar)' }}>
                    [SERVER PROXY ACTIVE]
                  </span>
                )}
              </div>
              <input
                id="pat-token"
                type="password"
                value={tokenOverride}
                onChange={(e) => setTokenOverride(e.target.value)}
                placeholder="Using secure server proxy token (or enter personal override)"
                className="tactical-text-input"
              />
              <div className="field-help-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="field-help">
                  {tokenOverride.trim() ? (
                    <>PERSONAL OVERRIDE ACTIVE IN THIS BROWSER (STORED LOCALLY, NEVER BUNDLED).</>
                  ) : (
                    <>SECURE PROXY ACTIVE VIA <code>/api/github</code> (USING SERVER <code>GITHUB_TOKEN</code>). INPUT VALUE ONLY TO OVERRIDE.</>
                  )}
                </span>
                {tokenOverride.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setTokenOverride('');
                      cacheService.clearTokenOverride();
                    }}
                    className="btn-tactical"
                    style={{ fontSize: '0.62rem', padding: '0.15rem 0.45rem', whiteSpace: 'nowrap' }}
                    title="Remove local override and use server proxy"
                  >
                    [REVERT TO SERVER PROXY]
                  </button>
                )}
              </div>
            </div>

            {/* Protocol Manual */}
            <div className="protocol-manual-box">
              <span className="manual-title">// CREDENTIAL_SECURITY_PROCEDURE:</span>
              <ol className="manual-steps">
                <li>PRODUCTION HOSTING: SET <code>GITHUB_TOKEN</code> IN VERCEL ENVIRONMENT VARIABLES (DO NOT USE VITE_ PREFIX).</li>
                <li>LEAST PRIVILEGE: RECOMMENDED FINE-GRAINED TOKEN WITH READ-ONLY REPO CONTENTS & METADATA.</li>
                <li>CLASSIC PRIVILEGES: [X] <strong>repo</strong> (PRIVATE REPOS), [X] <strong>read:org</strong>.</li>
                <li>SAML_SSO ENFORCEMENT: IF MOVE2MOVE HAS SAML ENABLED, CLICK CONFIGURE SSO AND AUTHORIZE TOKEN.</li>
              </ol>
            </div>

            {/* Handshake Result */}
            {testResult && (
              <div className={`handshake-feedback ${testResult.success ? 'feedback-ok' : 'feedback-err'}`}>
                {testResult.success ? (
                  <div>
                    <span className="feedback-hdr">[ HANDSHAKE: SUCCESSFUL ]</span>
                    <p className="feedback-sub">
                      AUTHENTICATED AS: @{testResult.userLogin} // ORG: {testResult.orgName} // ROUTE: {testResult.tokenSource === 'override' ? 'LOCAL_OVERRIDE' : 'SERVER_PROXY'}
                      {testResult.rateLimit && (
                        <span> // QUOTA_REMAINING: {testResult.rateLimit.remaining} / {testResult.rateLimit.limit} CALLS</span>
                      )}
                    </p>
                  </div>
                ) : (
                  <div>
                    <span className="feedback-hdr">[ HANDSHAKE: FAILED ]</span>
                    <p className="feedback-sub">{testResult.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="settings-footer">
            {tokenOverride.trim() ? (
              <button
                type="button"
                onClick={handleClear}
                className="btn-tactical btn-tactical-hazard"
                title="Remove local override and use server proxy"
              >
                [CLEAR_OVERRIDE]
              </button>
            ) : (
              <div />
            )}

            <div className="footer-actions-right">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !org.trim()}
                className="btn-tactical"
              >
                <RefreshIcon size={12} spinning={isTesting} />
                <span>{isTesting ? 'TESTING...' : '[TEST_HANDSHAKE]'}</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={!org.trim()}
                className="btn-tactical btn-tactical-hazard"
              >
                [SAVE_CONFIG]
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .settings-inner {
          padding: 1.5rem 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .settings-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-tactical);
          padding-bottom: 1rem;
        }
        .settings-title {
          font-size: 1.3rem;
          color: var(--text-phosphor);
          margin-top: 0.25rem;
        }
        .settings-desc {
          font-size: 0.68rem;
          color: var(--text-dim);
          margin-top: 0.25rem;
        }
        .settings-body {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .security-dossier-callout {
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          border-left-width: 3px;
          border-left-color: var(--accent-radar);
          padding: 0.75rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .sec-tag {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--accent-radar);
        }
        .sec-text {
          font-size: 0.68rem;
          color: var(--text-dim);
          line-height: 1.45;
        }
        .tactical-field-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .field-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .env-badge {
          font-size: 0.6rem;
          padding: 0.1rem 0.4rem;
          letter-spacing: 0.05em;
          border: 1px solid currentColor;
        }
        .field-label {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--text-phosphor);
        }
        .tactical-text-input {
          background: var(--bg-crt);
          border: 1px solid var(--border-bright);
          color: var(--text-phosphor);
          font-family: var(--font-mono);
          font-size: 0.8rem;
          padding: 0.65rem 0.85rem;
          outline: none;
        }
        .tactical-text-input:focus {
          border-color: var(--accent-hazard);
        }
        .field-help {
          font-size: 0.65rem;
          color: var(--text-dim);
        }
        .field-help code {
          background: #222;
          color: var(--accent-hazard);
          padding: 0.1rem 0.3rem;
        }
        .protocol-manual-box {
          background: var(--bg-crt);
          border: 1px solid var(--border-tactical);
          padding: 0.85rem 1rem;
          font-size: 0.68rem;
        }
        .manual-title {
          color: var(--text-dim);
          font-weight: 700;
          display: block;
          margin-bottom: 0.4rem;
        }
        .manual-steps {
          padding-left: 1.25rem;
          color: var(--text-dim);
          line-height: 1.6;
        }
        .manual-steps strong {
          color: var(--text-phosphor);
        }
        .manual-steps code {
          background: #222;
          color: var(--accent-hazard);
          padding: 0.1rem 0.3rem;
        }
        .handshake-feedback {
          border: 1px solid var(--border-tactical);
          padding: 0.85rem 1rem;
          font-size: 0.72rem;
        }
        .feedback-ok {
          background: rgba(74, 246, 38, 0.08);
          border-color: var(--accent-radar);
          color: var(--accent-radar);
        }
        .feedback-err {
          background: rgba(255, 42, 42, 0.08);
          border-color: var(--accent-hazard);
          color: var(--accent-hazard);
        }
        .feedback-hdr {
          font-weight: 700;
          display: block;
        }
        .feedback-sub {
          font-size: 0.68rem;
          color: var(--text-phosphor);
          margin-top: 0.25rem;
        }
        .settings-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--border-tactical);
          padding-top: 1rem;
        }
        .footer-actions-right {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          margin-left: auto;
        }
      `}</style>
    </div>
  );
};
