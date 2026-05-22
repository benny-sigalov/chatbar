# ChatBar

ChatBar is a Chrome extension that opens ChatGPT in the browser side panel and lets you attach a screenshot of the currently visible browser tab to your current ChatGPT message.

ChatBar is not affiliated with, endorsed by, or sponsored by OpenAI.

If ChatBar is useful to you, you can buy me a coffee:

https://buymeacoffee.com/benny-sigalov

## Contact

chatbar@fastmail.com

## What It Does

- Opens ChatGPT in Chrome's side panel.
- Adds a small ChatBar toolbar below the ChatGPT composer.
- Adds `Screenshot now` to capture the active visible tab and attach it to the current ChatGPT message.
- Adds an opt-in `Auto screenshot` mode that captures and attaches a screenshot before sending.
- Does not store screenshot history.
- Does not run a backend service.
- Does not send screenshots or page data to a ChatBar server.
- Does not collect usage stats, analytics, telemetry, or tracking information.

## Privacy Summary

Screenshots are captured only after a user action: clicking `Screenshot now` or sending while `Auto screenshot` is enabled.

ChatBar does not send the screenshot to a ChatBar backend. There is no ChatBar backend. ChatBar does not collect usage stats, analytics, telemetry, or tracking information. The extension captures the visible tab in your browser and pastes the screenshot directly into the ChatGPT composer, similar to taking a screenshot yourself and attaching or pasting it manually. From there, ChatGPT handles upload, preview, removal, and sending.

See [PRIVACY.md](PRIVACY.md) and [LEGAL.md](LEGAL.md).

## Permissions

ChatBar requests:

- `sidePanel`: to open ChatGPT in Chrome's side panel.
- `activeTab`: retained for Chrome extension user-gesture compatibility.
- `<all_urls>` host access: required for side-panel initiated screenshot capture of the currently visible tab.
- Host access to `chatgpt.com` and `chat.openai.com`: to inject the ChatBar toolbar into ChatGPT.

Chrome does not allow extensions to capture protected browser pages such as `chrome://` pages.

## Development

Requirements:

- Node.js
- Yarn 4
- Chrome or a Chromium browser with side panel support

Install dependencies:

```bash
yarn install
```

Run a dev build:

```bash
yarn dev
```

Create a production build:

```bash
yarn build
```

Run checks:

```bash
yarn check
```

## Load Locally

1. Run `yarn build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click `Load unpacked`.
5. Select the `dist` folder.
6. Open ChatBar from the extension icon.

## Package For Chrome Web Store

```bash
yarn package
```

This creates a zip in `release/` from the built `dist/` folder.

See [docs/PUBLISHING.md](docs/PUBLISHING.md).

## License

MIT. See [LICENSE](LICENSE).
