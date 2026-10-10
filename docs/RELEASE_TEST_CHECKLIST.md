# Release Test Checklist

Use a clean Chrome profile when possible.

## DOM Regression Checks

- [ ] Run `yarn dev --host 127.0.0.1` and open `http://127.0.0.1:5173/tests/chatgptDom.html`.
- [ ] All checks pass for the current textarea composer and the legacy contenteditable composer.
- [ ] Verify screenshot upload in a signed-in ChatGPT side panel; the fixture checks paste delivery and attachment detection, not ChatGPT's upload pipeline.

## Install

- [ ] `yarn build` succeeds.
- [ ] Extension loads from `dist`.
- [ ] Extension has expected permissions.
- [ ] Clicking the extension icon opens ChatGPT in the side panel.

## Manual Screenshot

- [ ] `Screenshot now` appears under the composer.
- [ ] Capturable page attaches a screenshot to ChatGPT.
- [ ] Protected page disables capture or shows a clear reason.
- [ ] Attachment can be removed using ChatGPT's native remove control.

## Auto Screenshot

- [ ] Default state is off.
- [ ] Toggle can be turned on.
- [ ] Pressing Enter captures and attaches a screenshot before sending.
- [ ] Ctrl+Enter bypasses auto screenshot and sends normally.
- [ ] Clicking Send captures and attaches a screenshot before sending.
- [ ] Empty composer / Dictate mode is not disrupted.
- [ ] Repeated Enter presses do not create duplicate screenshots.
- [ ] Repeated Send clicks do not create duplicate screenshots.

## Side Panel Lifecycle

- [ ] Closing and reopening the side panel preserves expected ChatGPT URL behavior.
- [ ] Normal ChatGPT tabs do not initialize the full toolbar behavior.

## Permissions / Privacy

- [ ] No screenshots are stored in extension storage.
- [ ] No network calls are made to a ChatBar backend.
- [ ] Chrome protected pages are handled gracefully.
