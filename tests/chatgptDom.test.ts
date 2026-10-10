import { ChatGptDom } from "../src/content/chatgptDom";

// Minimal structural fixture from chatgpt.com, inspected October 10, 2026.
const currentComposer = `
    <form data-mobile-composer>
        <div data-composer-wrap-outer>
            <div data-composer-wrap-inner>
                <div data-composer-primary>
                    <div data-composer-editor-host>
                        <textarea id="mobile-composer-prompt" data-mobile-composer-prompt name="prompt"></textarea>
                    </div>
                </div>
                <button type="button" aria-label="Start dictation"></button>
                <button type="submit" data-composer-submit aria-label="Send message"
                    data-send-label="Send message" data-stop-label="Stop generating"
                    aria-disabled="true" data-visually-disabled></button>
            </div>
        </div>
    </form>`;

const fixture = document.querySelector<HTMLDivElement>("#fixture")!;
const results = document.querySelector<HTMLPreElement>("#results")!;
const dom = new ChatGptDom();
const output: string[] = [];
let failures = 0;

function assert(condition: boolean, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

async function test(name: string, run: () => void | Promise<void>) {
    fixture.innerHTML = currentComposer;
    try {
        await run();
        output.push(`PASS ${name}`);
    } catch (error) {
        failures++;
        output.push(`FAIL ${name}: ${error}`);
    }
}

await test("find current composer and place toolbar below its form", () => {
    const composer = fixture.querySelector<HTMLElement>("textarea")!;
    assert(dom.findComposer() === composer, "current textarea was not found");
    const form = fixture.querySelector("form")!;
    assert(dom.findComposerContainer() === form, "wrong composer container");
    const toolbar = dom.insertChatBarToolbar(
        () => {},
        () => {},
    );
    assert(!!toolbar, "toolbar was not inserted");
    assert(
        form.nextElementSibling?.id === "chatbar-toolbar",
        "wrong placement",
    );
    assert(
        !dom.insertChatBarToolbar(
            () => {},
            () => {},
        ),
        "duplicate toolbar",
    );
});

await test("intercept plain Enter in the current textarea", () => {
    const composer = fixture.querySelector("textarea")!;
    let intercepted = false;
    composer.addEventListener("keydown", (event) => {
        intercepted = dom.isPlainEnterInComposer(event);
    });
    composer.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    assert(intercepted, "plain Enter was missed");
    composer.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", shiftKey: true }),
    );
    assert(!intercepted, "Shift+Enter was intercepted");
});

await test("deliver screenshot paste to the current composer", async () => {
    const composer = fixture.querySelector("textarea")!;
    let pastedFile: File | undefined;
    composer.addEventListener("paste", (event) => {
        pastedFile = event.clipboardData?.files[0];
        const remove = document.createElement("button");
        remove.setAttribute("aria-label", "Remove attachment");
        composer.parentElement!.append(remove);
    });
    const result = await dom.pasteScreenshotIntoComposer(
        new Blob(["screenshot fixture"], { type: "image/png" }),
    );
    assert(result === "pasted", "attachment was not detected");
    assert(document.activeElement === composer, "wrong paste target focus");
    assert(
        pastedFile?.type === "image/png",
        "clipboard file was not delivered",
    );
    assert(
        (await pastedFile.text()) === "screenshot fixture",
        "clipboard file contents changed",
    );
});

await test("find send in composer and respect aria-disabled", async () => {
    const send = fixture.querySelector<HTMLButtonElement>(
        "[data-composer-submit]",
    )!;
    assert(dom.findSendButton() === send, "current send button was not found");
    assert(
        !(await dom.waitForSendButtonReady(10, 1)),
        "disabled send was ready",
    );
    send.removeAttribute("aria-disabled");
    send.removeAttribute("data-visually-disabled");
    assert(
        (await dom.waitForSendButtonReady(10, 1)) === send,
        "send never ready",
    );
    send.disabled = true;
    assert(
        !(await dom.waitForSendButtonReady(10, 1)),
        "native disabled ignored",
    );
});

await test("exclude Stop generating and unrelated send controls", () => {
    fixture.insertAdjacentHTML(
        "afterbegin",
        '<button data-testid="send-button" aria-label="Send prompt"></button>',
    );
    const send = fixture.querySelector<HTMLButtonElement>(
        "[data-composer-submit]",
    )!;
    assert(dom.findSendButton() === send, "selected unrelated send");
    send.setAttribute("aria-label", "Stop generating");
    assert(!dom.findSendButton(), "selected Stop or unrelated send");
});

await test("keep legacy contenteditable composer support", () => {
    fixture.innerHTML = `<form><div id="prompt-textarea" contenteditable="true"><p>Draft</p></div><button id="composer-submit-button" aria-label="Send prompt"></button></form>`;
    assert(
        dom.findComposer()?.id === "prompt-textarea",
        "legacy composer missed",
    );
    assert(
        dom.findSendButton()?.id === "composer-submit-button",
        "legacy send missed",
    );
});

await test("find the signed-in markdown editor and insert its toolbar", () => {
    // Markup supplied from the user's signed-in sidebar.
    fixture.innerHTML = `<div data-rich-text-layout="single-line" role="presentation" data-composer-input-layout="single-line" data-composer-input-variant="default">
        <div contenteditable="true" aria-multiline="true" dir="auto" role="textbox" spellcheck="true" tabindex="0" translate="no" class="ProseMirror" data-composer-markdown aria-label="Ask ChatGPT" data-virtualkeyboard="true">
            <p data-empty-paragraph="true" data-placeholder="Ask ChatGPT" class="placeholder"><br class="ProseMirror-trailingBreak"></p>
        </div>
    </div>`;
    const composer = fixture.querySelector<HTMLElement>(
        "[data-composer-markdown]",
    )!;
    assert(dom.findComposer() === composer, "markdown editor was not found");
    const toolbar = dom.insertChatBarToolbar(
        () => {},
        () => {},
    );
    assert(!!toolbar, "toolbar was not inserted");
    assert(
        composer.parentElement!.nextElementSibling?.id === "chatbar-toolbar",
        "toolbar was inserted inside the editor's clipped layout",
    );
});

// Exercise the real content script against the supplied markdown editor.
// The runtime stub records capture requests without capturing or sending data.
try {
    document.getElementById("chatbar-toolbar")?.remove();
    fixture.innerHTML = `<form>${fixture.innerHTML}<div class="min-w-0"><div class="contents"><div class="flex items-center"><button type="button" aria-label="Dictate"></button><div class="ms-2 flex items-center"><button type="submit" aria-label="Send"><svg class="icon-primary-action"></svg></button></div></div></div></div></form>`;
    fixture
        .querySelector("form")!
        .addEventListener("submit", (event) => event.preventDefault());
    let listeners: Array<(message: unknown) => void> = [];
    let disconnectListeners: Array<() => void> = [];
    let connected = true;
    let connections = 0;
    const messages: Array<{ type: string; mode?: string; requestId?: string }> =
        [];
    const makePort = () => ({
        onMessage: {
            addListener: (listener: (message: unknown) => void) =>
                listeners.push(listener),
        },
        onDisconnect: {
            addListener: (listener: () => void) =>
                disconnectListeners.push(listener),
        },
        postMessage: (message: {
            type: string;
            mode?: string;
            requestId?: string;
        }) => {
            if (!connected)
                throw new Error("Attempting to use a disconnected port object");
            messages.push(message);
        },
    });
    Object.defineProperty(window, "chrome", {
        configurable: true,
        value: {
            runtime: {
                connect: () => {
                    connections++;
                    connected = true;
                    listeners = [];
                    disconnectListeners = [];
                    return makePort();
                },
            },
        },
    });
    await import("../src/content/chatgpt");
    listeners.forEach((listener) =>
        listener({
            type: "CHATGPT_PORT_INIT",
            payload: { isSidebarPage: true },
        }),
    );
    const toggle = document.querySelector<HTMLButtonElement>(
        "#chatbar-toolbar button[aria-pressed]",
    )!;
    assert(!!toggle, "content script did not render toolbar");
    toggle.click();
    assert(
        toggle.getAttribute("aria-pressed") === "true",
        "auto screenshot was not enabled",
    );
    const paragraph = fixture.querySelector("[data-composer-markdown] p")!;
    paragraph.dispatchEvent(
        new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            cancelable: true,
        }),
    );
    const capture = messages.find(
        (message) => message.type === "CAPTURE_VISIBLE_TAB",
    );
    assert(
        capture?.mode === "auto-send",
        "Enter did not request auto screenshot",
    );
    listeners.forEach((listener) =>
        listener({
            type: "CAPTURE_VISIBLE_TAB_RESULT",
            requestId: capture.requestId,
            mode: "auto-send",
            payload: { ok: false, error: "End of fixture capture" },
        }),
    );
    output.push(
        "PASS content script captures on Enter in supplied markdown editor",
    );

    messages.length = 0;
    const ctrlEnter = new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
    });
    paragraph.dispatchEvent(ctrlEnter);
    const ctrlCapture = messages.find(
        (message) => message.type === "CAPTURE_VISIBLE_TAB",
    );
    assert(!ctrlEnter.defaultPrevented, "Ctrl+Enter bypass was intercepted");
    assert(!ctrlCapture, "Ctrl+Enter bypass requested screenshot");
    output.push("PASS Ctrl+Enter bypasses auto screenshot");

    messages.length = 0;
    const send = fixture.querySelector<HTMLButtonElement>(
        'button[aria-label="Send"]',
    )!;
    let sends = 0;
    send.addEventListener("click", () => {
        sends++;
    });
    fixture
        .querySelector("[data-composer-markdown]")!
        .addEventListener("paste", () => {
            const attachment = document.createElement("button");
            attachment.type = "button";
            attachment.setAttribute("aria-label", "Remove attachment");
            fixture.querySelector("form")!.append(attachment);
        });
    send.click();
    const clickCapture = messages.find(
        (message) => message.type === "CAPTURE_VISIBLE_TAB",
    );
    assert(
        clickCapture?.mode === "auto-send",
        "Send click did not request auto screenshot",
    );
    assert(sends === 0, "text was sent before screenshot attachment");
    listeners.forEach((listener) =>
        listener({
            type: "CAPTURE_VISIBLE_TAB_RESULT",
            requestId: clickCapture.requestId,
            mode: "auto-send",
            payload: {
                ok: true,
                dataUrl: "data:image/png;base64,c2NyZWVuc2hvdA==",
                capturedAt: Date.now(),
            },
        }),
    );
    const deadline = Date.now() + 1500;
    while (!sends && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 10));
    assert(
        Number(sends) === 1,
        "send did not resume exactly once after attachment",
    );
    assert(
        !!fixture.querySelector('[aria-label="Remove attachment"]'),
        "send resumed without attachment",
    );
    output.push(
        "PASS current Send click captures, attaches, then sends exactly once",
    );

    messages.length = 0;
    const patchedPushState = history.pushState;
    const oldDisconnectListeners = [...disconnectListeners];
    connected = false;
    disconnectListeners.forEach((listener) => listener());
    send.click();
    assert(connections === 2, "capture reused the disconnected port");
    const reconnectedCapture = messages.find(
        (message) => message.type === "CAPTURE_VISIBLE_TAB",
    );
    assert(
        reconnectedCapture?.mode === "auto-send",
        "capture was not requested on fresh port",
    );
    listeners.forEach((listener) =>
        listener({
            type: "CHATGPT_PORT_INIT",
            payload: { isSidebarPage: true },
        }),
    );
    assert(
        history.pushState === patchedPushState,
        "reconnect initialized sidebar tracking twice",
    );
    assert(
        toggle.getAttribute("aria-pressed") === "true",
        "auto screenshot setting lost on reconnect",
    );
    listeners.forEach((listener) =>
        listener({
            type: "CAPTURE_VISIBLE_TAB_RESULT",
            requestId: reconnectedCapture.requestId,
            mode: "auto-send",
            payload: { ok: false, error: "End of fixture capture" },
        }),
    );
    assert(sends === 1, "reconnect sent text before capture completed");
    output.push(
        "PASS auto screenshot reconnects after port disconnect without sending text early",
    );

    oldDisconnectListeners.forEach((listener) => listener());
    messages.length = 0;
    send.click();
    assert(connections === 2, "stale disconnect retired the fresh connection");
    const retryCapture = messages.find(
        (message) => message.type === "CAPTURE_VISIBLE_TAB",
    );
    assert(!!retryCapture, "fresh connection was not reusable");
    listeners.forEach((listener) =>
        listener({
            type: "CAPTURE_VISIBLE_TAB_RESULT",
            requestId: retryCapture.requestId,
            mode: "auto-send",
            payload: { ok: false, error: "End of fixture capture" },
        }),
    );
    output.push("PASS stale disconnect does not break the fresh connection");

    connected = false;
    disconnectListeners.forEach((listener) => listener());
    window.chrome.runtime.connect = () => {
        throw new Error("Extension context invalidated.");
    };
    messages.length = 0;
    send.click();
    assert(
        !messages.some((message) => message.type === "CAPTURE_VISIBLE_TAB"),
        "capture dispatched from invalidated context",
    );
    assert(sends === 1, "text sent without screenshot after extension reload");
    assert(
        document
            .getElementById("chatbar-toolbar")!
            .textContent!.includes("Close and reopen the ChatGPT sidebar"),
        "missing recovery instruction for extension reload",
    );
    output.push(
        "PASS extension reload preserves unsent text and gives sidebar recovery instruction",
    );
} catch (error) {
    failures++;
    output.push(`FAIL content script auto screenshot: ${error}`);
}

results.textContent = `${output.join("\n")}\n${failures ? `${failures} failed` : "All checks passed"}`;
document.title = failures ? "FAIL: ChatGPT DOM" : "PASS: ChatGPT DOM";
