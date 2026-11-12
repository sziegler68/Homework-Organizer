/**
 * ErrorLogger - Collects diagnostic info on-device for later export.
 * Stores entries in memory and optionally in sessionStorage so they
 * survive a soft reload within the same tab.
 */

const SESSION_KEY = 'hw-organizer-error-log';
let entries = [];

// Restore any entries from a previous soft-reload
try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) entries = JSON.parse(saved);
} catch { /* ignore */ }

function persist() {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(entries));
    } catch { /* storage full / unavailable */ }
}

/**
 * Log a diagnostic entry.
 *
 * @param {'error'|'warn'|'info'} level
 * @param {string} source  - e.g. "CaptureView.handleCropConfirm"
 * @param {string} message - human-readable summary
 * @param {Object} [extra] - any extra context (image dims, corners, etc.)
 * @param {Error}  [error] - the caught Error object
 */
export function log(level, source, message, extra = {}, error = null) {
    const entry = {
        ts: new Date().toISOString(),
        level,
        source,
        message,
        ...extra,
    };

    if (error) {
        entry.errorName = error.name;
        entry.errorMessage = error.message;
        entry.stack = error.stack;
    }

    entries.push(entry);
    persist();

    // Still mirror to console so desktop debugging works too
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(`[${source}]`, message, extra, error);
}

/** Return the full log array (read-only copy). */
export function getEntries() {
    return [...entries];
}

/** Clear all stored entries. */
export function clearLog() {
    entries = [];
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

/**
 * Build a full diagnostic report and trigger a JSON file download.
 * The file includes device/browser info so we can reproduce the issue.
 */
export function downloadLog() {
    const report = {
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screen: {
            width: screen.width,
            height: screen.height,
            devicePixelRatio: window.devicePixelRatio,
        },
        viewport: {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
        },
        entries,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hw-organizer-debug-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
