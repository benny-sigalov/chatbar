import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
    manifest_version: 3,
    name: "ChatBar",
    version: "1.0.1",
    description:
        "Attach screenshots of your current browser tab to ChatGPT from the side panel.",
    icons: {
        16: "icons/icon-16.png",
        32: "icons/icon-32.png",
        48: "icons/icon-48.png",
        128: "icons/icon-128.png",
    },
    action: {
        default_title: "ChatBar",
        default_icon: {
            16: "icons/icon-16.png",
            32: "icons/icon-32.png",
            48: "icons/icon-48.png",
            128: "icons/icon-128.png",
        },
    },
    permissions: ["activeTab", "sidePanel"],
    host_permissions: ["<all_urls>"],
    side_panel: {
        default_path: "sidepanel.html",
    },
    background: {
        service_worker: "src/background/background.ts",
        type: "module",
    },
    content_scripts: [
        {
            matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
            js: ["src/content/chatgpt.ts"],
            run_at: "document_idle",
        },
    ],
});
