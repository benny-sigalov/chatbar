import type { RuntimeMessage } from "../shared/messages/messages";
import { ChatBarStorage } from "../shared/storage/storage";

class ChatBarBackground {
    private static readonly defaultChatGptSidePanelUrl = "https://chatgpt.com/";

    public register(): void {
        chrome.runtime.onInstalled.addListener(this.handleInstalled);
        chrome.runtime.onStartup.addListener(this.handleStartup);
        chrome.runtime.onMessage.addListener(this.handleMessage);
    }

    private handleInstalled = (): void => {
        this.log("Runtime installed event");
        void this.configureWithErrorLogging(
            "install",
            "Failed to configure ChatBar on install:",
        );
    };

    private handleStartup = (): void => {
        this.log("Runtime startup event");
        void this.configureWithErrorLogging(
            "startup",
            "Failed to configure ChatBar on startup:",
        );
    };

    private handleMessage = (
        message: RuntimeMessage,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void,
    ): boolean => {
        this.log("Runtime message received", message);

        if (message.type !== "CHATGPT_LOCATION_CHANGED") {
            return false;
        }

        if (!this.isUsableChatGptUrl(message.payload.url)) {
            this.log("Ignoring unusable ChatGPT URL", message.payload);
            sendResponse({ ok: false });
            return false;
        }

        this.log("Evaluating latest ChatGPT URL", {
            url: message.payload.url,
            reason: message.payload.reason,
            updatedAt: message.payload.updatedAt,
        });

        void this.handleChatGptLocationChangedWithResponse(
            message,
            sendResponse,
        );

        return true;
    };

    private async configureWithErrorLogging(
        reason: string,
        errorMessage: string,
    ): Promise<void> {
        try {
            await this.configureChatBar(reason);
        } catch (error: unknown) {
            console.error(errorMessage, error);
        }
    }

    private async configureChatBar(reason: string): Promise<void> {
        await this.enableDefaultActionSidePanelOpen();
        await this.setInitialChatGptPath(reason);
    }

    private async enableDefaultActionSidePanelOpen(): Promise<void> {
        this.log("Enabling browser default side panel open on action click");
        await chrome.sidePanel.setPanelBehavior({
            openPanelOnActionClick: true,
        });
    }

    private async setInitialChatGptPath(reason: string): Promise<void> {
        this.log("Configuring global side panel path");
        await this.setChatGptSidePanelPath(reason);
    }

    private async setChatGptSidePanelPath(
        reason: string,
        url?: string,
    ): Promise<void> {
        const path = url ?? (await this.getChatGptSidePanelUrl());
        this.log("Before sidePanel.setOptions", { reason, path });

        await chrome.sidePanel.setOptions({
            path,
            enabled: true,
        });

        this.log("After sidePanel.setOptions", { reason, path });
    }

    private async getChatGptSidePanelUrl(): Promise<string> {
        const lastChatGptUrl = await ChatBarStorage.getLastChatGptUrl();

        if (
            lastChatGptUrl &&
            this.isUsableChatGptUrl(lastChatGptUrl.url)
        ) {
            this.log("Using remembered ChatGPT side panel URL", lastChatGptUrl);
            return lastChatGptUrl.url;
        }

        this.log("Using default ChatGPT side panel URL");
        return ChatBarBackground.defaultChatGptSidePanelUrl;
    }

    private async handleChatGptLocationChangedWithResponse(
        message: RuntimeMessage,
        sendResponse: (response?: unknown) => void,
    ): Promise<void> {
        try {
            await this.handleChatGptLocationChangedMessage(message);
            this.log(
                "Stored latest ChatGPT URL and updated side panel path",
                message.payload,
            );
            sendResponse({ ok: true });
        } catch (error: unknown) {
            console.error("Failed to store ChatGPT side panel URL:", error);
            sendResponse({ ok: false });
        }
    }

    private async handleChatGptLocationChangedMessage(
        message: RuntimeMessage,
    ): Promise<void> {
        const lastChatGptUrl = await ChatBarStorage.getLastChatGptUrl();
        const shouldKeepRememberedConversation =
            lastChatGptUrl &&
            this.isConversationUrl(lastChatGptUrl.url) &&
            this.isRootChatGptUrl(message.payload.url);

        const urlState = shouldKeepRememberedConversation
            ? lastChatGptUrl
            : message.payload;

        if (shouldKeepRememberedConversation) {
            this.log(
                "Ignoring root ChatGPT URL because a conversation URL is remembered",
                {
                    incomingUrl: message.payload.url,
                    incomingReason: message.payload.reason,
                    rememberedUrl: lastChatGptUrl.url,
                },
            );
        } else {
            this.log("Storing latest ChatGPT URL", {
                url: message.payload.url,
                reason: message.payload.reason,
            });
            await ChatBarStorage.setLastChatGptUrl(message.payload);
        }

        this.log("Updating global side panel path from ChatGPT URL", {
            url: urlState.url,
            reason: urlState.reason,
        });

        await this.setChatGptSidePanelPath(
            "chatgpt-url-change-global",
            urlState.url,
        );
    }

    private isAllowedChatGptUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            return (
                parsed.origin === "https://chatgpt.com" ||
                parsed.origin === "https://chat.openai.com"
            );
        } catch {
            return false;
        }
    }

    private isUsableChatGptUrl(url: string): boolean {
        if (!this.isAllowedChatGptUrl(url)) {
            return false;
        }

        const parsed = new URL(url);
        const blockedPathPrefixes = ["/auth/", "/login", "/logout"];

        return !blockedPathPrefixes.some((prefix) =>
            parsed.pathname.startsWith(prefix),
        );
    }

    private isConversationUrl(url: string): boolean {
        if (!this.isAllowedChatGptUrl(url)) {
            return false;
        }

        return new URL(url).pathname.startsWith("/c/");
    }

    private isRootChatGptUrl(url: string): boolean {
        if (!this.isAllowedChatGptUrl(url)) {
            return false;
        }

        return new URL(url).pathname === "/";
    }

    private log(message: string, details?: unknown): void {
        console.info(`[ChatBar background] ${message}`, details ?? "");
    }
}

new ChatBarBackground().register();
