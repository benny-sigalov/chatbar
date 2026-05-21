export type PasteScreenshotResult =
    | "pasted"
    | "not-accepted"
    | "composer-not-found";

export type ChatBarToolbar = {
    autoScreenshotToggle: HTMLButtonElement;
    button: HTMLButtonElement;
    source: HTMLSpanElement;
    status: HTMLSpanElement;
};

export class ChatGptDom {
    public findComposer(): HTMLElement | null {
        return document.querySelector<HTMLElement>("#prompt-textarea");
    }

    public findComposerContainer(): HTMLElement | null {
        const composer = this.findComposer();

        if (!composer) {
            return null;
        }

        return (
            composer.closest<HTMLElement>("form") ??
            composer.closest<HTMLElement>('[role="presentation"]') ??
            composer.parentElement
        );
    }

    public async pasteScreenshotIntoComposer(
        blob: Blob,
    ): Promise<PasteScreenshotResult> {
        const composer = this.findComposer();

        if (!composer) {
            return "composer-not-found";
        }

        composer.focus();

        const beforeAttachmentCount = this.countAttachmentElements();
        const file = new File([blob], `chatbar-screenshot-${Date.now()}.png`, {
            type: blob.type || "image/png",
        });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        const pasteEvent = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: dataTransfer,
        });

        composer.dispatchEvent(pasteEvent);

        const accepted = await this.waitForAttachmentChange(
            beforeAttachmentCount,
        );

        return accepted ? "pasted" : "not-accepted";
    }

    public insertChatBarToolbar(
        onAutoScreenshotToggle: () => void,
        onScreenshotNow: () => void,
    ): ChatBarToolbar | undefined {
        if (document.getElementById("chatbar-toolbar")) {
            return undefined;
        }

        const container = this.findComposerContainer();

        if (!container) {
            return undefined;
        }

        const toolbar = document.createElement("section");
        toolbar.id = "chatbar-toolbar";
        toolbar.setAttribute("aria-label", "ChatBar toolbar");
        toolbar.style.display = "flex";
        toolbar.style.alignItems = "center";
        toolbar.style.gap = "8px";
        toolbar.style.flexWrap = "wrap";
        toolbar.style.margin = "8px 0 0";
        toolbar.style.padding = "6px 8px";
        toolbar.style.border = "1px solid rgba(15, 23, 42, 0.12)";
        toolbar.style.borderRadius = "8px";
        toolbar.style.background = "rgba(255, 255, 255, 0.86)";
        toolbar.style.color = "#111827";
        toolbar.style.font = "12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";

        const autoScreenshotToggle = document.createElement("button");
        autoScreenshotToggle.type = "button";
        autoScreenshotToggle.setAttribute("aria-pressed", "false");
        autoScreenshotToggle.textContent = "Auto screenshot: Off";
        autoScreenshotToggle.style.minHeight = "28px";
        autoScreenshotToggle.style.padding = "0 10px";
        autoScreenshotToggle.style.border = "1px solid rgba(15, 23, 42, 0.24)";
        autoScreenshotToggle.style.borderRadius = "6px";
        autoScreenshotToggle.style.background = "#ffffff";
        autoScreenshotToggle.style.color = "#111827";
        autoScreenshotToggle.style.cursor = "pointer";
        autoScreenshotToggle.style.font = "600 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
        autoScreenshotToggle.addEventListener("click", onAutoScreenshotToggle);

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Screenshot now";
        button.style.minHeight = "28px";
        button.style.padding = "0 10px";
        button.style.border = "1px solid #111827";
        button.style.borderRadius = "6px";
        button.style.background = "#111827";
        button.style.color = "#ffffff";
        button.style.cursor = "pointer";
        button.style.font = "600 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
        button.addEventListener("click", onScreenshotNow);

        const source = document.createElement("span");
        source.textContent = "Page: active tab";
        source.style.minWidth = "0";
        source.style.maxWidth = "180px";
        source.style.overflow = "hidden";
        source.style.textOverflow = "ellipsis";
        source.style.whiteSpace = "nowrap";
        source.style.color = "#4b5563";

        const status = document.createElement("span");
        status.textContent = "Ready";
        status.style.color = "#374151";
        status.style.marginLeft = "auto";

        toolbar.append(autoScreenshotToggle, button, source, status);
        container.insertAdjacentElement("afterend", toolbar);

        return {
            autoScreenshotToggle,
            button,
            source,
            status,
        };
    }

    private countAttachmentElements(): number {
        return document.querySelectorAll(
            [
                '[aria-label*="Remove"]',
                '[aria-label*="remove"]',
                '[data-testid*="attachment"]',
                '[data-testid*="file"]',
                'img[src^="blob:"]',
            ].join(","),
        ).length;
    }

    private waitForAttachmentChange(previousCount: number): Promise<boolean> {
        return new Promise((resolve) => {
            const timeout = window.setTimeout(() => {
                observer.disconnect();
                resolve(false);
            }, 3500);

            const observer = new MutationObserver(() => {
                if (this.countAttachmentElements() > previousCount) {
                    window.clearTimeout(timeout);
                    observer.disconnect();
                    resolve(true);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });

            if (this.countAttachmentElements() > previousCount) {
                window.clearTimeout(timeout);
                observer.disconnect();
                resolve(true);
            }
        });
    }
}
