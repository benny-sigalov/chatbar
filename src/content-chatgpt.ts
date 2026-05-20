import {
    CHATGPT_LOCATION_CHANGED,
    type ChatGptLocationChangedMessage,
} from './messages';

let lastReportedUrl = '';

function log(message: string, details?: unknown): void {
    console.info(`[ChatBar content] ${message}`, details ?? '');
}

async function sendLocationUpdate(
    message: ChatGptLocationChangedMessage,
): Promise<void> {
    try {
        const response = await chrome.runtime.sendMessage(message);
        log('Background acknowledged URL update', response);
    } catch {
        log(
            'Could not send URL update; extension may be reloading during development',
        );
    }
}

function reportLocation(reason: string, force = false): void {
    const url = location.href;

    if (!force && url === lastReportedUrl) {
        return;
    }

    lastReportedUrl = url;
    log('Reporting ChatGPT URL', { reason, force, url, title: document.title });

    void sendLocationUpdate({
        type: CHATGPT_LOCATION_CHANGED,
        payload: {
            url,
            title: document.title,
            updatedAt: Date.now(),
            reason,
        },
    } satisfies ChatGptLocationChangedMessage);
}

function reportLocationIfChanged(): void {
    reportLocation('location-change');
}

function patchHistoryMethod(method: 'pushState' | 'replaceState'): void {
    const original = history[method];
    log(`Patching history.${method}`);

    history[method] = function patchedHistoryMethod(
        this: History,
        data: unknown,
        unused: string,
        url?: string | URL | null,
    ): void {
        original.call(this, data, unused, url);
        window.queueMicrotask(reportLocationIfChanged);
    };
}

log('ChatGPT helper loaded', { url: location.href, title: document.title });
patchHistoryMethod('pushState');
patchHistoryMethod('replaceState');

window.addEventListener('popstate', reportLocationIfChanged);
window.addEventListener('hashchange', reportLocationIfChanged);
window.addEventListener('pagehide', () => reportLocation('pagehide', true));
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        reportLocation('visibility-hidden', true);
    }
});

window.setInterval(reportLocationIfChanged, 1000);
reportLocation('initial-load');
