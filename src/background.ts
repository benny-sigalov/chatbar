import { CHATGPT_LOCATION_CHANGED, type RuntimeMessage } from './messages';
import {
    getLastChatGptUrl,
    getLastSidePanelTabId,
    setLastChatGptUrl,
    setLastSidePanelTabId,
} from './storage';

type ChromeRuntime = {
    runtime?: {
        onInstalled?: {
            addListener(callback: () => void): void;
        };
        onStartup?: {
            addListener(callback: () => void): void;
        };
        onMessage?: {
            addListener(
                callback: (
                    message: RuntimeMessage,
                    sender: { tab?: { id?: number } },
                    sendResponse: (response?: unknown) => void,
                ) => boolean | void,
            ): void;
        };
    };
    tabs?: {
        query(queryInfo: {
            active: boolean;
            currentWindow: boolean;
        }): Promise<Array<{ id?: number }>>;
    };
    action?: {
        onClicked?: {
            addListener(
                callback: (tab: { id?: number; windowId?: number }) => void,
            ): void;
        };
    };
    sidePanel?: {
        setOptions?(options: {
            tabId?: number;
            path: string;
            enabled: boolean;
        }): Promise<void>;
        setPanelBehavior?(options: {
            openPanelOnActionClick: boolean;
        }): Promise<void>;
    };
};

const chromeApi = (globalThis as unknown as { chrome?: ChromeRuntime }).chrome;
const defaultChatGptSidePanelUrl = 'https://chatgpt.com/';

function log(message: string, details?: unknown): void {
    console.info(`[ChatBar background] ${message}`, details ?? '');
}

function isAllowedChatGptUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return (
            parsed.origin === 'https://chatgpt.com' ||
            parsed.origin === 'https://chat.openai.com'
        );
    } catch {
        return false;
    }
}

function isUsableChatGptUrl(url: string): boolean {
    if (!isAllowedChatGptUrl(url)) {
        return false;
    }

    const parsed = new URL(url);
    const blockedPathPrefixes = ['/auth/', '/login', '/logout'];

    return !blockedPathPrefixes.some((prefix) =>
        parsed.pathname.startsWith(prefix),
    );
}

async function getChatGptSidePanelUrl(): Promise<string> {
    const lastChatGptUrl = await getLastChatGptUrl();

    if (lastChatGptUrl && isUsableChatGptUrl(lastChatGptUrl.url)) {
        log('Using remembered ChatGPT side panel URL', lastChatGptUrl);
        return lastChatGptUrl.url;
    }

    log('Using default ChatGPT side panel URL');
    return defaultChatGptSidePanelUrl;
}

async function setChatGptSidePanelPath(
    reason: string,
    tabId?: number,
    url?: string,
): Promise<void> {
    const path = url ?? (await getChatGptSidePanelUrl());
    log('Before sidePanel.setOptions', { reason, tabId, path });

    if (typeof tabId === 'number') {
        await setLastSidePanelTabId(tabId);
    }

    await chromeApi?.sidePanel?.setOptions?.({
        tabId,
        path,
        enabled: true,
    });

    log('After sidePanel.setOptions', { reason, tabId, path });
}

async function setChatGptPathForActiveTab(reason: string): Promise<void> {
    const tabs = await chromeApi?.tabs?.query({
        active: true,
        currentWindow: true,
    });
    log('Configuring side panel path for active tab', { tabId: tabs?.[0]?.id });
    await setChatGptSidePanelPath(reason, tabs?.[0]?.id);
}

async function enableDefaultActionSidePanelOpen(): Promise<void> {
    log('Enabling browser default side panel open on action click');
    await chromeApi?.sidePanel?.setPanelBehavior?.({
        openPanelOnActionClick: true,
    });
}

chromeApi?.runtime?.onInstalled?.addListener(() => {
    log('Runtime installed event');
    void enableDefaultActionSidePanelOpen()
        .then(() => setChatGptPathForActiveTab('install'))
        .catch((error: unknown) => {
            console.error('Failed to configure ChatBar on install:', error);
        });
});

chromeApi?.runtime?.onStartup?.addListener(() => {
    log('Runtime startup event');
    void enableDefaultActionSidePanelOpen()
        .then(() => setChatGptPathForActiveTab('startup'))
        .catch((error: unknown) => {
            console.error('Failed to configure ChatBar on startup:', error);
        });
});

chromeApi?.action?.onClicked?.addListener((tab) => {
    log('Extension action clicked', { tabId: tab.id, windowId: tab.windowId });

    void setChatGptSidePanelPath('action-click', tab.id).catch(
        (error: unknown) => {
            console.error(
                'Failed to set ChatGPT as ChatBar side panel path:',
                error,
            );
        },
    );
});

chromeApi?.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
    log('Runtime message received', message);

    if (message.type !== CHATGPT_LOCATION_CHANGED) {
        return false;
    }

    if (!isUsableChatGptUrl(message.payload.url)) {
        log('Ignoring unusable ChatGPT URL', message.payload);
        sendResponse({ ok: false });
        return false;
    }

    log('Storing latest ChatGPT URL', message.payload);

    void setLastChatGptUrl(message.payload)
        .then(async () => {
            const sidePanelTabId =
                sender.tab?.id ?? (await getLastSidePanelTabId());
            log('Updating remembered side panel path from ChatGPT URL', {
                senderTabId: sender.tab?.id,
                sidePanelTabId,
                url: message.payload.url,
            });

            await setChatGptSidePanelPath(
                'chatgpt-url-change-global',
                undefined,
                message.payload.url,
            );

            if (typeof sidePanelTabId === 'number') {
                await setChatGptSidePanelPath(
                    'chatgpt-url-change-tab',
                    sidePanelTabId,
                    message.payload.url,
                );
            }
        })
        .then(() => {
            log(
                'Stored latest ChatGPT URL and updated side panel path',
                message.payload,
            );
            sendResponse({ ok: true });
        })
        .catch((error: unknown) => {
            console.error('Failed to store ChatGPT side panel URL:', error);
            sendResponse({ ok: false });
        });

    return true;
});
