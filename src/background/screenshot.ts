export type VisibleTabScreenshot = {
    dataUrl: string;
    capturedAt: number;
};

export type VisibleTabCaptureStatus = {
    canCapture: boolean;
    url?: string;
    title?: string;
    reason?: string;
};

export async function captureCurrentVisibleTab(): Promise<VisibleTabScreenshot> {
    await assertCapturePermission();

    const status = await getVisibleTabCaptureStatus();

    if (!status.canCapture) {
        throw new Error(status.reason ?? "This page cannot be captured.");
    }

    const windowId = await getFocusedWindowId();
    const options: chrome.extensionTypes.ImageDetails = {
        format: "png",
    };
    const dataUrl =
        windowId === undefined
            ? await chrome.tabs.captureVisibleTab(options)
            : await chrome.tabs.captureVisibleTab(windowId, options);

    return {
        dataUrl,
        capturedAt: Date.now(),
    };
}

export async function getVisibleTabCaptureStatus(): Promise<VisibleTabCaptureStatus> {
    const tab = await getFocusedActiveTab();

    if (!tab) {
        return {
            canCapture: false,
            reason: "No active browser tab is available to capture.",
        };
    }

    if (!tab.url) {
        return {
            canCapture: false,
            title: tab.title,
            reason: "This page does not expose a capturable URL.",
        };
    }

    const blockedReason = getBlockedCaptureReason(tab.url);

    if (blockedReason) {
        return {
            canCapture: false,
            url: tab.url,
            title: tab.title,
            reason: blockedReason,
        };
    }

    return {
        canCapture: true,
        url: tab.url,
        title: tab.title,
    };
}

async function assertCapturePermission(): Promise<void> {
    const hasAllUrlsPermission = await chrome.permissions.contains({
        origins: ["<all_urls>"],
    });

    if (!hasAllUrlsPermission) {
        throw new Error(
            "ChatBar needs site access on all sites before it can capture from the side panel. Open chrome://extensions, ChatBar details, then set Site access to 'On all sites'.",
        );
    }
}

async function getFocusedActiveTab(): Promise<chrome.tabs.Tab | undefined> {
    const windowId = await getFocusedWindowId();
    const tabs = await chrome.tabs.query({
        active: true,
        windowId,
    });

    return tabs[0];
}

function getBlockedCaptureReason(url: string): string | undefined {
    const blockedSchemes = [
        "chrome:",
        "chrome-extension:",
        "edge:",
        "brave:",
        "about:",
        "devtools:",
    ];

    if (blockedSchemes.some((scheme) => url.startsWith(scheme))) {
        return "Chrome does not allow extensions to capture this browser page.";
    }

    if (url.startsWith("https://chrome.google.com/webstore")) {
        return "Chrome does not allow extensions to capture Chrome Web Store pages.";
    }

    return undefined;
}

async function getFocusedWindowId(): Promise<number | undefined> {
    try {
        const window = await chrome.windows.getLastFocused({
            windowTypes: ["normal"],
        });

        return window.id;
    } catch {
        return undefined;
    }
}
