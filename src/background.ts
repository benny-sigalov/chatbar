import { CHATGPT_LOCATION_CHANGED, type RuntimeMessage } from './messages';
import { ChatBarStorage } from './storage';

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

function isConversationUrl(url: string): boolean {
    if (!isAllowedChatGptUrl(url)) {
        return false;
    }

    return new URL(url).pathname.startsWith('/c/');
}

function isRootChatGptUrl(url: string): boolean {
    if (!isAllowedChatGptUrl(url)) {
        return false;
    }

    return new URL(url).pathname === '/';
}

async function getChatGptSidePanelUrl(): Promise<string> {
    const lastChatGptUrl = await ChatBarStorage.getLastChatGptUrl();

    if (lastChatGptUrl && isUsableChatGptUrl(lastChatGptUrl.url)) {
        log('Using remembered ChatGPT side panel URL', lastChatGptUrl);
        return lastChatGptUrl.url;
    }

    log('Using default ChatGPT side panel URL');
    return defaultChatGptSidePanelUrl;
}

async function setChatGptSidePanelPath(
    reason: string,
    url?: string,
): Promise<void> {
    const path = url ?? (await getChatGptSidePanelUrl());
    log('Before sidePanel.setOptions', { reason, path });

    await chrome.sidePanel.setOptions({
        path,
        enabled: true,
    });

    log('After sidePanel.setOptions', { reason, path });
}

async function setInitialChatGptPath(reason: string): Promise<void> {
    log('Configuring global side panel path');
    await setChatGptSidePanelPath(reason);
}

async function enableDefaultActionSidePanelOpen(): Promise<void> {
    log('Enabling browser default side panel open on action click');
    await chrome.sidePanel.setPanelBehavior({
        openPanelOnActionClick: true,
    });
}

async function configureChatBar(reason: string): Promise<void> {
    await enableDefaultActionSidePanelOpen();
    await setInitialChatGptPath(reason);
}

async function handleChatGptLocationChangedMessage(
    message: RuntimeMessage,
): Promise<void> {
    const lastChatGptUrl = await ChatBarStorage.getLastChatGptUrl();
    const shouldKeepRememberedConversation =
        lastChatGptUrl &&
        isConversationUrl(lastChatGptUrl.url) &&
        isRootChatGptUrl(message.payload.url);

    const urlState = shouldKeepRememberedConversation
        ? lastChatGptUrl
        : message.payload;

    if (shouldKeepRememberedConversation) {
        log(
            'Ignoring root ChatGPT URL because a conversation URL is remembered',
            {
                incomingUrl: message.payload.url,
                incomingReason: message.payload.reason,
                rememberedUrl: lastChatGptUrl.url,
            },
        );
    } else {
        log('Storing latest ChatGPT URL', {
            url: message.payload.url,
            reason: message.payload.reason,
        });
        await ChatBarStorage.setLastChatGptUrl(message.payload);
    }

    log('Updating global side panel path from ChatGPT URL', {
        url: urlState.url,
        reason: urlState.reason,
    });

    await setChatGptSidePanelPath('chatgpt-url-change-global', urlState.url);
}

chrome.runtime.onInstalled.addListener(() => {
    log('Runtime installed event');
    void (async () => {
        try {
            await configureChatBar('install');
        } catch (error: unknown) {
            console.error('Failed to configure ChatBar on install:', error);
        }
    })();
});

chrome.runtime.onStartup.addListener(() => {
    log('Runtime startup event');
    void (async () => {
        try {
            await configureChatBar('startup');
        } catch (error: unknown) {
            console.error('Failed to configure ChatBar on startup:', error);
        }
    })();
});

chrome.runtime.onMessage.addListener(
    (message: RuntimeMessage, _sender, sendResponse) => {
        log('Runtime message received', message);

        if (message.type !== CHATGPT_LOCATION_CHANGED) {
            return false;
        }

        if (!isUsableChatGptUrl(message.payload.url)) {
            log('Ignoring unusable ChatGPT URL', message.payload);
            sendResponse({ ok: false });
            return false;
        }

        log('Evaluating latest ChatGPT URL', {
            url: message.payload.url,
            reason: message.payload.reason,
            updatedAt: message.payload.updatedAt,
        });

        void (async () => {
            try {
                await handleChatGptLocationChangedMessage(message);
                log(
                    'Stored latest ChatGPT URL and updated side panel path',
                    message.payload,
                );
                sendResponse({ ok: true });
            } catch (error: unknown) {
                console.error('Failed to store ChatGPT side panel URL:', error);
                sendResponse({ ok: false });
            }
        })();

        return true;
    },
);
