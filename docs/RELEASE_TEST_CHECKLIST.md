# Release Test Checklist

Use a clean Chrome profile when possible.

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
