import type { ChatGptUrlUpdatedMessage } from "../shared/messages/messages";

class ChatGptContentScript {
    private lastReportedUrl = "";
    private readonly port = chrome.runtime.connect({
        name: "chatgpt-sidebar",
    });

    public register(): void {
        this.log("ChatGPT helper loaded", {
            url: location.href,
            title: document.title,
        });

        this.patchHistoryMethod("pushState");
        this.patchHistoryMethod("replaceState");

        window.addEventListener("popstate", this.reportLocationIfChanged);
        window.addEventListener("hashchange", this.reportLocationIfChanged);
        window.setInterval(this.reportLocationIfChanged, 1000);

        this.reportLocation("initial-load", true);
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

    private log(message: string, details?: unknown): void {
        console.info(`[ChatBar content] ${message}`, details ?? "");
    }
}

new ChatGptContentScript().register();
