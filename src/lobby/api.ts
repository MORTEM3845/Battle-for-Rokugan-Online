import type { ClanId, PlayerSession, RoomSessionResponse, RoomState } from '../../shared/room';
import { apiRequest } from '../api/request';

const roomPath = (code: string) => `/api/rooms/${code}`;
const authenticated = (session: PlayerSession, path: string, init?: RequestInit) =>
    apiRequest<RoomState>(`${roomPath(session.roomCode)}${path}`, init, session.playerToken);

export const lobbyApi = {
    create: (playerName: string) => apiRequest<RoomSessionResponse>('/api/rooms', {
        method: 'POST', body: JSON.stringify({ playerName })
    }),
    join: (code: string, playerName: string) => apiRequest<RoomSessionResponse>(`${roomPath(code)}/join`, {
        method: 'POST', body: JSON.stringify({ playerName })
    }),
    get: (code: string, session?: PlayerSession | null) => apiRequest<RoomState>(
        roomPath(code), undefined, session?.playerToken
    ),
    selectClan: (session: PlayerSession, clanId: ClanId) => authenticated(session, '/clan', {
        method: 'POST', body: JSON.stringify({ clanId })
    }),
    setReady: (session: PlayerSession, isReady: boolean) => authenticated(session, '/ready', {
        method: 'POST', body: JSON.stringify({ isReady })
    }),
    addBot: (session: PlayerSession) => authenticated(session, '/bots', { method: 'POST' }),
    removeBot: (session: PlayerSession, botId: string) => authenticated(session, `/bots/${botId}`, { method: 'DELETE' }),
    kickPlayer: (session: PlayerSession, playerId: string) => authenticated(session, `/players/${playerId}`, { method: 'DELETE' }),
    start: (session: PlayerSession) => authenticated(session, '/start', { method: 'POST' })
};
