export interface ChatMessage {
    id: string;
    playerId: string;
    playerName: string;
    text: string;
    createdAt: string;
}

export interface ChatState {
    messages: ChatMessage[];
}
