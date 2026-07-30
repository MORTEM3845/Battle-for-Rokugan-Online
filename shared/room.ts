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
export type ClanActionType = 'scorpion-peek' | 'unicorn-swap';
export type GameLogEventType = 'round' | 'reveal' | 'raid' | 'diplomacy' | 'battle' | 'control' | 'defense' | 'card' | 'score';

export interface ClanRuleDefinition {
    name: string;
    ability: string;
    uniqueToken: {
        type: BattleTokenType;
        strength: number | null;
        label: string;
    };
}

export const CLAN_RULES: Record<ClanId, ClanRuleDefinition> = {
    crab: {
        name: 'Стойкость Краба',
        ability: 'Каждый ваш открытый жетон контроля даёт +3 защиты вместо +1 (но по-прежнему 1 честь).',
        uniqueToken: { type: 'fleet', strength: 3, label: 'Флот 3' }
    },
    crane: {
        name: 'Безупречная честь',
        ability: 'При равенстве сил в сражении побеждает клан Журавля.',
        uniqueToken: { type: 'diplomacy', strength: null, label: 'Дополнительная дипломатия' }
    },
    dragon: {
        name: 'Предвидение Дракона',
        ability: 'Набирая жетоны, возьмите на один больше, затем верните один непустой жетон в запас.',
        uniqueToken: { type: 'blessing', strength: 3, label: 'Благословение 3' }
    },
    lion: {
        name: 'Несокрушимый Лев',
        ability: 'Пустой жетон, поставленный на защиту, имеет силу 2 и возвращается в актив после боя.',
        uniqueToken: { type: 'army', strength: 6, label: 'Армия 6' }
    },
    phoenix: {
        name: 'Пламя Феникса',
        ability: 'Атакуя столицу, вы игнорируете её базовую защиту.',
        uniqueToken: { type: 'blessing', strength: 3, label: 'Благословение 3' }
    },
    scorpion: {
        name: 'Шёпот Скорпиона',
        ability: 'Раз в раунд после размещения жетона можно тайно посмотреть один жетон соперника.',
        uniqueToken: { type: 'shinobi', strength: 3, label: 'Синоби 3' }
    },
    unicorn: {
        name: 'Манёвр Единорога',
        ability: 'Перед вскрытием можно один раз поменять местами два своих боевых жетона.',
        uniqueToken: { type: 'raid', strength: null, label: 'Дополнительный погром' }
    }
};

export interface BattleTokenView {
    id: string;
    type: BattleTokenType;
    strength: number | null;
    isClanToken?: boolean;
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
    isClanToken?: boolean;
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
    clanAbilityUsed: boolean;
    mustReturnToken: boolean;
}

export interface TokenPoolCountView {
    type: BattleTokenType;
    strength: number | null;
    stock: number;
    hand: number;
    discard: number;
    placed: number;
    total: number;
    isClanToken?: boolean;
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
    secretObjectiveAchieved: boolean;
    clanActionPending: ClanActionType | null;
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
