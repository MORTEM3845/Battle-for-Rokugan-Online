import type { ClanId, PlayerSession, RoomSessionResponse, RoomState } from '../shared/room';

async function request<T>(url: string, init?: RequestInit, token?: string): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body)
        headers.set('content-type', 'application/json');
    if (token)
        headers.set('x-player-token', token);

    const response = await fetch(url, { ...init, headers });
    const data = await response.json() as T | { error?: string };
    if (!response.ok)
        throw new Error('error' in data && data.error ? data.error : `Ошибка HTTP ${response.status}`);
    return data as T;
}

export const roomApi = {
    create: (playerName: string) => request<RoomSessionResponse>('/api/rooms', {
        method: 'POST', body: JSON.stringify({ playerName })
    }),

    join: (code: string, playerName: string) => request<RoomSessionResponse>(`/api/rooms/${code}/join`, {
        method: 'POST', body: JSON.stringify({ playerName })
    }),

    get: (code: string) => request<RoomState>(`/api/rooms/${code}`),

    selectClan: (session: PlayerSession, clanId: ClanId) => request<RoomState>(
        `/api/rooms/${session.roomCode}/clan`,
        { method: 'POST', body: JSON.stringify({ clanId }) },
        session.playerToken
    ),

    setReady: (session: PlayerSession, isReady: boolean) => request<RoomState>(
        `/api/rooms/${session.roomCode}/ready`,
        { method: 'POST', body: JSON.stringify({ isReady }) },
        session.playerToken
    ),

    addBot: (session: PlayerSession) => request<RoomState>(
        `/api/rooms/${session.roomCode}/bots`, { method: 'POST' }, session.playerToken
    ),

    removeBot: (session: PlayerSession, botId: string) => request<RoomState>(
        `/api/rooms/${session.roomCode}/bots/${botId}`, { method: 'DELETE' }, session.playerToken
    ),

    start: (session: PlayerSession) => request<RoomState>(
        `/api/rooms/${session.roomCode}/start`, { method: 'POST' }, session.playerToken
    )
};
