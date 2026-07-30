import type { SecretObjectiveDefinition } from './objectives';

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
export type GamePhase = 'objectives' | 'setup' | 'placement' | 'reveal' | 'resolution' | 'finished';
export type OrderTargetKind = 'province' | 'land-border' | 'sea-border' | 'order';
export type ProvinceSpecial = 'peace' | 'scorched';
export type ActionCardType = 'scout' | 'shugenja';
export type GameLogEventType = 'round' | 'reveal' | 'raid' | 'diplomacy' | 'battle' | 'control' | 'defense' | 'card' | 'score';

export interface BattleTokenView {
    id: string;
    type: BattleTokenType;
    strength: number | null;
}

export interface OrderTarget {
    kind: OrderTargetKind;
    id: string;
    provinceId?: string;
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
    setupRemaining: number;
    hasSecretObjective: boolean;
    isRonin: boolean;
    skipsPlacement: boolean;
}

export interface TokenPoolCountView {
    type: BattleTokenType;
    strength: number | null;
    stock: number;
    hand: number;
    discard: number;
    placed: number;
    total: number;
}

export interface ActionCardHandView {
    scout: number;
    shugenja: number;
}

export interface GameResultView {
    playerId: string;
    provinceHonor: number;
    controlHonor: number;
    regionHonor: number;
    secretHonor: number;
    totalHonor: number;
    controlledRegions: string[];
    provinceCount: number;
    provinceHonorSources: Array<{ provinceId: string; name: string; honor: number }>;
    controlHonorSources: Array<{ provinceId: string; name: string; honor: number }>;
    regionHonorSources: Array<{ name: string; honor: number }>;
    secretObjective: SecretObjectiveDefinition | null;
    secretObjectiveAchieved: boolean;
    rank: number;
    isWinner: boolean;
}

export interface GameLogEntry {
    id: string;
    round: number;
    type: GameLogEventType;
    message: string;
    provinceId?: string;
    playerId?: string;
}

export interface GameViewState {
    stage: GameStage;
    round: number;
    phase: GamePhase;
    firstPlayerId: string;
    turnPlayerId: string | null;
    players: GamePlayerView[];
    provinces: Record<string, string | null>;
    defenseBonuses: Record<string, number>;
    provinceSpecials: Record<string, ProvinceSpecial>;
    readyPlayerIds: string[];
    orders: PlacedOrderView[];
    log: GameLogEntry[];
    hand: BattleTokenView[];
    tokenPool: TokenPoolCountView[];
    actionCards: ActionCardHandView;
    canPassPlacement: boolean;
    secretObjectiveOptions: SecretObjectiveDefinition[];
    secretObjective: SecretObjectiveDefinition | null;
    results: GameResultView[] | null;
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
