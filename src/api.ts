import type { ClanId, OrderTarget, PlayerSession, RoomSessionResponse, RoomState } from '../shared/room';

async function request<T>(url: string, init?: RequestInit, token?: string): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body)
        headers.set('content-type', 'application/json');
    if (token)
        headers.set('x-player-token', token);

    const response = await fetch(url, { ...init, headers });
    const data = await response.json() as unknown;
    if (!response.ok) {
        const message = typeof data === 'object' && data !== null && 'error' in data &&
            typeof data.error === 'string' ? data.error : `Ошибка HTTP ${response.status}`;
        throw new Error(message);
    }
    return data as T;
}

export const roomApi = {
    create: (playerName: string) => request<RoomSessionResponse>('/api/rooms', {
        method: 'POST', body: JSON.stringify({ playerName })
    }),

    join: (code: string, playerName: string) => request<RoomSessionResponse>(`/api/rooms/${code}/join`, {
        method: 'POST', body: JSON.stringify({ playerName })
    }),

    get: (code: string, session?: PlayerSession | null) => request<RoomState>(
        `/api/rooms/${code}`, undefined, session?.playerToken
    ),

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
    ),

    advanceGame: (session: PlayerSession) => request<RoomState>(
        `/api/rooms/${session.roomCode}/game/advance`, { method: 'POST' }, session.playerToken
    ),

    placeOrder: (session: PlayerSession, tokenId: string, target: OrderTarget) => request<RoomState>(
        `/api/rooms/${session.roomCode}/game/orders`,
        { method: 'POST', body: JSON.stringify({ tokenId, target }) },
        session.playerToken
    ),

    placeControl: (session: PlayerSession, provinceId: string) => request<RoomState>(
        `/api/rooms/${session.roomCode}/game/control`,
        { method: 'POST', body: JSON.stringify({ provinceId }) },
        session.playerToken
    ),

    playBotTurn: (session: PlayerSession) => request<RoomState>(
        `/api/rooms/${session.roomCode}/game/bot-turn`,
        { method: 'POST' },
        session.playerToken
    )
};
