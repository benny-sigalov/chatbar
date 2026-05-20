import {
    CHATGPT_LOCATION_CHANGED,
    type ChatGptLocationChangedMessage,
} from './messages';

type ChromeRuntimeApi = {
    runtime?: {
        sendMessage(message: ChatGptLocationChangedMessage): Promise<unknown>;
    };
};

const chromeApi = (globalThis as unknown as { chrome?: ChromeRuntimeApi })
    .chrome;
let lastReportedUrl = '';

function log(message: string, details?: unknown): void {
    console.info(`[ChatBar content] ${message}`, details ?? '');
}

function reportLocationIfChanged(): void {
    const url = location.href;

    if (url === lastReportedUrl) {
        return;
    }

    lastReportedUrl = url;
    log('ChatGPT URL changed', { url, title: document.title });

    void chromeApi?.runtime
        ?.sendMessage({
            type: CHATGPT_LOCATION_CHANGED,
            payload: {
                url,
                title: document.title,
                updatedAt: Date.now(),
            },
        })
        .then((response) => {
            log('Background acknowledged URL update', response);
        })
        .catch(() => {
            log(
                'Could not send URL update; extension may be reloading during development',
            );
        });
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
window.addEventListener('pagehide', reportLocationIfChanged);

window.setInterval(reportLocationIfChanged, 1000);
reportLocationIfChanged();
