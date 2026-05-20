import type { ChatGptUrlState } from './types';

export const CHATGPT_LOCATION_CHANGED = 'CHATGPT_LOCATION_CHANGED';

export type ChatGptLocationChangedMessage = {
    type: typeof CHATGPT_LOCATION_CHANGED;
    payload: ChatGptUrlState;
};

export type RuntimeMessage = ChatGptLocationChangedMessage;
