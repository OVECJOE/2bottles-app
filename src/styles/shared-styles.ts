import { css } from 'lit';

/**
 * Shared design system styles for 2bottles components.
 * These are encapsulated CSS fragments that can be composed into static styles.
 */
export const sharedStyles = css`
  /* Layout & Sheets */
  .sheet {
    position: absolute; bottom: 0; left: 0; right: 0;
    background: var(--color-sheet-bg);
    border: 1px solid var(--glass-border);
    box-shadow: var(--glass-shadow);
    backdrop-filter: blur(14px) saturate(135%);
    -webkit-backdrop-filter: blur(14px) saturate(135%);
    border-radius: var(--border-radius-xl) var(--border-radius-xl) 0 0;
    padding: var(--space-3) var(--space-5) calc(env(safe-area-inset-bottom, 0px) + var(--space-6));
    z-index: var(--z-sheet);
    animation: slide-up var(--duration-sheet) var(--ease-out) both;
    transition: transform var(--duration-base) var(--ease-out), opacity var(--duration-fast) var(--ease-out);
    will-change: transform, opacity;
    display: flex; flex-direction: column;
    gap: var(--space-4);
  }

  .handle {
    width: 36px; height: 4px; background: var(--color-border-strong);
    border-radius: var(--border-radius-pill); margin: 0 auto var(--space-4);
    flex-shrink: 0;
  }

  .sheet-header { flex-shrink: 0; margin-bottom: var(--space-3); }
  .title    { font-size: var(--text-xl); font-weight: var(--weight-bold); margin-bottom: var(--space-1); }
  .subtitle { font-size: var(--text-sm); color: var(--color-text-muted); }

  .action-row { display: flex; gap: var(--space-2); margin-top: var(--space-3); flex-shrink: 0; }

  /* Buttons */
  .btn {
    display: flex; align-items: center; justify-content: center; gap: var(--space-2);
    width: 100%; padding: 13px var(--space-4);
    border: none; border-radius: var(--border-radius-md);
    font-family: var(--font-sans); font-size: var(--text-md);
    font-weight: var(--weight-bold); cursor: pointer;
    text-align: center; line-height: 1;
    transition: all var(--duration-fast) var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  .btn:active { transform: scale(0.98); opacity: 0.9; }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

  .btn-primary {
    background: var(--color-action); color: var(--color-action-text);
  }
  .btn-primary:hover { background: var(--color-action-hover); }

  .btn-green {
    background: var(--color-success); color: var(--color-success-text);
  }
  .btn-green:hover { background: var(--color-success-hover); }

  .btn-outline {
    background: transparent; color: var(--color-action);
    border: 1.5px solid var(--color-action);
  }
  .btn-outline:hover { background: var(--color-surface-muted); }

  .btn-ghost {
    background: transparent; color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
  .btn-ghost:hover { color: var(--color-text); }

  /* Inputs */
  .input-base {
    width: 100%; padding: 12px;
    border: 1px solid var(--color-border); border-radius: var(--border-radius-md);
    font-family: var(--font-sans); font-size: var(--text-md);
    background: var(--color-surface-muted);
    color: var(--color-text);
    transition: border-color var(--duration-fast);
    box-sizing: border-box;
  }
  .input-base:focus { 
    outline: none; border-color: var(--color-action); 
    box-shadow: 0 0 0 2px rgba(74,139,196,0.15); 
  }
  .input-base::placeholder { color: var(--color-text-muted); }

  /* Utilities */
  .animate-slide-up { animation: slide-up var(--duration-sheet) var(--ease-out) both; }
  .divider { height: var(--border-width); background: var(--border-color); margin: var(--space-3) 0; }

  /* Semantic Status Strips */
  .status-strip {
    display: flex; align-items: center; gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--border-radius-md);
    font-size: var(--text-xs); font-weight: var(--weight-medium);
  }
  .status-strip.success { background: var(--color-success); color: var(--color-success-text); }
  .status-strip.warning { background: var(--color-warning); color: var(--color-warning-text); }
  .status-strip.danger  { background: var(--color-danger);  color: var(--color-danger-text); }
  .status-strip.info    { background: var(--color-info); color: var(--color-info-text); }

`;
