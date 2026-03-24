import { css } from 'lit';

export const liveTrackingStyles = css`
    :host { display: block; height: 100%; position: relative; }

    .tracking-overlay {
        position: absolute;
        bottom: 0; left: 0; right: 0;
        z-index: var(--z-sheet);
        display: flex; flex-direction: column;
        gap: var(--space-4);
        padding: var(--space-4);
    }

    .tracking-overlay * { pointer-events: auto; }

    .status-strip {
        background: var(--color-sheet-bg);
        backdrop-filter: blur(8px);
        padding: var(--space-2) var(--space-4);
        border-radius: var(--border-radius-pill);
        display: flex; align-items: center; justify-content: space-between;
        box-shadow: var(--shadow-md);
        font-size: var(--text-xs); font-weight: var(--weight-bold);
        border: var(--border-width) solid var(--border-color);
    }
    .status-strip.online { color: var(--color-online); }
    .status-strip.offline { color: var(--color-danger-text); }

    .status-indicator {
        display: flex; align-items: center; gap: var(--space-2);
    }
    .pulse-dot {
        width: 8px; height: 8px; background: currentColor;
        border-radius: 50%;
        animation: pulse-ring-premium 2s infinite;
    }
    .status-text { display: flex; align-items: center; gap: var(--space-2); }
    .timer-tag {
        background: rgba(0,0,0,0.05); padding: 2px 8px;
        border-radius: var(--border-radius-sm); font-family: 'DM Mono', monospace;
        font-size: 10px; color: var(--color-text-muted);
    }

    @keyframes pulse-ring-premium {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 currentColor; }
        70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(0,0,0,0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0,0,0,0); }
    }

    .end-btn {
        background: none; border: none; color: var(--color-danger-text);
        font-size: var(--text-xs); font-weight: var(--weight-bold); cursor: pointer;
        padding: 4px 8px; border-radius: var(--border-radius-sm);
        transition: background var(--duration-fast);
    }
    .end-btn:hover { background: var(--color-danger-bg); }

    .main-content {
        display: flex; flex-direction: column; gap: var(--space-4);
    }

    .card {
        background: var(--color-sheet-bg);
        backdrop-filter: blur(12px);
        border-radius: var(--border-radius-xl); padding: var(--space-4);
        box-shadow: var(--shadow-lg);
        border: var(--border-width) solid var(--border-color);
    }

    .venue-info {
        display: flex; align-items: center; gap: var(--space-3);
        margin-bottom: var(--space-4);
    }
    .venue-emoji {
        width: 44px; height: 44px; border-radius: var(--border-radius-md);
        background: var(--color-blue-light); display: flex; align-items: center;
        justify-content: center; font-size: 24px;
    }
    .venue-text h3 { margin: 0; font-size: var(--text-lg); font-weight: var(--weight-bold); color: var(--color-text-primary); }
    .venue-text p { margin: 2px 0 0; font-size: var(--text-sm); color: var(--color-text-secondary); }

    .eta-grid {
        display: flex; align-items: center; justify-content: space-between;
        padding: var(--space-3) 0; border-top: var(--border-width) solid var(--border-color);
    }
    .eta-item { flex: 1; text-align: center; }
    .eta-item label { display: block; font-size: 10px; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .eta-val { display: block; font-size: var(--text-3xl); font-weight: var(--weight-bold); color: var(--color-blue); line-height: 1; }
    .dist-val { font-size: var(--text-xs); color: var(--color-text-muted); }
    .eta-divider { width: var(--border-width); height: 32px; background: var(--border-color); }

    .recenter-bar { margin-top: var(--space-3); text-align: center; }
    .recenter-bar {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        flex-wrap: wrap;
    }
    .text-btn {
        background: none; border: none; color: var(--color-blue);
        font-size: var(--text-sm); font-weight: var(--weight-bold); cursor: pointer;
        padding: 4px 12px; border-radius: var(--border-radius-pill);
        transition: background var(--duration-fast);
    }
    .text-btn:hover { background: var(--color-blue-light); }
    .text-btn.active {
        background: var(--color-blue);
        color: var(--color-blue-text);
    }

    .route-mode-row {
        display: flex;
        justify-content: center;
        gap: var(--space-2);
        margin-top: var(--space-2);
    }

    .route-mode-btn {
        border: 1px solid rgba(0,0,0,0.12);
        background: var(--color-surface);
        color: var(--color-text-primary);
        border-radius: 999px;
        padding: 6px 10px;
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        cursor: pointer;
        transition: all var(--duration-fast);
    }

    .route-mode-btn.active {
        border-color: var(--color-blue);
        background: var(--color-blue-light);
        color: var(--color-blue);
    }

    .chat-widget {
        transition: all var(--duration-slow) var(--ease-in-out);
        display: flex; flex-direction: column;
    }
    .chat-widget.collapsed { height: 56px; overflow: hidden; }
    .chat-widget.expanded { height: min(400px, 56vh); }

    .chat-header {
        height: 56px; display: flex; align-items: center; justify-content: space-between;
        cursor: pointer; padding: 0 var(--space-1);
    }
    .chat-title { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-md); font-weight: var(--weight-bold); color: var(--color-text-primary); }
    .chat-icon { font-size: 18px; }

    .chat-toggle {
        position: relative;
        width: 32px; height: 32px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        transition: background var(--duration-fast), transform var(--duration-base);
        color: var(--color-text-muted);
    }
    .chat-toggle:hover { background: rgba(0,0,0,0.05); }
    .expanded .chat-toggle { transform: rotate(180deg); }

    .chat-unread-badge {
        position: absolute;
        top: -6px;
        right: -8px;
        min-width: 18px;
        height: 18px;
        border-radius: 999px;
        background: var(--danger-500);
        color: var(--color-text-inverted);
        font-size: 10px;
        font-weight: var(--weight-bold);
        line-height: 18px;
        text-align: center;
        padding: 0 5px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.22);
        border: 1px solid var(--color-surface);
    }

    .chat-view { flex: 1; display: flex; flex-direction: column; min-height: 0; padding-top: var(--space-2); }
    .chat-body {
        flex: 1; overflow-y: auto; padding: var(--space-3) 0;
        display: flex; flex-direction: column; gap: var(--space-2);
        scrollbar-width: thin;
        scrollbar-color: rgba(0,0,0,0.1) transparent;
    }
    .msg { display: flex; }
    .msg.sent { justify-content: flex-end; }
    .msg-bubble {
        max-width: 80%; padding: 10px 14px; border-radius: 18px;
        font-size: var(--text-md); line-height: 1.4;
    }
    .sent .msg-bubble { background: var(--color-blue); color: var(--color-blue-text); border-bottom-right-radius: 4px; }
    .received .msg-bubble { background: var(--color-blue-light); color: var(--color-text-primary); border-bottom-left-radius: 4px; }

    .chat-input {
        margin-top: var(--space-2); display: flex; gap: var(--space-2);
        padding-top: var(--space-3); border-top: var(--border-width) solid var(--border-color);
    }
    .chat-input input {
        flex: 1; padding: 10px 16px; border-radius: var(--border-radius-pill);
        border: var(--border-width) solid var(--border-color); font-size: var(--text-md); outline: none;
        background: var(--chat-input-bg); transition: border-color var(--duration-fast);
    }
    .chat-input input:focus { border-color: var(--color-blue); }
    .chat-input button {
        background: var(--color-blue); color: var(--color-blue-text); border: none;
        border-radius: var(--border-radius-pill); padding: 0 var(--space-4);
        font-weight: var(--weight-bold); cursor: pointer;
        transition: background var(--duration-fast);
        font-size: var(--text-sm);
    }
    .chat-input button:hover { background: var(--color-blue-mid); }
`;
