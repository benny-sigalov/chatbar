import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
    manifest_version: 3,
    name: "ChatBar",
    version: "0.0.0",
    description: "ChatBar Chrome extension.",
    action: {
        default_title: "ChatBar",
    },
    permissions: ["activeTab", "clipboardWrite", "sidePanel"],
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
