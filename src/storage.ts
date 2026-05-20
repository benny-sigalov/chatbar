import type { ChatGptUrlState } from './types';

type SessionStorageShape = {
    lastChatGptUrl?: ChatGptUrlState;
    lastSidePanelTabId?: number;
};

type ChromeStorageArea = {
    get<T extends Record<string, unknown>>(keys: T): Promise<T>;
    set(items: Partial<SessionStorageShape>): Promise<void>;
};

type ChromeStorageRuntime = {
    storage?: {
        session?: ChromeStorageArea;
    };
};

const chromeApi = (globalThis as unknown as { chrome?: ChromeStorageRuntime })
    .chrome;

export async function getLastChatGptUrl(): Promise<
    ChatGptUrlState | undefined
> {
    const result = await chromeApi?.storage?.session?.get<{
        lastChatGptUrl?: ChatGptUrlState;
    }>({});
    return result?.lastChatGptUrl;
}

export async function setLastChatGptUrl(value: ChatGptUrlState): Promise<void> {
    await chromeApi?.storage?.session?.set({ lastChatGptUrl: value });
}

export async function getLastSidePanelTabId(): Promise<number | undefined> {
    const result = await chromeApi?.storage?.session?.get<{
        lastSidePanelTabId?: number;
    }>({});
    return result?.lastSidePanelTabId;
}

export async function setLastSidePanelTabId(value: number): Promise<void> {
    await chromeApi?.storage?.session?.set({ lastSidePanelTabId: value });
}
