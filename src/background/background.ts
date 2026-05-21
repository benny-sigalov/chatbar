import type {
    BackgroundMessage,
    ChatGptUrlState,
    RuntimeMessage,
} from "../shared/messages/messages";
import {
    captureCurrentVisibleTab,
    getVisibleTabCaptureStatus,
} from "./screenshot";

const defaultChatGptSidePanelUrl = "https://chatgpt.com/";

chrome.runtime.onInstalled.addListener(() => {
    void setUpSidePanel("install");
});

chrome.runtime.onStartup.addListener(() => {
    void setUpSidePanel("startup");
});

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "chatgpt-sidebar") {
        return;
    }

    const isSidebarPage = port.sender?.tab?.id === undefined;

    port.postMessage({
        type: "CHATGPT_PORT_INIT",
        payload: {
            isSidebarPage,
        },
    } satisfies BackgroundMessage);

    console.log("SIDEBAR CONNECTED: TabId = ", port.sender?.tab?.id);

    let latestChatGptUrl: ChatGptUrlState | undefined;
    const sendCaptureStatus = (): void => {
        void sendVisibleTabCaptureStatus(port);
    };

    if (isSidebarPage) {
        sendCaptureStatus();
        chrome.tabs.onActivated.addListener(sendCaptureStatus);
        chrome.tabs.onUpdated.addListener(sendCaptureStatus);
        chrome.windows.onFocusChanged.addListener(sendCaptureStatus);
    }

    port.onMessage.addListener((message: RuntimeMessage) => {
        if (message.type === "CHATGPT_URL_UPDATED") {
            latestChatGptUrl = message.payload;
            console.info("[ChatBar background] Saved latest ChatGPT URL", {
                url: latestChatGptUrl.url,
                reason: latestChatGptUrl.reason,
            });
            return;
        }

        if (message.type === "CAPTURE_VISIBLE_TAB") {
            void captureVisibleTabForPort(port, message.requestId);
        }
    });

    port.onDisconnect.addListener(() => {
        if (isSidebarPage) {
            chrome.tabs.onActivated.removeListener(sendCaptureStatus);
            chrome.tabs.onUpdated.removeListener(sendCaptureStatus);
            chrome.windows.onFocusChanged.removeListener(sendCaptureStatus);
        }

        const url = latestChatGptUrl?.url;

        console.log(
            "SIDEBAR DISCONNECTED TabId = ",
            port.sender?.tab?.id,
            " URL = ",url,
            " isSideBar = ", isSidebarPage
        );
        if (!url) {
            return;
        }

        if (!isSidebarPage) {
            return;
        }

        void setSidePanelUrl(url, "sidebar-disconnect");
    });
});

async function setUpSidePanel(reason: string): Promise<void> {
    await chrome.sidePanel.setPanelBehavior({
        openPanelOnActionClick: true,
    });

    await setSidePanelUrl(defaultChatGptSidePanelUrl, reason);
}

async function sendVisibleTabCaptureStatus(
    port: chrome.runtime.Port,
): Promise<void> {
    try {
        const status = await getVisibleTabCaptureStatus();

        port.postMessage({
            type: "CAPTURE_VISIBLE_TAB_STATUS",
            payload: status.canCapture
                ? {
                      canCapture: true,
                      url: status.url,
                      title: status.title,
                  }
                : {
                      canCapture: false,
                      url: status.url,
                      title: status.title,
                      reason:
                          status.reason ??
                          "This page cannot be captured.",
                  },
        } satisfies BackgroundMessage);
    } catch (error: unknown) {
        port.postMessage({
            type: "CAPTURE_VISIBLE_TAB_STATUS",
            payload: {
                canCapture: false,
                reason:
                    error instanceof Error
                        ? error.message
                        : "Could not inspect the active page.",
            },
        } satisfies BackgroundMessage);
    }
}

let lastUrl = "";

async function setSidePanelUrl(url: string, reason: string): Promise<void> {
    if (lastUrl === url) {
        return;
    }

    lastUrl = url;

    console.info("[ChatBar background] Setting side panel URL", {
        reason,
        url,
    });

    await chrome.sidePanel.setOptions({
        path: url,
        enabled: true,
    });
}

async function captureVisibleTabForPort(
    port: chrome.runtime.Port,
    requestId: string,
): Promise<void> {
    try {
        const screenshot = await captureCurrentVisibleTab();

        port.postMessage({
            type: "CAPTURE_VISIBLE_TAB_RESULT",
            requestId,
            payload: {
                ok: true,
                dataUrl: screenshot.dataUrl,
                capturedAt: screenshot.capturedAt,
            },
        } satisfies BackgroundMessage);
    } catch (error: unknown) {
        port.postMessage({
            type: "CAPTURE_VISIBLE_TAB_RESULT",
            requestId,
            payload: {
                ok: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Could not capture visible tab.",
            },
        } satisfies BackgroundMessage);
    }
}
