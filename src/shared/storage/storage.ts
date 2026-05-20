export type ChatGptUrlState = {
    url: string;
    title?: string;
    updatedAt: number;
    reason?: string;
};

type SessionStorageShape = {
    lastChatGptUrl?: ChatGptUrlState;
};

export class ChatBarStorage {
    public static async getLastChatGptUrl(): Promise<
        ChatGptUrlState | undefined
    > {
        const result = await chrome.storage.session.get<{
            lastChatGptUrl?: ChatGptUrlState;
        }>({});

        return result?.lastChatGptUrl;
    }

    public static async setLastChatGptUrl(
        value: ChatGptUrlState,
    ): Promise<void> {
        await chrome.storage.session.set({
            lastChatGptUrl: value,
        } satisfies Partial<SessionStorageShape>);
    }
}
