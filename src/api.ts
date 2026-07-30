import type { ChatState } from '../shared/chat';
import type { ClanId, GamePhase, OrderTarget, PlayerSession, RoomSessionResponse, RoomState } from '../shared/room';
import type { SecretObjectiveId } from '../shared/objectives';

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

    getChat: (code: string) => request<ChatState>(`/api/rooms/${code}/chat`),

    sendChat: (session: PlayerSession, playerName: string, text: string) => request<ChatState>(
        `/api/rooms/${session.roomCode}/chat`,
        { method: 'POST', body: JSON.stringify({ playerId: session.playerId, playerName, text }) },
        session.playerToken
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

    kickPlayer: (session: PlayerSession, playerId: string) => request<RoomState>(
        `/api/rooms/${session.roomCode}/players/${playerId}`, { method: 'DELETE' }, session.playerToken
    ),

    start: (session: PlayerSession) => request<RoomState>(
        `/api/rooms/${session.roomCode}/start`, { method: 'POST' }, session.playerToken
    ),

    advanceGame: (session: PlayerSession, expectedPhase: GamePhase) => request<RoomState>(
        `/api/rooms/${session.roomCode}/game/advance`,
        { method: 'POST', body: JSON.stringify({ expectedPhase }) },
        session.playerToken
    ),

    chooseSecretObjective: (session: PlayerSession, objectiveId: SecretObjectiveId) => request<RoomState>(
        `/api/rooms/${session.roomCode}/game/objective`,
        { method: 'POST', body: JSON.stringify({ objectiveId }) },
        session.playerToken
    ),

    setResolutionReady: (session: PlayerSession, isReady: boolean) => request<RoomState>(
        `/api/rooms/${session.roomCode}/game/ready`,
        { method: 'POST', body: JSON.stringify({ isReady }) },
        session.playerToken
    ),

    playScout: (session: PlayerSession, orderId: string) => request<RoomState>(
        `/api/rooms/${session.roomCode}/game/cards/scout`,
        { method: 'POST', body: JSON.stringify({ orderId }) },
        session.playerToken
    ),

    playShugenja: (session: PlayerSession, orderId: string) => request<RoomState>(
        `/api/rooms/${session.roomCode}/game/cards/shugenja`,
        { method: 'POST', body: JSON.stringify({ orderId }) },
        session.playerToken
    ),

    returnDragonToken: (session: PlayerSession, tokenId: string) => request<RoomState>(
        `/api/rooms/${session.roomCode}/game/clan/dragon-return`,
        { method: 'POST', body: JSON.stringify({ tokenId }) },
        session.playerToken
    ),

    useScorpionPeek: (session: PlayerSession, orderId: string | null) => request<RoomState>(
        `/api/rooms/${session.roomCode}/game/clan/scorpion-peek`,
        { method: 'POST', body: JSON.stringify({ orderId }) },
        session.playerToken
    ),

    swapUnicornOrders: (session: PlayerSession, orderIds: string[]) => request<RoomState>(
        `/api/rooms/${session.roomCode}/game/clan/unicorn-swap`,
        { method: 'POST', body: JSON.stringify({ orderIds }) },
        session.playerToken
    ),

    placeOrder: (session: PlayerSession, tokenId: string, target: OrderTarget) => request<RoomState>(
        `/api/rooms/${session.roomCode}/game/orders`,
        { method: 'POST', body: JSON.stringify({ tokenId, target }) },
        session.playerToken
    ),

    passPlacement: (session: PlayerSession) => request<RoomState>(
        `/api/rooms/${session.roomCode}/game/pass`,
        { method: 'POST' },
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
