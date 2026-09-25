import React, { useState } from 'react';
import { ClawCaptcha } from './ClawCaptcha';

interface SecurityGateModalProps {
  isOpen: boolean;
  onVerified: () => void;
  onDismiss?: () => void;
  allowBypass?: boolean;
}

export const SecurityGateModal: React.FC<SecurityGateModalProps> = ({
  isOpen,
  onVerified,
  onDismiss,
  allowBypass = false
}) => {
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCaptchaSuccess = () => {
    setIsSuccess(true);
    setTimeout(() => {
      onVerified();
      setIsSuccess(false);
    }, 1100);
  };

  return (
    <div className="security-gate-overlay">
      <div className="security-gate-dialog with-crosshairs font-mono">
        <div className="hazard-stripe" />
        
        <div className="security-gate-top-bar">
          <div className="security-gate-badge">
            <span className="gate-pulse-indicator">●</span>
            <span>[ PROTOCOL // HUMAN_SECURITY_CLEARANCE_GATEWAY ]</span>
          </div>

          {allowBypass && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="btn-tactical btn-gate-dismiss"
              title="Temporary Bypass (Dev/Debug Mode)"
            >
              [BYPASS / ESC]
            </button>
          )}
        </div>

        <div className="security-gate-content">
          <ClawCaptcha onVerify={handleCaptchaSuccess} />
        </div>

        {isSuccess && (
          <div className="gate-authorization-banner font-mono">
            <span className="auth-pulse">✓</span>
            <span>CLEARANCE CONFIRMED // UNLOCKING TELEMETRY MAINFRAME...</span>
          </div>
        )}

        <div className="security-gate-footer font-mono">
          <span>[ HARDWARE_KERNEL: POKÉ_CLAW_SYS_V2.1 // CLEARANCE: LVL_01 ]</span>
          <span className="gate-status">[GATE: ACTIVE]</span>
        </div>
      </div>

      <style>{`
        .security-gate-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          background: rgba(4, 7, 7, 0.92);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.4rem;
          overflow: hidden;
          box-sizing: border-box;
        }

        body.theme-light .security-gate-overlay {
          background: rgba(240, 244, 248, 0.92);
        }

        .security-gate-dialog {
          width: 100%;
          max-width: 410px;
          max-height: 98vh;
          background: var(--bg-panel);
          border: 1px solid var(--border-bright);
          box-shadow: 0 0 40px rgba(0, 0, 0, 0.9), 0 0 15px var(--accent-radar-dim);
          position: relative;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          scrollbar-width: none;
          margin: auto;
          animation: gate-enter 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .security-gate-dialog::-webkit-scrollbar {
          display: none;
        }

        @keyframes gate-enter {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .security-gate-top-bar {
          padding: 0.35rem 0.65rem;
          border-bottom: 1px solid var(--border-tactical);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          font-size: 0.6rem;
        }

        .security-gate-badge {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          color: var(--accent-hazard);
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .gate-pulse-indicator {
          color: var(--accent-radar);
          animation: gate-pulse 1.2s infinite alternate;
          font-size: 0.75rem;
        }

        @keyframes gate-pulse {
          from { opacity: 0.4; }
          to { opacity: 1; }
        }

        .btn-gate-dismiss {
          font-size: 0.58rem;
          white-space: nowrap;
          padding: 0.15rem 0.45rem;
        }

        .security-gate-content {
          padding: 0.35rem 0.65rem 0.45rem 0.65rem;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .gate-authorization-banner {
          background: var(--accent-radar-dim);
          border: 1px solid var(--accent-radar);
          color: var(--text-phosphor);
          padding: 0.35rem 0.65rem;
          margin: 0 0.65rem 0.45rem 0.65rem;
          font-size: 0.64rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          animation: auth-glow 0.8s ease-in-out infinite alternate;
        }

        .auth-pulse {
          color: var(--accent-radar);
          font-weight: 900;
        }

        @keyframes auth-glow {
          from { box-shadow: 0 0 6px var(--accent-radar-dim); }
          to { box-shadow: 0 0 16px var(--accent-radar); }
        }

        .security-gate-footer {
          padding: 0.3rem 0.65rem;
          border-top: 1px solid var(--border-tactical);
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.54rem;
          color: var(--text-ghost);
          flex-wrap: wrap;
          gap: 0.3rem;
        }

        body.theme-light .security-gate-footer {
          background: #f4f4f4;
        }

        .gate-status {
          color: var(--accent-hazard);
          font-weight: 700;
        }

        @media (max-width: 480px) {
          .security-gate-dialog {
            max-width: 100%;
          }
          .security-gate-top-bar,
          .security-gate-content,
          .security-gate-footer {
            padding-left: 0.4rem;
            padding-right: 0.4rem;
          }
        }
      `}</style>
    </div>
  );
};
