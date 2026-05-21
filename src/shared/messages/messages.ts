export type ContentToBackgroundMessageType = "CHATGPT_URL_UPDATED";
export type BackgroundToContentMessageType = "CHATGPT_PORT_INIT";

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

export type RuntimeMessage = ChatGptUrlUpdatedMessage;
export type BackgroundMessage = ChatGptPortInitMessage;
