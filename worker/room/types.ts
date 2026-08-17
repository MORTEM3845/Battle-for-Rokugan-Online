import type { SecretObjectiveId } from '../../shared/objectives';
import type {
    ActionCardType, BattleTokenView, GameLogEntry, GamePhase, GameResultView,
    OrderTarget, ProvinceSpecial, ResolutionStepKind, RoomPlayer
} from '../../shared/room';

export interface Env {
    ROOMS: DurableObjectNamespace;
}

export interface StoredPlayer extends RoomPlayer {
    token: string;
}

export interface StoredBattleToken extends BattleTokenView {}

export interface StoredPlacedOrder {
    id: string;
    playerId: string;
    token: StoredBattleToken;
    target: OrderTarget;
    movedByUnicorn?: boolean;
}

export interface StoredPlayerGame {
    hand: StoredBattleToken[];
    stock: StoredBattleToken[];
    discard: StoredBattleToken[];
    setupRemaining: number;
    roundPlacedCount: number;
    actionCards: Record<ActionCardType, number>;
    scoutedOrderIds: string[];
    secretObjectiveOptions: SecretObjectiveId[];
    secretObjectiveId: SecretObjectiveId | null;
    isRonin: boolean;
    skipsPlacement: boolean;
    clanAbilityUsed: boolean;
    mustReturnToken: boolean;
}

export interface StoredResolutionStep {
    id: string;
    kind: ResolutionStepKind;
    title: string;
    provinceId?: string;
    logEntryIds: string[];
    provinces: Record<string, string | null>;
    defenseBonuses: Record<string, number>;
    provinceSpecials: Record<string, ProvinceSpecial>;
    activeOrderIds: string[];
}

export interface StoredResolutionSequence {
    currentIndex: number;
    baseLogLength: number;
    orders: StoredPlacedOrder[];
    steps: StoredResolutionStep[];
}

export interface StoredGame {
    stage: 'setup' | 'rounds' | 'finished';
    round: number;
    phase: GamePhase;
    objectiveResumePhase: Exclude<GamePhase, 'objectives'> | null;
    firstPlayerId: string;
    turnPlayerId: string | null;
    firstPlayerBag: string[];
    players: Record<string, StoredPlayerGame>;
    provinces: Record<string, string | null>;
    defenseBonuses: Record<string, number>;
    provinceSpecials: Record<string, ProvinceSpecial>;
    readyPlayerIds: string[];
    orders: StoredPlacedOrder[];
    attemptedAttackProvinceIds: string[];
    cancelledAttackProvinceIds: string[];
    log: GameLogEntry[];
    resolution: StoredResolutionSequence | null;
    results: GameResultView[] | null;
}

export interface StoredRoom {
    schemaVersion: number;
    code: string;
    status: 'lobby' | 'playing';
    maxPlayers: number;
    players: StoredPlayer[];
    createdAt: string;
    game: StoredGame | null;
}
