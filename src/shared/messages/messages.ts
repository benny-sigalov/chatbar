export type MessageType = "CHATGPT_URL_UPDATED";

export type ChatGptUrlState = {
    url: string;
    title?: string;
    updatedAt: number;
    reason?: string;
};

export type ChatGptUrlUpdatedMessage = {
    type: MessageType;
    payload: ChatGptUrlState;
};

export type RuntimeMessage = ChatGptUrlUpdatedMessage;
