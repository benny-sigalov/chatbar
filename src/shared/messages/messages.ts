import type { ChatGptUrlState } from "../storage/storage";

export type MessageType = "CHATGPT_LOCATION_CHANGED";

export type ChatGptLocationChangedMessage = {
    type: MessageType;
    payload: ChatGptUrlState;
};

export type RuntimeMessage = ChatGptLocationChangedMessage;
