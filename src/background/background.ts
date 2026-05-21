import type {
    BackgroundMessage,
    ChatGptUrlState,
    RuntimeMessage,
} from "../shared/messages/messages";

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

    port.onMessage.addListener((message: RuntimeMessage) => {
        if (message.type !== "CHATGPT_URL_UPDATED") {
            return;
        }

        latestChatGptUrl = message.payload;
        console.info("[ChatBar background] Saved latest ChatGPT URL", {
            url: latestChatGptUrl.url,
            reason: latestChatGptUrl.reason,
        });
    });

    port.onDisconnect.addListener(() => {
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
