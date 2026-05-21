import type {
    BackgroundMessage,
    CaptureVisibleTabStatusMessage,
    CaptureVisibleTabResultMessage,
    ChatGptUrlUpdatedMessage,
} from "../shared/messages/messages";
import { ChatGptDom } from "./chatgptDom";

class ChatGptContentScript {
    private lastReportedUrl = "";
    private captureRequestSequence = 0;
    private toolbarStatusElement?: HTMLSpanElement;
    private toolbarSourceElement?: HTMLSpanElement;
    private toolbarAutoScreenshotToggleElement?: HTMLButtonElement;
    private toolbarButtonElement?: HTMLButtonElement;
    private autoScreenshotEnabled = false;
    private allowNextSendClick = false;
    private isAutoSendInProgress = false;
    private canCaptureVisibleTab = true;
    private activeCaptureSourceKey = "";
    private observedSendButton?: HTMLButtonElement;
    private toolbarObserver?: MutationObserver;
    private readonly chatGptDom = new ChatGptDom();
    private readonly port = chrome.runtime.connect({
        name: "chatgpt-sidebar",
    });

    public register(): void {
        this.log("ChatGPT helper loaded", {
            url: location.href,
            title: document.title,
        });

        this.port.onMessage.addListener(this.handleBackgroundMessage);
        this.port.onDisconnect.addListener(() => {
            this.log("Background port disconnected");
        });
    }

    private handleBackgroundMessage = (message: BackgroundMessage): void => {
        if (message.type === "CAPTURE_VISIBLE_TAB_RESULT") {
            this.handleCaptureVisibleTabResult(message);
            return;
        }

        if (message.type === "CAPTURE_VISIBLE_TAB_STATUS") {
            this.handleCaptureVisibleTabStatus(message);
            return;
        }

        if (message.type !== "CHATGPT_PORT_INIT") {
            return;
        }

        if (!message.payload.isSidebarPage) {
            this.log("ChatGPT helper is running in a normal page; skipping sidebar initialization");
            this.port.disconnect();
            return;
        }

        this.log("ChatGPT helper is running in the sidebar; initializing");
        this.initializeSidebarTracking();
    };

    private initializeSidebarTracking(): void {
        this.patchHistoryMethod("pushState");
        this.patchHistoryMethod("replaceState");

        window.addEventListener("popstate", this.reportLocationIfChanged);
        window.addEventListener("hashchange", this.reportLocationIfChanged);
        document.addEventListener("keydown", this.interceptAutoSendKeyDown, true);
        this.startSendButtonPolling();
        window.setInterval(this.reportLocationIfChanged, 1000);
        document.addEventListener(
            "chatbar:capture-visible-tab",
            this.requestVisibleTabCapture,
        );
        this.renderToolbar();
        this.observeComposerForToolbar();

        this.reportLocation("initial-load", true);

        Object.assign(window, {
            chatbarCaptureVisibleTab: this.requestVisibleTabCapture,
        });
    }

    private reportLocation = (reason: string, force = false): void => {
        const url = location.href;

        if (!force && url === this.lastReportedUrl) {
            return;
        }

        this.lastReportedUrl = url;
        const message = {
            type: "CHATGPT_URL_UPDATED",
            payload: {
                url,
                title: document.title,
                updatedAt: Date.now(),
                reason,
            },
        } satisfies ChatGptUrlUpdatedMessage;

        this.log("Reporting ChatGPT URL update", message.payload);

        try {
            this.port.postMessage(message);
        } catch {
            this.log("Could not post URL update through runtime port");
        }
    };

    private reportLocationIfChanged = (): void => {
        this.reportLocation("location-change");
    };

    private patchHistoryMethod(method: "pushState" | "replaceState"): void {
        const original = history[method];
        const reportLocationIfChanged = this.reportLocationIfChanged;

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

    private requestVisibleTabCapture = (): void => {
        if (this.isAutoSendInProgress) {
            this.setToolbarStatus("Screenshot already in progress.");
            return;
        }

        this.requestScreenshot("manual");
    };

    private requestScreenshot = (mode: "manual" | "auto-send"): void => {
        if (!this.canCaptureVisibleTab) {
            this.setToolbarStatus("This page cannot be captured.");
            return;
        }

        const requestId = `capture-${Date.now()}-${this.captureRequestSequence++}`;

        this.log("Requesting visible tab capture", { requestId });
        this.setToolbarStatus("Capturing...");
        this.setToolbarButtonDisabled(true);
        this.port.postMessage({
            type: "CAPTURE_VISIBLE_TAB",
            requestId,
            mode,
        });
    };

    private interceptAutoSendKeyDown = (event: KeyboardEvent): void => {
        if (
            !this.autoScreenshotEnabled ||
            !this.canCaptureVisibleTab
        ) {
            return;
        }

        if (!this.chatGptDom.isPlainEnterInComposer(event)) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        if (this.isAutoSendInProgress) {
            return;
        }

        this.isAutoSendInProgress = true;
        this.setToolbarStatus("Capturing before send...");
        this.requestScreenshot("auto-send");
    };

    private startSendButtonPolling(): void {
        this.updateSendButtonSubscription();
        window.setInterval(this.updateSendButtonSubscription, 150);
    }

    private updateSendButtonSubscription = (): void => {
        const sendButton = this.chatGptDom.findSendButton();

        if (sendButton === this.observedSendButton) {
            return;
        }

        if (this.observedSendButton) {
            this.observedSendButton.removeEventListener(
                "click",
                this.interceptAutoSendClick,
                true,
            );
        }

        this.observedSendButton = sendButton ?? undefined;

        if (this.observedSendButton) {
            this.observedSendButton.addEventListener(
                "click",
                this.interceptAutoSendClick,
                true,
            );
        }
    };

    private interceptAutoSendClick = (event: MouseEvent): void => {
        if (this.allowNextSendClick) {
            this.allowNextSendClick = false;
            return;
        }

        if (
            !this.autoScreenshotEnabled ||
            !this.canCaptureVisibleTab
        ) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        if (this.isAutoSendInProgress) {
            return;
        }

        this.isAutoSendInProgress = true;
        this.setToolbarStatus("Capturing before send...");
        this.requestScreenshot("auto-send");
    };

    private async handleCaptureVisibleTabResult(
        message: CaptureVisibleTabResultMessage,
    ): Promise<void> {
        if (!message.payload.ok) {
            this.log("Visible tab capture failed", {
                requestId: message.requestId,
                error: message.payload.error,
            });
            this.setToolbarStatus(`Capture failed: ${message.payload.error}`);
            this.setToolbarButtonDisabled(false);
            this.isAutoSendInProgress = false;
            return;
        }

        this.log("Visible tab captured", {
            requestId: message.requestId,
            capturedAt: message.payload.capturedAt,
            dataUrlLength: message.payload.dataUrl.length,
        });
        this.setToolbarStatus(
            `Captured ${new Date(message.payload.capturedAt).toLocaleTimeString()}`,
        );
        this.setToolbarButtonDisabled(false);

        const pasted = await this.pasteDataUrlIntoComposer(
            message.payload.dataUrl,
        );

        if (message.mode === "auto-send" && pasted) {
            await this.completeAutoSend();
        } else if (message.mode === "auto-send") {
            this.isAutoSendInProgress = false;
        }
    }

    private async pasteDataUrlIntoComposer(dataUrl: string): Promise<boolean> {
        try {
            const blob = await this.dataUrlToBlob(dataUrl);
            const pasteResult =
                await this.chatGptDom.pasteScreenshotIntoComposer(blob);

            if (pasteResult === "pasted") {
                this.setToolbarStatus("Screenshot attached");
                return true;
            }

            this.setToolbarStatus(
                pasteResult === "composer-not-found"
                    ? "Composer not found."
                    : "Paste was not accepted.",
            );
            return false;
        } catch (error: unknown) {
            this.setToolbarStatus(
                error instanceof Error
                    ? `Captured, but paste failed: ${error.message}`
                    : "Captured, but paste failed.",
            );
            this.isAutoSendInProgress = false;
            return false;
        }
    }

    private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
        const response = await fetch(dataUrl);

        return response.blob();
    }

    private async completeAutoSend(): Promise<void> {
        this.setToolbarStatus("Waiting for screenshot upload...");
        const sendButton = await this.chatGptDom.waitForSendButtonReady();

        if (!sendButton) {
            this.setToolbarStatus(
                "Screenshot attached. Send when upload is ready.",
            );
            this.isAutoSendInProgress = false;
            return;
        }

        this.allowNextSendClick = true;
        this.chatGptDom.clickSendButton(sendButton);
        this.setToolbarStatus("Screenshot attached and sent");
        this.isAutoSendInProgress = false;
    }

    private handleCaptureVisibleTabStatus(
        message: CaptureVisibleTabStatusMessage,
    ): void {
        this.canCaptureVisibleTab = message.payload.canCapture;
        const sourceKey = message.payload.url ?? message.payload.title ?? "";
        const sourceChanged = sourceKey !== this.activeCaptureSourceKey;

        this.activeCaptureSourceKey = sourceKey;

        if (message.payload.canCapture) {
            this.setToolbarSource(this.formatCaptureSource(message.payload));
            this.setToolbarStatus(
                sourceChanged ? "Ready" : this.getToolbarStatus(),
            );
            this.setToolbarButtonDisabled(false);
            return;
        }

        this.setToolbarSource(this.formatCaptureSource(message.payload));
        this.setToolbarStatus(message.payload.reason);
        this.setToolbarButtonDisabled(true);
    }

    private renderToolbar(): void {
        const toolbar = this.chatGptDom.insertChatBarToolbar(
            this.toggleAutoScreenshot,
            this.requestVisibleTabCapture,
        );

        if (!toolbar) {
            return;
        }

        this.toolbarStatusElement = toolbar.status;
        this.toolbarSourceElement = toolbar.source;
        this.toolbarAutoScreenshotToggleElement = toolbar.autoScreenshotToggle;
        this.toolbarButtonElement = toolbar.button;
        this.updateAutoScreenshotToggle();
    }

    private toggleAutoScreenshot = (): void => {
        this.autoScreenshotEnabled = !this.autoScreenshotEnabled;
        this.updateAutoScreenshotToggle();
        this.setToolbarStatus(
            this.autoScreenshotEnabled
                ? "Auto screenshot enabled"
                : "Auto screenshot disabled",
        );
    };

    private updateAutoScreenshotToggle(): void {
        if (!this.toolbarAutoScreenshotToggleElement) {
            return;
        }

        this.toolbarAutoScreenshotToggleElement.textContent =
            this.autoScreenshotEnabled
                ? "Auto screenshot: On"
                : "Auto screenshot: Off";
        this.toolbarAutoScreenshotToggleElement.setAttribute(
            "aria-pressed",
            String(this.autoScreenshotEnabled),
        );
        this.toolbarAutoScreenshotToggleElement.style.background =
            this.autoScreenshotEnabled ? "#dcfce7" : "#ffffff";
        this.toolbarAutoScreenshotToggleElement.style.borderColor =
            this.autoScreenshotEnabled ? "#16a34a" : "rgba(15, 23, 42, 0.24)";
        this.toolbarAutoScreenshotToggleElement.style.color =
            this.autoScreenshotEnabled ? "#166534" : "#111827";
    }

    private observeComposerForToolbar(): void {
        this.toolbarObserver = new MutationObserver(() => {
            if (!document.getElementById("chatbar-toolbar")) {
                this.renderToolbar();
            }
        });

        this.toolbarObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    private setToolbarStatus(message: string): void {
        if (this.toolbarStatusElement) {
            this.toolbarStatusElement.textContent = message;
        }
    }

    private getToolbarStatus(): string {
        return this.toolbarStatusElement?.textContent ?? "Ready";
    }

    private setToolbarSource(message: string): void {
        if (this.toolbarSourceElement) {
            this.toolbarSourceElement.textContent = message;
            this.toolbarSourceElement.title = message;
        }
    }

    private formatCaptureSource(
        payload: CaptureVisibleTabStatusMessage["payload"],
    ): string {
        if (!payload.url) {
            return `Page: ${payload.title ?? "active tab"}`;
        }

        try {
            const parsed = new URL(payload.url);
            return `Page: ${parsed.hostname || payload.url}`;
        } catch {
            return `Page: ${payload.url}`;
        }
    }

    private setToolbarButtonDisabled(disabled: boolean): void {
        if (!this.toolbarButtonElement) {
            return;
        }

        this.toolbarButtonElement.disabled = disabled;
        this.toolbarButtonElement.style.opacity = disabled ? "0.68" : "1";
        this.toolbarButtonElement.style.cursor = disabled ? "wait" : "pointer";
    }

    private log(message: string, details?: unknown): void {
        console.info(`[ChatBar content] ${message}`, details ?? "");
    }
}

new ChatGptContentScript().register();
