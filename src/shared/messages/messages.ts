export type ContentToBackgroundMessageType = "CHATGPT_URL_UPDATED";
export type BackgroundToContentMessageType = "CHATGPT_PORT_INIT";
export type ScreenshotRequestMessageType = "CAPTURE_VISIBLE_TAB";
export type ScreenshotResponseMessageType = "CAPTURE_VISIBLE_TAB_RESULT";
export type ScreenshotStatusMessageType = "CAPTURE_VISIBLE_TAB_STATUS";

export type ChatGptUrlState = {
    url: string;
    title?: string;
    updatedAt: number;
    reason?: string;
};

export type ChatGptUrlUpdatedMessage = {
    type: ContentToBackgroundMessageType;
    payload: ChatGptUrlState;
};

export type ChatGptPortInitMessage = {
    type: BackgroundToContentMessageType;
    payload: {
        isSidebarPage: boolean;
    };
};

export type CaptureVisibleTabMode = "manual" | "auto-send";

export type CaptureVisibleTabMessage = {
    type: ScreenshotRequestMessageType;
    requestId: string;
    mode?: CaptureVisibleTabMode;
};

export type CaptureVisibleTabResultMessage = {
    type: ScreenshotResponseMessageType;
    requestId: string;
    mode?: CaptureVisibleTabMode;
    payload:
        | {
              ok: true;
              dataUrl: string;
              capturedAt: number;
          }
        | {
              ok: false;
              error: string;
          };
};

export type CaptureVisibleTabStatusMessage = {
    type: ScreenshotStatusMessageType;
    payload:
        | {
              canCapture: true;
              url?: string;
              title?: string;
          }
        | {
              canCapture: false;
              url?: string;
              title?: string;
              reason: string;
          };
};

export type RuntimeMessage =
    | ChatGptUrlUpdatedMessage
    | CaptureVisibleTabMessage;
export type BackgroundMessage =
    | ChatGptPortInitMessage
    | CaptureVisibleTabResultMessage
    | CaptureVisibleTabStatusMessage;
