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
export type BattleTokenType = 'army' | 'fleet' | 'shinobi' | 'blessing' | 'diplomacy' | 'raid' | 'blank';
export type VisibleTokenType = BattleTokenType | 'hidden';
export type GameStage = 'setup' | 'rounds' | 'finished';
export type GamePhase = 'setup' | 'placement' | 'resolution' | 'finished';
export type OrderTargetKind = 'province' | 'land-border' | 'sea-border' | 'order';

export interface BattleTokenView {
    id: string;
    type: BattleTokenType;
    strength: number | null;
}

export interface OrderTarget {
    kind: OrderTargetKind;
    id: string;
}

export interface PlacedOrderView {
    id: string;
    playerId: string;
    target: OrderTarget;
    type: VisibleTokenType;
    strength: number | null;
    revealed: boolean;
}

export interface GamePlayerView {
    playerId: string;
    handCount: number;
    stockCount: number;
    discardCount: number;
    placedCount: number;
    provinceCount: number;
}

export interface GameViewState {
    stage: GameStage;
    round: number;
    phase: GamePhase;
    firstPlayerId: string;
    turnPlayerId: string | null;
    players: GamePlayerView[];
    provinces: Record<string, string | null>;
    orders: PlacedOrderView[];
    hand: BattleTokenView[];
}

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
    game: GameViewState | null;
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
