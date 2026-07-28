export const CLANS = [
    { id: 'crab', name: 'Краб' },
    { id: 'crane', name: 'Журавль' },
    { id: 'dragon', name: 'Дракон' },
    { id: 'lion', name: 'Лев' },
    { id: 'phoenix', name: 'Феникс' },
    { id: 'scorpion', name: 'Скорпион' },
    { id: 'unicorn', name: 'Единорог' }
] as const;

export type ClanId = typeof CLANS[number]['id'];
export type PlayerKind = 'human' | 'bot';
export type RoomStatus = 'lobby' | 'playing';

export interface RoomPlayer {
    id: string;
    name: string;
    kind: PlayerKind;
    isHost: boolean;
    isReady: boolean;
    clanId: ClanId | null;
}

export interface RoomState {
    code: string;
    status: RoomStatus;
    maxPlayers: number;
    players: RoomPlayer[];
    createdAt: string;
}

export interface PlayerSession {
    roomCode: string;
    playerId: string;
    playerToken: string;
}

export interface RoomSessionResponse {
    room: RoomState;
    session: PlayerSession;
}

export interface ApiError {
    error: string;
}
