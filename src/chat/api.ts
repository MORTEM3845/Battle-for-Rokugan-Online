import type { ChatState } from '../../shared/chat';
import type { PlayerSession } from '../../shared/room';
import { apiRequest } from '../api/request';

export const chatApi = {
    get: (code: string) => apiRequest<ChatState>(`/api/rooms/${code}/chat`),
    send: (session: PlayerSession, playerName: string, text: string) => apiRequest<ChatState>(
        `/api/rooms/${session.roomCode}/chat`,
        { method: 'POST', body: JSON.stringify({ playerId: session.playerId, playerName, text }) },
        session.playerToken
    )
};
