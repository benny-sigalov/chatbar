import type { ChatGptLocationChangedMessage } from "../shared/messages/messages";

class ChatGptContentScript {
    private lastReportedUrl = "";

    public register(): void {
        this.log("ChatGPT helper loaded", {
            url: location.href,
            title: document.title,
        });

        this.patchHistoryMethod("pushState");
        this.patchHistoryMethod("replaceState");

        window.addEventListener("popstate", this.reportLocationIfChanged);
        window.addEventListener("hashchange", this.reportLocationIfChanged);
        window.addEventListener("pagehide", this.reportPagehide);
        document.addEventListener(
            "visibilitychange",
            this.reportVisibilityHidden,
        );

        window.setInterval(this.reportLocationIfChanged, 1000);
        this.reportLocation("initial-load");
    }

    private reportLocation = (reason: string, force = false): void => {
        const url = location.href;

        if (!force && url === this.lastReportedUrl) {
            return;
        }

        this.lastReportedUrl = url;
        this.log("Reporting ChatGPT URL", {
            reason,
            force,
            url,
            title: document.title,
        });

        void this.sendLocationUpdate({
            type: "CHATGPT_LOCATION_CHANGED",
            payload: {
                url,
                title: document.title,
                updatedAt: Date.now(),
                reason,
            },
        } satisfies ChatGptLocationChangedMessage);
    };

    private reportLocationIfChanged = (): void => {
        this.reportLocation("location-change");
    };

    private reportPagehide = (): void => {
        this.reportLocation("pagehide", true);
    };

    private reportVisibilityHidden = (): void => {
        if (document.visibilityState === "hidden") {
            this.reportLocation("visibility-hidden", true);
        }
    };

    private patchHistoryMethod(method: "pushState" | "replaceState"): void {
        const original = history[method];
        const reportLocationIfChanged = this.reportLocationIfChanged;

        this.log(`Patching history.${method}`);

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

    private async sendLocationUpdate(
        message: ChatGptLocationChangedMessage,
    ): Promise<void> {
        try {
            const response = await chrome.runtime.sendMessage(message);
            this.log("Background acknowledged URL update", response);
        } catch {
            this.log(
                "Could not send URL update; extension may be reloading during development",
            );
        }
    }

    private log(message: string, details?: unknown): void {
        console.info(`[ChatBar content] ${message}`, details ?? "");
    }
}

new ChatGptContentScript().register();
