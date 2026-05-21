import type {
    BackgroundMessage,
    CaptureVisibleTabStatusMessage,
    CaptureVisibleTabResultMessage,
    ChatGptUrlUpdatedMessage,
} from "../shared/messages/messages";

class ChatGptContentScript {
    private lastReportedUrl = "";
    private captureRequestSequence = 0;
    private debugStatusElement?: HTMLDivElement;
    private debugSourceElement?: HTMLDivElement;
    private debugImageElement?: HTMLImageElement;
    private debugButtonElement?: HTMLButtonElement;
    private canCaptureVisibleTab = true;
    private activeCaptureSourceKey = "";
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
        window.setInterval(this.reportLocationIfChanged, 1000);
        document.addEventListener(
            "chatbar:capture-visible-tab",
            this.requestVisibleTabCapture,
        );
        this.renderDebugOverlay();

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
        if (!this.canCaptureVisibleTab) {
            this.setDebugStatus("This page cannot be captured.");
            return;
        }

        const requestId = `capture-${Date.now()}-${this.captureRequestSequence++}`;

        this.log("Requesting visible tab capture", { requestId });
        this.setDebugStatus("Capturing visible tab...");
        this.setDebugButtonDisabled(true);
        this.port.postMessage({
            type: "CAPTURE_VISIBLE_TAB",
            requestId,
        });
    };

    private async handleCaptureVisibleTabResult(
        message: CaptureVisibleTabResultMessage,
    ): Promise<void> {
        if (!message.payload.ok) {
            this.log("Visible tab capture failed", {
                requestId: message.requestId,
                error: message.payload.error,
            });
            this.setDebugStatus(`Capture failed: ${message.payload.error}`);
            this.setDebugButtonDisabled(false);
            return;
        }

        this.log("Visible tab captured", {
            requestId: message.requestId,
            capturedAt: message.payload.capturedAt,
            dataUrlLength: message.payload.dataUrl.length,
        });
        this.setDebugStatus(
            `Captured ${new Date(message.payload.capturedAt).toLocaleTimeString()}`,
        );
        this.setDebugButtonDisabled(false);

        if (this.debugImageElement) {
            this.debugImageElement.src = message.payload.dataUrl;
            this.debugImageElement.hidden = false;
        }

        await this.copyDataUrlToClipboard(message.payload.dataUrl);
    }

    private async copyDataUrlToClipboard(dataUrl: string): Promise<void> {
        try {
            const blob = await this.dataUrlToBlob(dataUrl);

            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob,
                }),
            ]);

            this.setDebugStatus("Captured and copied to clipboard");
        } catch (error: unknown) {
            this.setDebugStatus(
                error instanceof Error
                    ? `Captured, but copy failed: ${error.message}`
                    : "Captured, but copy failed.",
            );
        }
    }

    private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
        const response = await fetch(dataUrl);

        return response.blob();
    }

    private handleCaptureVisibleTabStatus(
        message: CaptureVisibleTabStatusMessage,
    ): void {
        this.canCaptureVisibleTab = message.payload.canCapture;
        const sourceKey = message.payload.url ?? message.payload.title ?? "";
        const sourceChanged = sourceKey !== this.activeCaptureSourceKey;

        this.activeCaptureSourceKey = sourceKey;

        if (message.payload.canCapture) {
            this.setDebugSource(this.formatCaptureSource(message.payload));
            this.clearDebugImageIfSourceChanged(sourceChanged);
            this.setDebugStatus(sourceChanged ? "Ready" : this.getDebugStatus());
            this.setDebugButtonDisabled(false);
            return;
        }

        this.setDebugSource(this.formatCaptureSource(message.payload));
        this.setDebugStatus(message.payload.reason);
        this.clearDebugImage();
        this.setDebugButtonDisabled(true);
    }

    private renderDebugOverlay(): void {
        if (document.getElementById("chatbar-debug-overlay")) {
            return;
        }

        const overlay = document.createElement("section");
        overlay.id = "chatbar-debug-overlay";
        overlay.setAttribute("aria-label", "ChatBar screenshot debug");
        overlay.style.position = "fixed";
        overlay.style.right = "12px";
        overlay.style.bottom = "12px";
        overlay.style.zIndex = "2147483647";
        overlay.style.display = "grid";
        overlay.style.gap = "8px";
        overlay.style.width = "260px";
        overlay.style.maxWidth = "calc(100vw - 24px)";
        overlay.style.padding = "10px";
        overlay.style.border = "1px solid rgba(15, 23, 42, 0.18)";
        overlay.style.borderRadius = "8px";
        overlay.style.background = "rgba(255, 255, 255, 0.96)";
        overlay.style.boxShadow = "0 10px 30px rgba(15, 23, 42, 0.16)";
        overlay.style.color = "#111827";
        overlay.style.font = "12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";

        const title = document.createElement("div");
        title.textContent = "ChatBar screenshot debug";
        title.style.fontWeight = "600";

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Capture visible tab";
        button.style.width = "100%";
        button.style.minHeight = "32px";
        button.style.border = "1px solid #111827";
        button.style.borderRadius = "6px";
        button.style.background = "#111827";
        button.style.color = "#ffffff";
        button.style.cursor = "pointer";
        button.style.font = "600 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
        button.addEventListener("click", this.requestVisibleTabCapture);

        const status = document.createElement("div");
        status.textContent = "Ready";
        status.style.minHeight = "18px";
        status.style.color = "#374151";

        const source = document.createElement("div");
        source.textContent = "Page: active tab";
        source.style.minHeight = "18px";
        source.style.overflow = "hidden";
        source.style.textOverflow = "ellipsis";
        source.style.whiteSpace = "nowrap";
        source.style.color = "#4b5563";

        const image = document.createElement("img");
        image.hidden = true;
        image.alt = "Latest captured visible tab";
        image.style.width = "100%";
        image.style.maxHeight = "180px";
        image.style.objectFit = "contain";
        image.style.border = "1px solid rgba(15, 23, 42, 0.12)";
        image.style.borderRadius = "6px";
        image.style.background = "#f9fafb";

        overlay.append(title, button, status, source, image);
        document.documentElement.append(overlay);

        this.debugStatusElement = status;
        this.debugSourceElement = source;
        this.debugImageElement = image;
        this.debugButtonElement = button;
    }

    private setDebugStatus(message: string): void {
        if (this.debugStatusElement) {
            this.debugStatusElement.textContent = message;
        }
    }

    private getDebugStatus(): string {
        return this.debugStatusElement?.textContent ?? "Ready";
    }

    private setDebugSource(message: string): void {
        if (this.debugSourceElement) {
            this.debugSourceElement.textContent = message;
            this.debugSourceElement.title = message;
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

    private clearDebugImageIfSourceChanged(sourceChanged: boolean): void {
        if (sourceChanged) {
            this.clearDebugImage();
        }
    }

    private clearDebugImage(): void {
        if (!this.debugImageElement) {
            return;
        }

        this.debugImageElement.removeAttribute("src");
        this.debugImageElement.hidden = true;
    }

    private setDebugButtonDisabled(disabled: boolean): void {
        if (!this.debugButtonElement) {
            return;
        }

        this.debugButtonElement.disabled = disabled;
        this.debugButtonElement.style.opacity = disabled ? "0.68" : "1";
        this.debugButtonElement.style.cursor = disabled ? "wait" : "pointer";
    }

    private log(message: string, details?: unknown): void {
        console.info(`[ChatBar content] ${message}`, details ?? "");
    }
}

new ChatGptContentScript().register();
