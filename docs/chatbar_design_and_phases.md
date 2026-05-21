# ChatBar Design and Implementation Phases

## 1. Executive Summary

ChatBar is a Chrome extension that opens ChatGPT in the Chrome side panel and lets the user attach screenshots from the currently visible browser page as context for a ChatGPT message.

The core MVP experience:

```text
User browses a page
→ ChatGPT is open in the side panel
→ user writes a message
-> user optionally enables "Auto screenshot"
-> user optionally clicks "Screenshot now" while visiting other tabs
→ user clicks Send
-> if Auto screenshot is enabled, ChatBar captures a fresh screenshot of the current active page
-> ChatBar attaches the requested screenshot(s) to ChatGPT
→ ChatGPT sends the message
```

The key product promise:

```text
ChatGPT can see the page when the user explicitly asks it to.
```

ChatBar should not feel like browser monitoring or tracking. The user remains in control.

---

## 2. Product Goals

### Primary Goals

- Open ChatGPT in the Chrome side panel.
- Keep the main browser tab as the source page.
- Add an opt-in `Auto screenshot` control to ChatGPT.
- Add a `Screenshot now` action to ChatGPT.
- Allow immediate screenshot attachment from the current active tab.
- Capture a fresh screenshot before Send.
- Attach the screenshot to the ChatGPT message.
- Avoid permanent storage of screenshots.
- Keep the extension lightweight and easy to install.

### Secondary Goals

- Add a manual screenshot utility.
- Show which page is being included.
- Fail gracefully without losing the user's typed message.
- Use session-only state.

---

## 3. Non-Goals for MVP

ChatBar MVP should not include:

- Desktop app.
- Any-window capture outside Chrome.
- Full AI browser.
- Intent inference.
- Cross-tab semantic memory.
- DOM scraping from arbitrary pages.
- Continuous monitoring.
- Screenshot history.
- Analytics or tracking.
- Backend server.
- React UI, unless later needed for a richer popup or settings page.

---

## 4. Core Assumption

The revised architecture assumes:

```text
ChatGPT runs as the top-level page in the Chrome side panel.
The active browser tab remains the page the user wants ChatGPT to see.
```

This is the major simplification.

Old model:

```text
ChatGPT is a normal tab
→ remember previous tab
→ switch tabs to capture
→ switch back to ChatGPT
```

New model:

```text
ChatGPT is the side panel top-level page
→ active tab stays as source page
→ capture visible tab directly
```

Validated Phase 1 note:

```text
ChatGPT cannot be embedded with an iframe because chatgpt.com sends anti-framing
protections such as X-Frame-Options: SAMEORIGIN.

However, Chrome and Brave both allowed ChatBar to set the side panel path directly
to https://chatgpt.com/ with chrome.sidePanel.setOptions(). In that mode, ChatGPT
is not framed; it is the top-level side panel document, so iframe protections do
not apply.
```

This behavior should be treated as an important compatibility assumption and
re-tested during hardening and packaging.

---

## 5. UX Design

## 5.0 Extension Icon Behavior

Phase 1 behavior:

```text
User clicks ChatBar extension icon
-> ChatBar sets the side panel path to https://chatgpt.com/
-> browser opens the side panel
-> ChatGPT appears in the side panel
```

If the side panel is already open:

```text
Clicking the icon should open/focus/keep ChatBar open.
It does not need to toggle closed in MVP.
```

Reason:

- `chrome.sidePanel.open()` requires a user gesture.
- Native `openPanelOnActionClick` can open the panel without manual close/reopen.
- There is no reliable built-in `chrome.sidePanel.isOpen()` API.
- Calling close/reopen can reload ChatGPT and reset transient state.

Later toggle behavior:

```text
Once src/content/chatgpt.ts communicates reliably with
src/background/background.ts, ChatBar can track whether ChatGPT is currently
alive in the side panel. Then icon click can optionally close the side panel
with chrome.sidePanel.close() when supported.
```

## 5.1 Main ChatGPT Controls

Inside ChatGPT composer, near the Send button:

```text
[ ] Auto screenshot    [Screenshot now]
```

Recommended labels:

```text
Auto screenshot
Screenshot now
```

Meaning:

```text
Auto screenshot:
  When enabled, capture the current active tab just before Send and attach it.

Screenshot now:
  Immediately capture the current active tab and attach it to the current ChatGPT composer without sending.
```

This supports two workflows:

```text
1. User works on a main page and wants the latest visible state attached at send time.
2. User visits several relevant tabs/pages and manually attaches screenshots before sending.
```

Avoid labels like:

```text
Autoshare
Monitor page
Watch page
Track browsing
```

These sound invasive.

---

## 5.2 Send Behavior

When unchecked:

```text
Send behaves normally.
```

When checked:

```text
User clicks Send
→ ChatBar prevents immediate send
→ captures screenshot of the current visible tab
→ attaches image to ChatGPT composer
→ waits for attachment preview
→ sends message
```

`Screenshot now` behavior:

```text
User clicks Screenshot now
-> ChatBar captures the current visible tab immediately
-> attaches image to ChatGPT composer
-> does not send the message
```

---

## 5.3 User Feedback

Show short status near the composer:

```text
Capturing screenshot...
```

On success:

```text
Screenshot attached
```

On failure:

```text
Could not capture screenshot.
```

Important rule:

```text
Never block the user from sending.
Never lose the typed message.
```

---

## 5.4 Source Indicator

Show the current source page when possible:

```text
Page: example.com
```

or:

```text
Including: Product Comparison - Example Store
```

This improves trust because the user knows what ChatBar will include.

---

## 6. Privacy and Trust Model

ChatBar should follow these rules:

- No analytics.
- No backend.
- No screenshot history.
- No permanent image storage.
- No source-page DOM extraction in MVP.
- No continuous capture loop.
- No hidden sharing.
- Screenshot is captured only when the user clicks `Screenshot now` or sends with `Auto screenshot` enabled.

Suggested privacy wording:

```text
ChatBar only captures a screenshot when you explicitly click Screenshot now or send a ChatGPT message with Auto screenshot enabled. Screenshots are not stored, uploaded to our servers, or used for tracking.
```

---

## 7. High-Level Architecture

```text
Chrome Extension - Manifest V3

src/background/background.ts
  - tracks current source tab
  - captures visible tab screenshots
  - manages session-only state
  - handles extension messages
  - sets ChatGPT as the side panel path on extension icon click

sidepanel.html / src/sidepanel/sidepanel.ts
  - fallback helper UI if direct ChatGPT side panel path fails

src/content/chatgpt.ts
  - runs on ChatGPT
  - also runs when ChatGPT is loaded as the side panel top-level page
  - injects Auto screenshot toggle
  - injects Screenshot now action
  - intercepts Send
  - attaches screenshot
  - waits for preview
  - re-sends safely
  - later sends side-panel presence/open-close signals to background

src/shared/storage/storage.ts
  - typed wrapper over chrome.storage.session
  - exports session storage models such as ChatGptUrlState

src/background/screenshot.ts
  - capture helpers
  - dataUrl/blob/file conversion

src/content/chatgptDom.ts
  - composer detection
  - send button detection
  - toggle injection
  - image attachment logic
  - preview wait logic

src/shared/messages/messages.ts
  - typed runtime messages

src/types/chrome-globals.d.ts
  - Chrome extension type references
```

---

## 8. State Design

Use only:

```text
chrome.storage.session
```

Suggested session state:

```ts
type SessionState = {
    sourceTabId?: number;
    sourceWindowId?: number;
    sourceUrl?: string;
    sourceTitle?: string;

    includePageEnabled?: boolean;
    isCaptureInProgress?: boolean;
};
```

Store:

```text
tab id
window id
url
title
toggle state
temporary operation flags
```

Do not store:

```text
screenshots
image blobs
page DOM
form contents
ChatGPT message contents
```

---

## 9. Permissions

Recommended initial permissions:

```json
{
    "permissions": [
        "tabs",
        "activeTab",
        "scripting",
        "storage",
        "clipboardWrite",
        "sidePanel"
    ],
    "host_permissions": ["https://chatgpt.com/*", "https://chat.openai.com/*"]
}
```

Guidelines:

- Avoid `<all_urls>` in MVP.
- Keep permissions minimal.
- Add permissions only when there is a clear feature need.
- Explain permissions in README/store listing.

---

## 10. Known Technical Risks

### 10.1 ChatGPT in Side Panel

Critical early validation:

```text
Can ChatGPT run in the Chrome side panel as intended?
```

If not, fallback options:

- Side panel opens a helper UI with a button/link to ChatGPT.
- Side panel uses ChatGPT as a normal tab but controls workflow.
- Extension keeps ChatGPT tab and source tab coordination.

This should be tested before investing in later phases.

Validated result:

```text
Iframe embedding does not work.
Direct sidePanel.setOptions({ path: "https://chatgpt.com/" }) works in Chrome
and Brave in testing.
Content scripts run inside ChatGPT when loaded this way.
```

This should be re-tested before packaging or store submission.

### 10.2 Side Panel Open/Close State

There is no reliable built-in API like:

```ts
chrome.sidePanel.isOpen();
```

MVP behavior:

```text
Extension icon click opens/focuses ChatGPT in the side panel.
If already open, leaving it open is acceptable.
```

Future toggle behavior can be implemented after content script messaging exists:

```text
src/content/chatgpt.ts sends ready/pagehide/heartbeat messages
-> src/background/background.ts keeps approximate per-window side panel state
-> icon click can call chrome.sidePanel.close() when state says open
```

---

### 10.3 ChatGPT DOM Fragility

The ChatGPT UI may change.

Mitigation:

- Keep DOM logic isolated in `src/content/chatgptDom.ts`.
- Avoid brittle class-name selectors.
- Prefer accessible selectors where possible.
- Use `MutationObserver`.
- Avoid duplicate injected controls.

---

### 10.4 Attachment Reliability

Attaching images programmatically may require trial and adjustment.

Possible approaches:

- Clipboard paste simulation.
- DataTransfer paste/drop event.
- File input discovery if available.

This should be abstracted behind:

```ts
async function attachImageToComposer(dataUrl: string): Promise<void>;
```

---

## 11. Implementation Phases

## Phase 0 — Project Scaffold

### Goal

Have a clean Chrome extension project that builds and loads.

### Deliverables

- Manifest V3 extension.
- TypeScript.
- Vite.
- No React initially.
- Clean folder structure.
- `yarn build` works.
- Extension loads from `dist`.

### Success Criteria

```text
Chrome can load the extension from dist without errors.
```

---

## Phase 1 — Open ChatGPT in Side Panel

### Goal

Clicking ChatBar opens ChatGPT in Chrome’s side panel as the top-level side
panel page.

### Deliverables

- Side panel registered in `manifest.ts` and emitted to `manifest.json`.
- Extension icon sets side panel path to `https://chatgpt.com/`.
- Browser opens the side panel using action-click behavior.
- Content script can run on ChatGPT in the side panel.
- Local fallback page exists if direct ChatGPT side panel path fails.

### Success Criteria

```text
User clicks ChatBar icon
→ Chrome side panel opens
→ ChatGPT appears as the side panel top-level page
→ content script can inject a visible marker/control
```

### Important Validation

Validated:

```text
Iframe embedding is blocked.
Direct external side panel path works in Chrome and Brave.
Content script runs in side-panel ChatGPT.
```

Remaining risk:

```text
Direct external side panel path should be treated as compatibility-sensitive and
re-tested during hardening.
```

---

## Phase 2 — Capture Current Visible Page

### Goal

Capture the visible browser tab as an image.

### Deliverables

- Capture active visible tab using Chrome screenshot API.
- Return screenshot as temporary data URL/blob.
- No permanent storage.
- Error handling for protected pages.
- Temporary test/debug path to verify capture.

### Success Criteria

```text
User is viewing a page
→ ChatBar captures a PNG screenshot of that page
```

---

## Phase 3 - Inject Screenshot Controls

### Goal

Add screenshot controls inside ChatGPT UI.

### Deliverables

- Inject near ChatGPT Send button:

```text
[ ] Auto screenshot    [Screenshot now]
```

- Auto screenshot defaults off.
- Remember Auto screenshot setting during browser session.
- Screenshot now is an immediate action and does not change the toggle.
- Re-inject safely if ChatGPT UI re-renders.
- Avoid duplicate controls.
- Optionally show source title:

```text
Page: <source title>
```

### Success Criteria

```text
ChatGPT shows Auto screenshot and Screenshot now controls
Toggle survives UI re-render
No duplicate toggles
```

---

## Phase 4 — Intercept Send

### Goal

Detect when the user sends a ChatGPT message.

### Deliverables

When `Auto screenshot` is off:

```text
Send works normally.
```

When `Auto screenshot` is on:

```text
prevent original send
show "Capturing screenshot..."
request screenshot
continue only after screenshot is ready
```

Implementation requirements:

- Capture-phase click interception.
- Re-entry guard to avoid infinite loop.
- Double-click protection.
- Graceful failure path.

### Success Criteria

```text
Auto screenshot off → normal send
Auto screenshot on → Send is intercepted safely
No infinite loop
Typed message remains intact
```

---

## Phase 5 — Attach Screenshot Before Sending

### Goal

Add the screenshot to the ChatGPT message.

### Deliverables

- Convert screenshot to `Blob` / `File`.
- Attach to composer using:
    - paste simulation, or
    - drop simulation, or
    - file input if discoverable.
- Wait for attachment preview/upload readiness.
- Programmatically send after preview appears.

### Failure Rule

```text
If attach fails, show error and allow/send text normally.
```

### Success Criteria

```text
User clicks Send with Auto screenshot enabled
→ screenshot attaches
→ preview appears
→ message sends
```

---

## Phase 6 - Manual Screenshot Utility

### Goal

Provide manual screenshot attachment outside ChatGPT auto-send.

### Deliverables

- ChatGPT composer action:

```text
Screenshot now
```

- Captures current visible tab.
- Attaches image to ChatGPT composer.
- Shows feedback:

```text
Screenshot attached
```

### Success Criteria

```text
User clicks screenshot action
→ screenshot is attached to the current ChatGPT composer
→ message is not sent automatically
```

---

## Phase 7 — Source Clarity and Trust Polish

### Goal

Make ChatBar feel safe and predictable.

### Deliverables

- Source page indicator.
- Clear statuses:
    - `Capturing screenshot...`
    - `Screenshot attached`
    - `Could not capture screenshot`
- Clean failure behavior.
- No hidden capture.
- No analytics.
- No screenshot history.
- No source-page DOM scraping.
- Permission review.

### Success Criteria

```text
User always understands what will be included and when.
```

---

## Phase 8 — Hardening

### Goal

Make MVP reliable enough for daily use.

### Deliverables

Handle:

- ChatGPT DOM changes.
- Upload timeout.
- Protected/unavailable pages.
- Side panel close/reopen.
- Browser reload.
- Source tab navigation during capture.
- Duplicate send events.
- Extension reload during development.
- Direct external side panel path behavior across supported browsers.
- Side panel open/close lifecycle.

Also:

- Remove unused permissions.
- Add dev logging flag.
- Add manual test checklist.
- Consider optional icon toggle behavior using content script presence tracking
  and `chrome.sidePanel.close()` when supported.

### Success Criteria

```text
Common failure cases are handled gracefully.
```

---

## Phase 9 — Packaging / Chrome Web Store Readiness

### Goal

Prepare for sharing or publishing.

### Deliverables

- Icons.
- Manifest description.
- README.
- Privacy statement.
- Known limitations.
- Manual test checklist.
- Store listing copy.
- Clean production build.

### Success Criteria

```text
Extension is ready to share as an unpacked build or prepare for Chrome Web Store submission.
```

---

## 12. Suggested File Structure

```text
src/
  background/
    background.ts
    screenshot.ts
    tabTracker.ts
  content/
    chatgpt.ts
    chatgptDom.ts
  shared/
    messages/
      messages.ts
    storage/
      storage.ts
  sidepanel/
    sidepanel.css
    sidepanel.ts
  types/
    chrome-globals.d.ts

package.json
manifest.ts
sidepanel.html
tsconfig.json
vite.config.ts
README.md
```

---

## 13. Development Workflow

Recommended repo path:

```text
D:\dev\chatbar
```

Recommended stack:

```text
Yarn 4
TypeScript
Vite
Manifest V3
Plain DOM content scripts
VS Code
Codex
```

Typical loop:

```text
1. Implement one phase.
2. Run yarn build.
3. Reload extension in chrome://extensions.
4. Test manually.
5. Commit.
6. Move to next phase.
```

Recommended after each successful phase:

```cmd
git add .
git commit -m "Phase X - short description"
```

---

## 14. Final MVP Definition

The MVP is complete when:

```text
ChatBar opens ChatGPT in the side panel.
The user can enable Auto screenshot.
The user can click Screenshot now to attach screenshots manually.
When sending with Auto screenshot enabled, ChatBar captures the current visible browser page.
Screenshots are attached to ChatGPT before the message is sent, or immediately when Screenshot now is clicked.
No screenshots are stored permanently.
The user gets clear feedback and normal sending is never broken.
```

---

## 15. Product Positioning

Good positioning:

```text
ChatBar lets ChatGPT see the page you are asking about.
```

or:

```text
Include your current page in ChatGPT with one click.
```

Avoid positioning:

```text
AI monitors your browsing.
Auto-share everything with ChatGPT.
Browser tracking assistant.
```

The product should feel explicit, lightweight, and user-controlled.
