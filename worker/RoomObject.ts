import {
    adjacentProvinceIds,
    CLAN_CAPITALS,
    COASTAL_PROVINCES,
    LAND_BORDERS,
    LEGACY_PROVINCE_ID_MAP,
    PROVINCE_BASE_DEFENSE,
    PROVINCE_HONOR,
    PROVINCE_IDS,
    PROVINCE_NAMES,
    PROVINCE_REGIONS,
    REGIONS,
    RENAMED_PROVINCE_ID_MAP,
    SEA_BORDERS,
    SHADOWLANDS_PROVINCES
} from '../shared/map';
import {
    SECRET_OBJECTIVES,
    SECRET_OBJECTIVES_BY_ID,
    type SecretObjectiveId
} from '../shared/objectives';
import type {
    ActionCardType,
    BattleTokenType,
    BattleTokenView,
    ClanId,
    GameLogEntry,
    GameLogEventType,
    GamePhase,
    GameResultView,
    OrderTarget,
    PlacedOrderView,
    ProvinceSpecial,
    RoomPlayer,
    RoomState
} from '../shared/room';

interface Env {
    ROOMS: DurableObjectNamespace;
}

interface StoredPlayer extends RoomPlayer {
    token: string;
}

interface StoredBattleToken extends BattleTokenView {}

interface StoredPlacedOrder {
    id: string;
    playerId: string;
    token: StoredBattleToken;
    target: OrderTarget;
}

interface StoredPlayerGame {
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
}

interface StoredGame {
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
    log: GameLogEntry[];
    results: GameResultView[] | null;
}

interface StoredRoom {
    schemaVersion: number;
    code: string;
    status: 'lobby' | 'playing';
    maxPlayers: number;
    players: StoredPlayer[];
    createdAt: string;
    game: StoredGame | null;
}

const ALL_CLANS: ClanId[] = ['crab', 'crane', 'dragon', 'lion', 'phoenix', 'scorpion', 'unicorn'];
const TOKEN_TYPES: BattleTokenType[] = ['army', 'fleet', 'shinobi', 'blessing', 'diplomacy', 'raid', 'blank'];
const TOKEN_TYPE_NAMES: Record<BattleTokenType, string> = {
    army: 'армия',
    fleet: 'флот',
    shinobi: 'синоби',
    blessing: 'благословение',
    diplomacy: 'дипломатия',
    raid: 'погром',
    blank: 'пустой жетон'
};
const SETUP_CONTROL_TOKENS: Record<number, number> = { 2: 11, 3: 7, 4: 5, 5: 4 };
const ROOM_SCHEMA_VERSION = 3;

class RequestError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
        this.name = 'RequestError';
    }
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff'
    }
});

const randomItem = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const shuffled = <T,>(items: T[]): T[] => {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
};

export class RoomObject {
    private requestQueue: Promise<void> = Promise.resolve();

    constructor(private readonly state: DurableObjectState, private readonly env: Env) {}

    fetch(request: Request): Promise<Response> {
        const queuedRequest = request.clone() as unknown as Request;
        const response = this.requestQueue.then(() => this.handleFetch(queuedRequest));
        this.requestQueue = response.then(() => undefined, () => undefined);
        return response;
    }

    private async handleFetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const room = await this.state.storage.get<StoredRoom>('room');

        try {
            if (room && this.migrateLegacyProvinceIds(room))
                await this.save(room);

            if (request.method === 'POST' && url.pathname === '/create')
                return this.createRoom(request, room);

            if (!room)
                return json({ error: 'Комната не найдена' }, 404);

            if (request.method === 'GET' && url.pathname === '/state') {
                if (room.status === 'playing' && room.game?.turnPlayerId &&
                    room.players.some(player => player.id === room.game?.turnPlayerId && player.kind === 'bot')) {
                    this.playAutomaticBotTurns(room);
                    await this.save(room);
                }
                return json(this.toPublicState(room, this.findPlayer(request, room)));
            }

            if (request.method === 'POST' && url.pathname === '/join')
                return this.joinRoom(request, room);
            if (request.method === 'POST' && url.pathname === '/clan')
                return this.selectClan(request, room);
            if (request.method === 'POST' && url.pathname === '/ready')
                return this.setReady(request, room);
            if (request.method === 'POST' && url.pathname === '/bots')
                return this.addBot(request, room);
            if (request.method === 'DELETE' && url.pathname.startsWith('/bots/'))
                return this.removeBot(request, room, decodeURIComponent(url.pathname.slice('/bots/'.length)));
            if (request.method === 'POST' && url.pathname === '/start')
                return this.startGame(request, room);
            if (request.method === 'POST' && url.pathname === '/game/advance')
                return this.advanceGame(request, room);
            if (request.method === 'POST' && url.pathname === '/game/objective')
                return this.chooseSecretObjective(request, room);
            if (request.method === 'POST' && url.pathname === '/game/orders')
                return this.placeOrder(request, room);
            if (request.method === 'POST' && url.pathname === '/game/pass')
                return this.passPlacement(request, room);
            if (request.method === 'POST' && url.pathname === '/game/control')
                return this.placeControl(request, room);
            if (request.method === 'POST' && url.pathname === '/game/ready')
                return this.setRevealReady(request, room);
            if (request.method === 'POST' && url.pathname === '/game/cards/scout')
                return this.playScout(request, room);
            if (request.method === 'POST' && url.pathname === '/game/cards/shugenja')
                return this.playShugenja(request, room);
            if (request.method === 'POST' && url.pathname === '/game/bot-turn')
                return this.playBotTurn(request, room);

            return json({ error: 'Маршрут не найден' }, 404);
        } catch (error) {
            if (error instanceof RequestError)
                return json({ error: error.message }, error.status);
            if (error instanceof SyntaxError)
                return json({ error: 'Некорректное тело запроса' }, 400);

            console.error('RoomObject request failed', error);
            return json({ error: 'Внутренняя ошибка сервера' }, 500);
        }
    }

    private async createRoom(request: Request, existing: StoredRoom | undefined): Promise<Response> {
        if (existing)
            return json({ error: 'Код комнаты уже занят' }, 409);

        const body = await request.json<{ code: string; playerName: string }>();
        const player = this.createHuman(body.playerName, true);
        const room: StoredRoom = {
            schemaVersion: ROOM_SCHEMA_VERSION,
            code: body.code,
            status: 'lobby',
            maxPlayers: 5,
            players: [player],
            createdAt: new Date().toISOString(),
            game: null
        };

        await this.save(room);
        return json({ room: this.toPublicState(room, player), session: this.toSession(room.code, player) }, 201);
    }

    private async joinRoom(request: Request, room: StoredRoom): Promise<Response> {
        this.ensureLobby(room);
        if (room.players.length >= room.maxPlayers)
            throw new RequestError(400, 'Комната заполнена');

        const body = await request.json<{ playerName: string }>();
        const player = this.createHuman(body.playerName, false);
        room.players.push(player);
        await this.save(room);
        return json({ room: this.toPublicState(room, player), session: this.toSession(room.code, player) }, 201);
    }

    private async selectClan(request: Request, room: StoredRoom): Promise<Response> {
        this.ensureLobby(room);
        const player = this.requirePlayer(request, room);
        const body = await request.json<{ clanId: ClanId }>();

        if (!ALL_CLANS.includes(body.clanId))
            throw new RequestError(400, 'Неизвестный клан');
        if (room.players.some(item => item.id !== player.id && item.clanId === body.clanId))
            throw new RequestError(400, 'Этот клан уже выбран');

        player.clanId = body.clanId;
        player.isReady = false;
        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private async setReady(request: Request, room: StoredRoom): Promise<Response> {
        this.ensureLobby(room);
        const player = this.requirePlayer(request, room);
        const body = await request.json<{ isReady: boolean }>();

        if (body.isReady && !player.clanId)
            throw new RequestError(400, 'Сначала выберите клан');

        player.isReady = body.isReady;
        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private async addBot(request: Request, room: StoredRoom): Promise<Response> {
        this.ensureLobby(room);
        const host = this.requireHost(request, room);
        if (room.players.length >= room.maxPlayers)
            throw new RequestError(400, 'Комната заполнена');

        const freeClans: ClanId[] = ALL_CLANS.filter(clan => !room.players.some(player => player.clanId === clan));
        room.players.push({
            id: crypto.randomUUID(),
            token: crypto.randomUUID(),
            name: `Бот ${room.players.filter(player => player.kind === 'bot').length + 1}`,
            kind: 'bot',
            isHost: false,
            isReady: true,
            clanId: randomItem(freeClans)
        });

        await this.save(room);
        return json(this.toPublicState(room, host), 201);
    }

    private async removeBot(request: Request, room: StoredRoom, botId: string): Promise<Response> {
        this.ensureLobby(room);
        const host = this.requireHost(request, room);
        const bot = room.players.find(player => player.id === botId && player.kind === 'bot');
        if (!bot)
            throw new RequestError(400, 'Бот не найден');

        room.players = room.players.filter(player => player.id !== botId);
        await this.save(room);
        return json(this.toPublicState(room, host));
    }

    private async startGame(request: Request, room: StoredRoom): Promise<Response> {
        this.ensureLobby(room);
        const host = this.requireHost(request, room);
        if (room.players.length < 2 || room.players.length > room.maxPlayers)
            throw new RequestError(400, 'Для запуска нужны от 2 до 5 игроков');
        if (room.players.some(player => !player.clanId))
            throw new RequestError(400, 'Все игроки должны выбрать клан');
        if (room.players.some(player => !player.isReady))
            throw new RequestError(400, 'Все игроки должны быть готовы');

        const firstPlayerBag = room.players.map(player => player.id);
        const firstPlayerId = randomItem(firstPlayerBag);
        const objectiveDeck = shuffled(SECRET_OBJECTIVES.map(objective => objective.id));
        room.status = 'playing';
        room.game = {
            stage: 'setup',
            round: 0,
            phase: 'objectives',
            objectiveResumePhase: 'setup',
            firstPlayerId,
            turnPlayerId: null,
            firstPlayerBag: firstPlayerBag.filter(id => id !== firstPlayerId),
            players: Object.fromEntries(room.players.map((player, index) => {
                const objectiveOptions = objectiveDeck.slice(index * 2, index * 2 + 2);
                return [player.id, {
                hand: [],
                stock: this.createTokenPool(player.clanId!),
                discard: [],
                setupRemaining: SETUP_CONTROL_TOKENS[room.players.length],
                roundPlacedCount: 0,
                actionCards: { scout: 2, shugenja: 1 },
                scoutedOrderIds: [],
                secretObjectiveOptions: player.kind === 'bot' ? [] : objectiveOptions,
                secretObjectiveId: player.kind === 'bot' ? randomItem(objectiveOptions) : null,
                isRonin: false,
                skipsPlacement: false
            }];
            })),
            provinces: Object.fromEntries(PROVINCE_IDS.map(id => [id, null])),
            defenseBonuses: Object.fromEntries(PROVINCE_IDS.map(id => [id, 0])),
            provinceSpecials: {},
            readyPlayerIds: [],
            orders: [],
            attemptedAttackProvinceIds: [],
            log: [],
            results: null
        };

        for (const player of room.players)
            room.game.provinces[CLAN_CAPITALS[player.clanId!]] = player.id;

        await this.save(room);
        return json(this.toPublicState(room, host));
    }

    private async advanceGame(request: Request, room: StoredRoom): Promise<Response> {
        const host = this.requireHost(request, room);
        const game = this.requireGame(room);
        const body = await request.json<{ expectedPhase?: GamePhase }>();
        if (!body.expectedPhase)
            throw new RequestError(400, 'Не указана ожидаемая фаза игры');
        if (body.expectedPhase !== game.phase)
            return json(this.toPublicState(room, host));

        if (game.phase === 'setup') {
            if (Object.values(game.players).some(player => player.setupRemaining > 0))
                throw new RequestError(400, 'Сначала разместите все начальные жетоны контроля');
            this.beginRound(room, false);
        } else if (game.phase === 'reveal') {
            this.resolveRound(room);
        } else if (game.phase === 'resolution') {
            if (game.round >= 5) {
                game.stage = 'finished';
                game.phase = 'finished';
                game.turnPlayerId = null;
                game.results = this.calculateResults(room);
                this.addLog(game, 'round', 'Пятый раунд завершён. Игра окончена.');
                for (const result of game.results)
                    this.addLog(
                        game,
                        'score',
                        `⭐ ${this.playerName(room, result.playerId)}: ${result.totalHonor} чести ` +
                        `(цветки ${result.provinceHonor}, открытый контроль ${result.controlHonor}, ` +
                        `тайная цель ${result.secretHonor}, регионы ${result.regionHonor}).`,
                        undefined,
                        result.playerId
                    );
            } else {
                this.chooseNextFirstPlayer(room);
                this.beginRound(room, true);
            }
        } else {
            throw new RequestError(400, 'Сейчас нельзя перейти к следующей фазе');
        }

        this.playAutomaticBotTurns(room);
        await this.save(room);
        return json(this.toPublicState(room, host));
    }

    private async chooseSecretObjective(request: Request, room: StoredRoom): Promise<Response> {
        const player = this.requirePlayer(request, room);
        const game = this.requireGame(room);
        if (game.phase !== 'objectives')
            throw new RequestError(400, 'Тайные цели уже выбраны');
        if (player.kind === 'bot')
            throw new RequestError(400, 'Бот выбирает тайную цель автоматически');

        const body = await request.json<{ objectiveId: SecretObjectiveId }>();
        const playerGame = game.players[player.id];
        if (!playerGame.secretObjectiveOptions.includes(body.objectiveId))
            throw new RequestError(400, 'Эта тайная цель вам не раздавалась');

        playerGame.secretObjectiveId = body.objectiveId;
        playerGame.secretObjectiveOptions = [];
        this.addLog(game, 'round', `${player.name} выбрал тайную цель.`);

        if (Object.values(game.players).every(candidate => candidate.secretObjectiveId)) {
            const resumePhase = game.objectiveResumePhase ?? 'setup';
            game.phase = resumePhase;
            game.objectiveResumePhase = null;
            if (resumePhase === 'setup' && !game.turnPlayerId &&
                Object.values(game.players).some(candidate => candidate.setupRemaining > 0))
                game.turnPlayerId = game.firstPlayerId;
            this.playAutomaticBotTurns(room);
        }

        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private async passPlacement(request: Request, room: StoredRoom): Promise<Response> {
        const player = this.requirePlayer(request, room);
        const game = this.requireGame(room);
        if (game.phase !== 'placement' || game.turnPlayerId !== player.id)
            throw new RequestError(400, 'Сейчас нельзя пропустить размещение');
        if (player.kind === 'bot')
            throw new RequestError(400, 'Ходы бота выполняются автоматически');
        if (this.hasAnyValidPlacement(game, player.id))
            throw new RequestError(400, 'У вас есть законное размещение жетона');

        game.players[player.id].skipsPlacement = true;
        this.addLog(
            game,
            'round',
            `${player.name} решает не тратить карту действия и пропускает оставшиеся ходы размещения.`,
            undefined,
            player.id
        );
        this.advancePlacementTurn(room, player.id);
        this.playAutomaticBotTurns(room);
        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private calculateResults(room: StoredRoom): GameResultView[] {
        const game = this.requireGame(room);
        const provinceCounts = Object.fromEntries(room.players.map(player => [
            player.id,
            PROVINCE_IDS.filter(id => game.provinces[id] === player.id).length
        ]));
        const fewestProvinceCount = Math.min(...Object.values(provinceCounts));
        const results = room.players.map(player => {
            const controlledProvinceIds = PROVINCE_IDS.filter(id => game.provinces[id] === player.id);
            const controlledRegions = REGIONS
                .filter(region => region.awardsHonor)
                .filter(region => {
                    const availableProvinceIds = region.provinceIds
                        .filter(id => game.provinceSpecials[id] !== 'scorched');
                    return availableProvinceIds.length > 0 &&
                        availableProvinceIds.every(id => game.provinces[id] === player.id);
                });
            const provinceHonorSources = controlledProvinceIds
                .filter(id => !SHADOWLANDS_PROVINCES.has(id))
                .map(id => ({ provinceId: id, name: PROVINCE_NAMES[id], honor: PROVINCE_HONOR[id] ?? 0 }))
                .filter(source => source.honor > 0);
            const controlHonorSources = controlledProvinceIds
                .filter(id => !SHADOWLANDS_PROVINCES.has(id))
                .map(id => ({
                    provinceId: id,
                    name: PROVINCE_NAMES[id],
                    honor: game.defenseBonuses[id] ?? 0
                }))
                .filter(source => source.honor > 0);
            const regionHonorSources = controlledRegions.map(region => ({ name: region.name, honor: 5 }));
            const provinceHonor = provinceHonorSources.reduce((sum, source) => sum + source.honor, 0);
            const controlHonor = controlHonorSources.reduce((sum, source) => sum + source.honor, 0);
            const regionHonor = regionHonorSources.reduce((sum, source) => sum + source.honor, 0);
            const secretObjectiveId = game.players[player.id].secretObjectiveId;
            const secretObjective = secretObjectiveId ? SECRET_OBJECTIVES_BY_ID[secretObjectiveId] : null;
            const secretObjectiveAchieved = secretObjectiveId
                ? this.isSecretObjectiveAchieved(
                    secretObjectiveId,
                    controlledProvinceIds,
                    provinceCounts[player.id] === fewestProvinceCount
                )
                : false;
            const secretHonor = secretObjectiveAchieved ? secretObjective?.honor ?? 0 : 0;

            return {
                playerId: player.id,
                provinceHonor,
                controlHonor,
                regionHonor,
                secretHonor,
                totalHonor: provinceHonor + controlHonor + regionHonor + secretHonor,
                controlledRegions: controlledRegions.map(region => region.name),
                provinceCount: controlledProvinceIds.length,
                provinceHonorSources,
                controlHonorSources,
                regionHonorSources,
                secretObjective,
                secretObjectiveAchieved,
                rank: 0,
                isWinner: false
            };
        });

        const sorted = [...results].sort((left, right) =>
            right.totalHonor - left.totalHonor ||
            right.controlledRegions.length - left.controlledRegions.length ||
            right.provinceCount - left.provinceCount
        );
        let rank = 0;
        let previous: GameResultView | undefined;
        for (const [index, result] of sorted.entries()) {
            const tied = previous &&
                result.totalHonor === previous.totalHonor &&
                result.controlledRegions.length === previous.controlledRegions.length &&
                result.provinceCount === previous.provinceCount;
            if (!tied)
                rank = index + 1;
            result.rank = rank;
            result.isWinner = rank === 1;
            previous = result;
        }

        return sorted;
    }

    private isSecretObjectiveAchieved(
        objectiveId: SecretObjectiveId,
        controlledProvinceIds: string[],
        hasFewestProvinces: boolean
    ): boolean {
        const controlled = new Set(controlledProvinceIds);
        const controlsClanCapitalOrTwo = (clanId: ClanId, regionId: string) =>
            controlled.has(CLAN_CAPITALS[clanId]) ||
            controlledProvinceIds.filter(id => PROVINCE_REGIONS[id] === regionId).length >= 2;

        switch (objectiveId) {
            case 'five_winds_court':
                return controlsClanCapitalOrTwo('unicorn', 'purpleunicorn');
            case 'great_northern_wall':
                return controlsClanCapitalOrTwo('dragon', 'greendragon');
            case 'lair_of_secrets':
                return controlsClanCapitalOrTwo('scorpion', 'redscorpion');
            case 'last_line':
                return controlsClanCapitalOrTwo('crab', 'graycrab');
            case 'fields_of_battle':
                return controlsClanCapitalOrTwo('lion', 'yellowlion');
            case 'great_library':
                return controlsClanCapitalOrTwo('phoenix', 'orangephoenix');
            case 'rice_of_the_empire':
                return controlsClanCapitalOrTwo('crane', 'lightbluecrane');
            case 'emerald_of_the_empire':
                return this.hasConnectedProvinceGroup(controlled, 6, 3);
            case 'path_of_the_sail':
                return controlledProvinceIds.filter(id => COASTAL_PROVINCES.has(id)).length >= 6;
            case 'reclaiming_lost_lands':
                return [...SHADOWLANDS_PROVINCES].every(id => controlled.has(id));
            case 'path_of_humanity':
                return hasFewestProvinces;
            case 'web_of_influence':
                return new Set(controlledProvinceIds.map(id => PROVINCE_REGIONS[id])).size >= 7;
        }
    }

    private hasConnectedProvinceGroup(
        controlledProvinceIds: Set<string>,
        provinceCount: number,
        regionCount: number
    ): boolean {
        const visitedGroups = new Set<string>();
        const canComplete = (selected: Set<string>): boolean => {
            const key = [...selected].sort().join('|');
            if (visitedGroups.has(key))
                return false;
            visitedGroups.add(key);

            const selectedRegions = new Set([...selected].map(id => PROVINCE_REGIONS[id]));
            if (selectedRegions.size > regionCount)
                return false;
            if (selected.size === provinceCount)
                return selectedRegions.size === regionCount;

            const frontier = new Set(
                [...selected].flatMap(id => adjacentProvinceIds(id))
                    .filter(id => controlledProvinceIds.has(id) && !selected.has(id))
            );
            for (const provinceId of frontier) {
                const next = new Set(selected);
                next.add(provinceId);
                if (canComplete(next))
                    return true;
            }
            return false;
        };

        for (const provinceId of controlledProvinceIds) {
            if (canComplete(new Set([provinceId])))
                return true;
        }
        return false;
    }

    private async setRevealReady(request: Request, room: StoredRoom): Promise<Response> {
        const player = this.requirePlayer(request, room);
        const game = this.requireGame(room);
        if (game.phase !== 'reveal')
            throw new RequestError(400, 'Сейчас подтверждение просмотра не требуется');
        if (player.kind === 'bot')
            throw new RequestError(400, 'Боты подтверждают просмотр автоматически');

        const body = await request.json<{ isReady: boolean }>();
        if (body.isReady) {
            if (!game.readyPlayerIds.includes(player.id))
                game.readyPlayerIds.push(player.id);
        } else {
            game.readyPlayerIds = game.readyPlayerIds.filter(id => id !== player.id);
        }

        if (room.players.every(item => game.readyPlayerIds.includes(item.id)))
            this.resolveRound(room);

        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private async playScout(request: Request, room: StoredRoom): Promise<Response> {
        const player = this.requirePlayer(request, room);
        const game = this.requireActionCardTurn(room, player);
        const body = await request.json<{ orderId: string }>();
        const order = this.requireOpponentOrder(game, player.id, body.orderId);
        const playerGame = game.players[player.id];

        if (playerGame.actionCards.scout <= 0)
            throw new RequestError(400, 'Карты разведки закончились');
        if (order.token.type === 'blessing')
            throw new RequestError(400, 'Благословение уже лежит лицевой стороной вверх');
        if (this.isOrderProtectedByBlessing(game, order.id))
            throw new RequestError(400, 'Этот жетон защищён благословением');
        if (playerGame.scoutedOrderIds.includes(order.id))
            throw new RequestError(400, 'Вы уже разведали этот жетон');

        playerGame.actionCards.scout--;
        playerGame.scoutedOrderIds.push(order.id);
        this.addLog(
            game,
            'card',
            `👁 ${player.name} использует разведку и тайно осматривает один вражеский жетон.`,
            undefined,
            player.id
        );

        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private async playShugenja(request: Request, room: StoredRoom): Promise<Response> {
        const player = this.requirePlayer(request, room);
        const game = this.requireActionCardTurn(room, player);
        const body = await request.json<{ orderId: string }>();
        const order = this.requireOpponentOrder(game, player.id, body.orderId);
        const playerGame = game.players[player.id];

        if (playerGame.actionCards.shugenja <= 0)
            throw new RequestError(400, 'Карта сюгэндзя уже использована');
        if (this.isOrderProtectedByBlessing(game, order.id))
            throw new RequestError(400, 'Этот жетон защищён благословением');

        this.commitShugenja(room, player, order);

        if (!this.hasAnyAvailablePlacementAction(game, player.id, true)) {
            playerGame.skipsPlacement = true;
            this.addLog(
                game,
                'round',
                `${player.name} после действия сюгэндзя не может законно разместить жетон и пропускает оставшиеся ходы размещения.`,
                undefined,
                player.id
            );
            this.advancePlacementTurn(room, player.id);
            this.playAutomaticBotTurns(room);
        }

        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private commitShugenja(room: StoredRoom, player: StoredPlayer, order: StoredPlacedOrder): void {
        const game = this.requireGame(room);
        const playerGame = game.players[player.id];
        playerGame.actionCards.shugenja--;
        game.orders = game.orders.filter(candidate => candidate.id !== order.id);
        const ownerGame = game.players[order.playerId];
        if (order.token.type === 'blank')
            ownerGame.hand.push(order.token);
        else
            ownerGame.discard.push(order.token);

        for (const candidate of Object.values(game.players))
            candidate.scoutedOrderIds = candidate.scoutedOrderIds.filter(id => id !== order.id);

        this.addLog(
            game,
            'card',
            `✨ ${player.name} призывает сюгэндзя: раскрыт и сброшен жетон «${TOKEN_TYPE_NAMES[order.token.type]}» игрока ${this.playerName(room, order.playerId)}.`,
            this.battleProvinceId(order) ?? undefined,
            player.id
        );
    }

    private requireActionCardTurn(room: StoredRoom, player: StoredPlayer): StoredGame {
        const game = this.requireGame(room);
        if (game.phase !== 'placement' || game.turnPlayerId !== player.id)
            throw new RequestError(400, 'Карту можно сыграть только в начале своего хода размещения');
        if (player.kind === 'bot')
            throw new RequestError(400, 'Ходы бота выполняются автоматически');
        return game;
    }

    private requireOpponentOrder(game: StoredGame, playerId: string, orderId: string): StoredPlacedOrder {
        const order = game.orders.find(candidate => candidate.id === orderId && candidate.playerId !== playerId);
        if (!order)
            throw new RequestError(400, 'Выберите жетон соперника на поле');
        return order;
    }

    private isOrderProtectedByBlessing(game: StoredGame, orderId: string): boolean {
        return game.orders.some(candidate =>
            candidate.token.type === 'blessing' &&
            candidate.target.kind === 'order' &&
            candidate.target.id === orderId
        );
    }

    private async placeOrder(request: Request, room: StoredRoom): Promise<Response> {
        const player = this.requirePlayer(request, room);
        const game = this.requireGame(room);
        if (game.phase !== 'placement')
            throw new RequestError(400, 'Сейчас жетоны не размещаются');
        if (game.turnPlayerId !== player.id)
            throw new RequestError(400, 'Сейчас ход другого игрока');
        if (player.kind === 'bot')
            throw new RequestError(400, 'Ход бота выполняется автоматически');

        const body = await request.json<{ tokenId: string; target: OrderTarget }>();
        this.commitOrder(room, player.id, body.tokenId, body.target);
        this.advancePlacementTurn(room, player.id);
        this.playAutomaticBotTurns(room);
        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private async placeControl(request: Request, room: StoredRoom): Promise<Response> {
        const player = this.requirePlayer(request, room);
        const game = this.requireGame(room);
        if (game.phase !== 'setup')
            throw new RequestError(400, 'Начальная расстановка уже завершена');
        if (game.turnPlayerId !== player.id)
            throw new RequestError(400, 'Сейчас ход другого игрока');
        if (player.kind === 'bot')
            throw new RequestError(400, 'Ход бота выполняется автоматически');

        const body = await request.json<{ provinceId: string }>();
        this.commitControl(room, player.id, body.provinceId);
        this.playAutomaticBotTurns(room);
        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private async playBotTurn(request: Request, room: StoredRoom): Promise<Response> {
        const host = this.requireHost(request, room);
        const game = this.requireGame(room);
        const bot = room.players.find(player => player.id === game.turnPlayerId && player.kind === 'bot');
        if (!bot)
            throw new RequestError(400, 'Сейчас ход не бота');

        this.playAutomaticBotTurns(room);
        await this.save(room);
        return json(this.toPublicState(room, host));
    }

    private playAutomaticBotTurns(room: StoredRoom): void {
        const game = this.requireGame(room);
        let turns = 0;

        while (game.turnPlayerId && (game.phase === 'setup' || game.phase === 'placement')) {
            const bot = room.players.find(player => player.id === game.turnPlayerId && player.kind === 'bot');
            if (!bot)
                return;

            this.commitRandomBotTurn(room, bot);
            turns++;
            if (turns > 100)
                throw new Error('Автоматические ходы ботов превысили безопасный предел');
        }
    }

    private commitRandomBotTurn(room: StoredRoom, bot: StoredPlayer): void {
        const game = this.requireGame(room);

        if (game.phase === 'setup') {
            const freeProvinces = PROVINCE_IDS.filter(id => game.provinces[id] === null);
            if (freeProvinces.length === 0)
                throw new Error('На карте не осталось свободных провинций');
            this.commitControl(room, bot.id, randomItem(freeProvinces));
        } else if (game.phase === 'placement') {
            const playerGame = game.players[bot.id];
            let options = playerGame.hand.flatMap(token =>
                this.targetsForToken(game, bot.id, token).map(target => ({ token, target }))
            );
            if (options.length === 0) {
                const order = this.shugenjaOrderOpeningPlacement(game, bot.id);
                if (order) {
                    this.commitShugenja(room, bot, order);
                    options = playerGame.hand.flatMap(token =>
                        this.targetsForToken(game, bot.id, token).map(target => ({ token, target }))
                    );
                }
            }
            if (options.length === 0) {
                playerGame.skipsPlacement = true;
                this.addLog(
                    game,
                    'round',
                    `${bot.name} не может законно разместить жетон и пропускает оставшиеся ходы размещения.`,
                    undefined,
                    bot.id
                );
                this.advancePlacementTurn(room, bot.id);
                return;
            }

            const choice = randomItem(options);
            this.commitOrder(room, bot.id, choice.token.id, choice.target);
            this.advancePlacementTurn(room, bot.id);
        } else {
            throw new Error('Бот сейчас не может сделать ход');
        }
    }

    private commitControl(room: StoredRoom, playerId: string, provinceId: string): void {
        const game = this.requireGame(room);
        const playerGame = game.players[playerId];
        if (playerGame.setupRemaining <= 0)
            throw new RequestError(400, 'Все ваши начальные жетоны уже размещены');
        if (!PROVINCE_IDS.includes(provinceId))
            throw new RequestError(400, 'Провинция не найдена');
        if (game.provinces[provinceId] !== null)
            throw new RequestError(400, 'В этой провинции уже есть жетон контроля');

        game.provinces[provinceId] = playerId;
        playerGame.setupRemaining--;
        this.advanceSetupTurn(room, playerId);
    }

    private advanceSetupTurn(room: StoredRoom, afterPlayerId: string): void {
        const game = this.requireGame(room);
        if (Object.values(game.players).every(player => player.setupRemaining === 0)) {
            game.turnPlayerId = null;
            return;
        }

        const currentIndex = room.players.findIndex(player => player.id === afterPlayerId);
        for (let offset = 1; offset <= room.players.length; offset++) {
            const candidate = room.players[(currentIndex + offset) % room.players.length];
            if (game.players[candidate.id].setupRemaining > 0) {
                game.turnPlayerId = candidate.id;
                return;
            }
        }
    }

    private beginRound(room: StoredRoom, increment: boolean): void {
        const game = this.requireGame(room);
        game.stage = 'rounds';
        game.phase = 'placement';
        game.round = increment ? game.round + 1 : 1;
        game.readyPlayerIds = [];
        game.orders = [];
        game.attemptedAttackProvinceIds = [];

        for (const player of room.players) {
            const playerGame = game.players[player.id];
            playerGame.scoutedOrderIds = [];
            playerGame.roundPlacedCount = 0;
            playerGame.isRonin = !Object.values(game.provinces).includes(player.id);
            playerGame.skipsPlacement = false;
            this.fillHand(playerGame);

            if (playerGame.isRonin)
                this.addLog(
                    game,
                    'round',
                    `⚔ ${player.name} начинает раунд ронином: армии можно ставить на любую сухопутную границу, погром и дипломатия недоступны.`,
                    undefined,
                    player.id
                );
        }

        this.addLog(game, 'round', `Начался раунд ${game.round}.`);
        game.turnPlayerId = game.firstPlayerId;
        this.advancePlacementTurn(room, game.firstPlayerId, true);
    }

    private chooseNextFirstPlayer(room: StoredRoom): void {
        const game = this.requireGame(room);
        if (game.firstPlayerBag.length === 0)
            game.firstPlayerBag = room.players.map(player => player.id).filter(id => id !== game.firstPlayerId);

        const next = randomItem(game.firstPlayerBag);
        game.firstPlayerBag = game.firstPlayerBag.filter(id => id !== next);
        game.firstPlayerId = next;
    }

    private fillHand(player: StoredPlayerGame): void {
        const blankInHand = player.hand.some(token => token.type === 'blank');
        if (!blankInHand) {
            const blankIndex = player.stock.findIndex(token => token.type === 'blank');
            if (blankIndex >= 0)
                player.hand.push(player.stock.splice(blankIndex, 1)[0]);
        }

        while (player.hand.length < 6 && player.stock.length > 0) {
            const realTokenIndexes = player.stock
                .map((token, index) => token.type === 'blank' ? -1 : index)
                .filter(index => index >= 0);
            if (realTokenIndexes.length === 0)
                break;
            const index = randomItem(realTokenIndexes);
            player.hand.push(player.stock.splice(index, 1)[0]);
        }
    }

    private cleanUpResolvedOrders(game: StoredGame): void {
        for (const order of game.orders) {
            const player = game.players[order.playerId];
            if (order.token.type === 'blank')
                player.hand.push(order.token);
            else
                player.discard.push(order.token);
        }
        game.orders = [];
        for (const player of Object.values(game.players))
            player.scoutedOrderIds = [];
    }

    private resolveRound(room: StoredRoom): void {
        const game = this.requireGame(room);
        if (game.phase !== 'reveal')
            throw new RequestError(400, 'Приказы ещё нельзя исполнять');

        const activeOrderIds = new Set(game.orders.map(order => order.id));
        const blankOrders = game.orders.filter(order => order.token.type === 'blank');
        for (const order of blankOrders)
            activeOrderIds.delete(order.id);
        if (blankOrders.length > 0)
            this.addLog(game, 'reveal', `Пустые жетоны возвращены владельцам: ${blankOrders.length}.`);

        const raids = game.orders.filter(order =>
            order.token.type === 'raid' && activeOrderIds.has(order.id)
        );
        const provincesBeforeRaids = { ...game.provinces };
        const validRaidOrderIds = new Set(raids.filter(raid => {
            const provinceId = raid.target.kind === 'province' ? raid.target.id : null;
            if (!provinceId)
                return false;
            const hasSupportingShinobi = game.orders.some(order =>
                activeOrderIds.has(order.id) &&
                order.playerId === raid.playerId &&
                order.token.type === 'shinobi' &&
                order.target.kind === 'province' &&
                order.target.id === provinceId
            );
            const hasAdjacentControl = adjacentProvinceIds(provinceId)
                .some(id => provincesBeforeRaids[id] === raid.playerId);
            return hasSupportingShinobi || hasAdjacentControl;
        }).map(raid => raid.id));

        for (const raid of raids) {
            if (!activeOrderIds.has(raid.id))
                continue;

            const provinceId = raid.target.kind === 'province' ? raid.target.id : null;
            if (!provinceId)
                continue;

            if (!validRaidOrderIds.has(raid.id)) {
                activeOrderIds.delete(raid.id);
                this.addLog(
                    game,
                    'raid',
                    `🔥 Погром игрока ${this.playerName(room, raid.playerId)} в провинции ` +
                    `«${PROVINCE_NAMES[provinceId]}» не сработал: рядом нет его владений или синоби.`,
                    provinceId,
                    raid.playerId
                );
                continue;
            }

            const removedOrderIds = this.orderIdsTouchingProvince(game, activeOrderIds, provinceId);
            const removedOrders = game.orders.filter(order => removedOrderIds.has(order.id));
            for (const id of removedOrderIds)
                activeOrderIds.delete(id);

            const previousOwnerId = game.provinces[provinceId];
            game.provinces[provinceId] = null;
            game.defenseBonuses[provinceId] = 0;
            game.provinceSpecials[provinceId] = 'scorched';

            const raiderName = this.playerName(room, raid.playerId);
            const previousOwner = previousOwnerId ? ` Контроль игрока ${this.playerName(room, previousOwnerId)} снят.` : '';
            this.addLog(
                game,
                'raid',
                `🔥 ${raiderName} устраивает погром в провинции «${PROVINCE_NAMES[provinceId]}». ` +
                `Снято: ${removedOrders.map(order => this.describeOrder(room, order)).join('; ') || 'нет жетонов'}.${previousOwner}`,
                provinceId,
                raid.playerId
            );
        }

        for (const diplomacy of game.orders.filter(order =>
            order.token.type === 'diplomacy' && activeOrderIds.has(order.id)
        )) {
            const provinceId = diplomacy.target.kind === 'province' ? diplomacy.target.id : null;
            if (!provinceId)
                continue;

            const removedOrderIds = this.orderIdsTouchingProvince(game, activeOrderIds, provinceId);
            const removedOrders = game.orders.filter(order => removedOrderIds.has(order.id));
            for (const id of removedOrderIds)
                activeOrderIds.delete(id);
            game.provinceSpecials[provinceId] = 'peace';

            this.addLog(
                game,
                'diplomacy',
                `☮ ${this.playerName(room, diplomacy.playerId)} заключает мир в провинции ` +
                `«${PROVINCE_NAMES[provinceId]}». Снято: ` +
                `${removedOrders.map(order => this.describeOrder(room, order)).join('; ') || 'нет жетонов'}.`,
                provinceId,
                diplomacy.playerId
            );
        }

        this.resolveBattles(room, activeOrderIds);
        this.cleanUpResolvedOrders(game);
        game.phase = 'resolution';
        game.turnPlayerId = null;
        game.readyPlayerIds = [];
        this.addLog(game, 'round', `Исполнение приказов раунда ${game.round} завершено.`);
    }

    private resolveBattles(room: StoredRoom, activeOrderIds: Set<string>): void {
        const game = this.requireGame(room);
        const combatTypes: BattleTokenType[] = ['army', 'fleet', 'shinobi'];
        const strengthByProvince = new Map<string, Map<string, number>>();

        for (const order of game.orders) {
            if (!activeOrderIds.has(order.id) || !combatTypes.includes(order.token.type))
                continue;

            const provinceId = this.battleProvinceId(order);
            if (!provinceId)
                continue;

            const blessingStrength = game.orders
                .filter(blessing =>
                    activeOrderIds.has(blessing.id) &&
                    blessing.token.type === 'blessing' &&
                    blessing.target.kind === 'order' &&
                    blessing.target.id === order.id
                )
                .reduce((sum, blessing) => sum + (blessing.token.strength ?? 0), 0);
            if (blessingStrength > 0)
                this.addLog(
                    game,
                    'battle',
                    `祝 Благословение усиливает жетон игрока ${this.playerName(room, order.playerId)} ` +
                    `в провинции «${PROVINCE_NAMES[provinceId]}» на +${blessingStrength}.`,
                    provinceId,
                    order.playerId
                );

            const playerStrengths = strengthByProvince.get(provinceId) ?? new Map<string, number>();
            playerStrengths.set(
                order.playerId,
                (playerStrengths.get(order.playerId) ?? 0) + (order.token.strength ?? 0) + blessingStrength
            );
            strengthByProvince.set(provinceId, playerStrengths);
        }

        const ownersBeforeBattles = { ...game.provinces };
        const attemptedAttackProvinceIds = new Set(game.attemptedAttackProvinceIds ?? []);
        for (const [provinceId, playerStrengths] of strengthByProvince) {
            const defenderId = ownersBeforeBattles[provinceId];
            const defenderTokenStrength = defenderId ? playerStrengths.get(defenderId) ?? 0 : 0;
            const printedDefense = PROVINCE_BASE_DEFENSE[provinceId] ?? 0;
            const earnedDefense = game.defenseBonuses[provinceId] ?? 0;
            const printedAndEarnedDefense = printedDefense + earnedDefense;
            const defenderStrength = defenderTokenStrength + printedAndEarnedDefense;
            const attackers = [...playerStrengths.entries()].filter(([playerId]) => playerId !== defenderId);

            if (attackers.length === 0) {
                if (defenderId && attemptedAttackProvinceIds.has(provinceId)) {
                    this.addLog(
                        game,
                        'battle',
                        `⚔ Атака на «${PROVINCE_NAMES[provinceId]}» сорвана до боя. Победа засчитана защитнику.`,
                        provinceId,
                        defenderId
                    );
                    this.rewardDefense(room, provinceId, defenderId, 'атака сорвана до боя');
                } else if (defenderId && defenderTokenStrength > 0) {
                    this.rewardDefense(room, provinceId, defenderId, 'провинцию никто не атаковал');
                }
                continue;
            }

            const participantSummaries = [...playerStrengths.entries()].map(([playerId, tokenTotal]) => {
                const combatOrders = game.orders.filter(order =>
                    activeOrderIds.has(order.id) &&
                    order.playerId === playerId &&
                    combatTypes.includes(order.token.type) &&
                    this.battleProvinceId(order) === provinceId
                );
                const tokenParts = combatOrders.map(order => {
                    const blessing = game.orders
                        .filter(candidate =>
                            activeOrderIds.has(candidate.id) &&
                            candidate.token.type === 'blessing' &&
                            candidate.target.kind === 'order' &&
                            candidate.target.id === order.id
                        )
                        .reduce((sum, candidate) => sum + (candidate.token.strength ?? 0), 0);
                    return `${TOKEN_TYPE_NAMES[order.token.type]} ${order.token.strength ?? 0}` +
                        (blessing > 0 ? ` + благословение ${blessing}` : '');
                });
                const isDefender = playerId === defenderId;
                const defenseParts = isDefender
                    ? `${printedDefense > 0 ? ` + базовая защита ${printedDefense}` : ''}` +
                        `${earnedDefense > 0 ? ` + открытые жетоны контроля ${earnedDefense}` : ''}`
                    : '';
                const total = isDefender ? tokenTotal + printedAndEarnedDefense : tokenTotal;
                return `${this.playerName(room, playerId)}: ${tokenParts.join(' + ')}${defenseParts} = ${total}`;
            });
            if (defenderId && !playerStrengths.has(defenderId))
                participantSummaries.unshift(
                    `${this.playerName(room, defenderId)}: без боевого жетона` +
                    `${printedDefense > 0 ? ` + базовая защита ${printedDefense}` : ''}` +
                    `${earnedDefense > 0 ? ` + открытые жетоны контроля ${earnedDefense}` : ''}` +
                    ` = ${printedAndEarnedDefense}`
                );
            if (!defenderId && printedAndEarnedDefense > 0)
                participantSummaries.push(
                    `Ничейная защита: базовая ${printedDefense}` +
                    `${earnedDefense > 0 ? ` + открытые жетоны контроля ${earnedDefense}` : ''}` +
                    ` = ${printedAndEarnedDefense}`
                );
            this.addLog(
                game,
                'battle',
                `📐 Расчёт боя за «${PROVINCE_NAMES[provinceId]}»: ${participantSummaries.join('; ')}.`,
                provinceId
            );

            const highestAttack = Math.max(...attackers.map(([, strength]) => strength));
            const strongestAttackers = attackers.filter(([, strength]) => strength === highestAttack);

            if (defenderId && (defenderStrength >= highestAttack || strongestAttackers.length > 1)) {
                const attackerSummary = strongestAttackers
                    .map(([playerId]) => this.playerName(room, playerId))
                    .join(', ');
                this.addLog(
                    game,
                    'battle',
                    `⚔ Битва за «${PROVINCE_NAMES[provinceId]}»: ${this.playerName(room, defenderId)} удерживает провинцию (${defenderStrength} против ${highestAttack}; атакующие: ${attackerSummary}).`,
                    provinceId,
                    defenderId
                );
                this.rewardDefense(room, provinceId, defenderId, 'атака отбита');
                continue;
            }

            if (strongestAttackers.length !== 1) {
                const attackerNames = strongestAttackers
                    .map(([playerId]) => this.playerName(room, playerId))
                    .join(', ');
                this.addLog(
                    game,
                    'battle',
                    `⚔ Битва за свободную провинцию «${PROVINCE_NAMES[provinceId]}»: ничья атакующих ${attackerNames} (${highestAttack}). Провинция остаётся без контроля.`,
                    provinceId
                );
                continue;
            }

            const [winnerId, winnerStrength] = strongestAttackers[0];
            if (winnerStrength <= defenderStrength) {
                this.addLog(
                    game,
                    'battle',
                    `⚔ Атака на «${PROVINCE_NAMES[provinceId]}» с силой ${winnerStrength} не преодолела защиту ${defenderStrength}.`,
                    provinceId
                );
                if (defenderId)
                    this.rewardDefense(room, provinceId, defenderId, 'атака не преодолела защиту');
                continue;
            }

            const previousOwnerName = defenderId ? this.playerName(room, defenderId) : 'никто';
            game.provinces[provinceId] = winnerId;
            game.defenseBonuses[provinceId] = 0;
            this.addLog(
                game,
                'control',
                `🏯 ${this.playerName(room, winnerId)} захватывает «${PROVINCE_NAMES[provinceId]}» с силой ${winnerStrength}. Прежний владелец: ${previousOwnerName}.`,
                provinceId,
                winnerId
            );
        }

        for (const provinceId of attemptedAttackProvinceIds) {
            if (strengthByProvince.has(provinceId) || game.provinceSpecials[provinceId] === 'scorched')
                continue;

            const defenderId = ownersBeforeBattles[provinceId];
            if (!defenderId || game.provinces[provinceId] !== defenderId)
                continue;

            this.addLog(
                game,
                'battle',
                `⚔ Атака на «${PROVINCE_NAMES[provinceId]}» сорвана до боя. Победа засчитана защитнику.`,
                provinceId,
                defenderId
            );
            this.rewardDefense(room, provinceId, defenderId, 'атака сорвана до боя');
        }
        game.attemptedAttackProvinceIds = [];
    }

    private rewardDefense(room: StoredRoom, provinceId: string, defenderId: string, reason: string): void {
        const game = this.requireGame(room);
        game.defenseBonuses[provinceId] = (game.defenseBonuses[provinceId] ?? 0) + 1;
        this.addLog(
            game,
            'defense',
            `🛡 ${this.playerName(room, defenderId)} усиливает «${PROVINCE_NAMES[provinceId]}» на +1 (${reason}). Общая дополнительная защита: ${game.defenseBonuses[provinceId]}.`,
            provinceId,
            defenderId
        );
    }

    private battleProvinceId(order: StoredPlacedOrder): string | null {
        if (order.target.kind === 'province')
            return order.target.id;
        if (order.target.kind === 'land-border' || order.target.kind === 'sea-border')
            return order.target.provinceId ?? null;
        return null;
    }

    private attackedProvinceId(game: StoredGame, order: StoredPlacedOrder): string | null {
        if (!['army', 'fleet', 'shinobi'].includes(order.token.type))
            return null;
        const provinceId = this.battleProvinceId(order);
        if (!provinceId || game.provinces[provinceId] === order.playerId)
            return null;
        return provinceId;
    }

    private orderIdsTouchingProvince(
        game: StoredGame,
        activeOrderIds: Set<string>,
        provinceId: string
    ): Set<string> {
        const result = new Set<string>();
        for (const order of game.orders) {
            if (!activeOrderIds.has(order.id))
                continue;
            if (this.orderProvinceIds(game, order).includes(provinceId))
                result.add(order.id);
        }
        return result;
    }

    private orderProvinceIds(game: StoredGame, order: StoredPlacedOrder): string[] {
        if (order.target.kind === 'province')
            return [order.target.id];
        if (order.target.kind === 'land-border')
            return LAND_BORDERS.find(border => border.id === order.target.id)?.provinces ??
                this.provincesFromLandBorderId(order.target.id);
        if (order.target.kind === 'sea-border') {
            const provinceId = order.target.provinceId ??
                SEA_BORDERS.find(border => border.id === order.target.id)?.provinceId;
            return provinceId ? [provinceId] : [];
        }
        const baseOrder = game.orders.find(candidate => candidate.id === order.target.id);
        return baseOrder ? this.orderProvinceIds(game, baseOrder) : [];
    }

    private provincesFromLandBorderId(borderId: string): string[] {
        if (!borderId.startsWith('land-'))
            return [];
        const provinceIds = borderId.slice('land-'.length).split('-');
        return provinceIds.length === 2 && provinceIds.every(id => PROVINCE_IDS.includes(id))
            ? provinceIds
            : [];
    }

    private describeOrder(room: StoredRoom, order: StoredPlacedOrder): string {
        const strength = order.token.strength === null ? '' : ` ${order.token.strength}`;
        const player = this.playerName(room, order.playerId);
        let target = '';
        if (order.target.kind === 'province')
            target = `в «${PROVINCE_NAMES[order.target.id]}»`;
        else if (order.target.kind === 'land-border') {
            const provinceIds = this.orderProvinceIds(this.requireGame(room), order);
            target = `на границе ${provinceIds.map(id => `«${PROVINCE_NAMES[id]}»`).join(' / ')}`;
        } else if (order.target.kind === 'sea-border') {
            const provinceId = order.target.provinceId;
            target = provinceId ? `на морской границе «${PROVINCE_NAMES[provinceId]}»` : 'на морской границе';
        } else {
            target = 'поверх боевого жетона';
        }
        return `${TOKEN_TYPE_NAMES[order.token.type]}${strength} (${player}) ${target}`;
    }

    private playerName(room: StoredRoom, playerId: string): string {
        return room.players.find(player => player.id === playerId)?.name ?? 'неизвестный игрок';
    }

    private addLog(
        game: StoredGame,
        type: GameLogEventType,
        message: string,
        provinceId?: string,
        playerId?: string
    ): void {
        game.log.push({ id: crypto.randomUUID(), round: game.round, type, message, provinceId, playerId });
        if (game.log.length > 300)
            game.log = game.log.slice(-300);
    }

    private commitOrder(room: StoredRoom, playerId: string, tokenId: string, target: OrderTarget): void {
        const game = this.requireGame(room);
        const playerGame = game.players[playerId];
        if (playerGame.skipsPlacement)
            throw new RequestError(400, 'Вы уже пропускаете оставшиеся ходы размещения в этом раунде');
        if (playerGame.hand.length <= 1)
            throw new RequestError(400, 'Последний жетон должен остаться за ширмой');

        const tokenIndex = playerGame.hand.findIndex(token => token.id === tokenId);
        if (tokenIndex < 0)
            throw new RequestError(400, 'Жетон не найден в вашей руке');

        const token = playerGame.hand[tokenIndex];
        if (!this.isTargetValid(game, playerId, token, target))
            throw new RequestError(400, 'Этот жетон нельзя поставить на выбранную цель');

        playerGame.hand.splice(tokenIndex, 1);
        const order: StoredPlacedOrder = { id: crypto.randomUUID(), playerId, token, target };
        game.orders.push(order);
        const attackedProvinceId = this.attackedProvinceId(game, order);
        if (attackedProvinceId &&
            game.provinces[attackedProvinceId] &&
            !game.attemptedAttackProvinceIds.includes(attackedProvinceId))
            game.attemptedAttackProvinceIds.push(attackedProvinceId);
        playerGame.roundPlacedCount++;
    }

    private advancePlacementTurn(room: StoredRoom, afterPlayerId: string, includeCurrent = false): void {
        const game = this.requireGame(room);
        const currentIndex = room.players.findIndex(player => player.id === afterPlayerId);
        const firstOffset = includeCurrent ? 0 : 1;
        for (let offset = firstOffset; offset < firstOffset + room.players.length; offset++) {
            const candidate = room.players[(currentIndex + offset) % room.players.length];
            const candidateGame = game.players[candidate.id];
            if (candidateGame.hand.length <= 1 || candidateGame.skipsPlacement)
                continue;

            if (this.hasAnyAvailablePlacementAction(game, candidate.id, candidate.kind === 'human')) {
                game.turnPlayerId = candidate.id;
                return;
            }

            candidateGame.skipsPlacement = true;
            this.addLog(
                game,
                'round',
                `${candidate.name} не может законно разместить ни один жетон и пропускает оставшиеся ходы размещения.`,
                undefined,
                candidate.id
            );
        }

        game.phase = 'reveal';
        game.turnPlayerId = null;
        game.readyPlayerIds = room.players.filter(player => player.kind === 'bot').map(player => player.id);
        this.addLog(game, 'reveal', `Раунд ${game.round}: все приказы открыты.`);
    }

    private hasAnyValidPlacement(game: StoredGame, playerId: string): boolean {
        const playerGame = game.players[playerId];
        if (!playerGame || playerGame.hand.length <= 1)
            return false;
        return playerGame.hand.some(token => this.targetsForToken(game, playerId, token).length > 0);
    }

    private hasAnyAvailablePlacementAction(
        game: StoredGame,
        playerId: string,
        includeOptionalCards = false
    ): boolean {
        if (this.hasAnyValidPlacement(game, playerId))
            return true;
        if (includeOptionalCards && this.hasAnyPlayableActionCard(game, playerId))
            return true;
        return !!this.shugenjaOrderOpeningPlacement(game, playerId);
    }

    private hasAnyPlayableActionCard(game: StoredGame, playerId: string): boolean {
        const playerGame = game.players[playerId];
        if (!playerGame)
            return false;

        const opponentOrders = game.orders.filter(order => order.playerId !== playerId);
        const canPlayShugenja = playerGame.actionCards.shugenja > 0 &&
            opponentOrders.some(order => !this.isOrderProtectedByBlessing(game, order.id));
        const canPlayScout = playerGame.actionCards.scout > 0 &&
            opponentOrders.some(order =>
                order.token.type !== 'blessing' &&
                !this.isOrderProtectedByBlessing(game, order.id) &&
                !playerGame.scoutedOrderIds.includes(order.id)
            );
        return canPlayShugenja || canPlayScout;
    }

    private shugenjaOrderOpeningPlacement(
        game: StoredGame,
        playerId: string
    ): StoredPlacedOrder | null {
        const playerGame = game.players[playerId];
        if (!playerGame || playerGame.actionCards.shugenja <= 0)
            return null;

        return game.orders.find(order => {
            if (order.playerId === playerId || this.isOrderProtectedByBlessing(game, order.id))
                return false;

            const gameWithoutOrder: StoredGame = {
                ...game,
                orders: game.orders.filter(candidate => candidate.id !== order.id)
            };
            return this.hasAnyValidPlacement(gameWithoutOrder, playerId);
        }) ?? null;
    }

    private targetsForToken(game: StoredGame, playerId: string, token: StoredBattleToken): OrderTarget[] {
        const candidates: OrderTarget[] = [
            ...PROVINCE_IDS.map(id => ({ kind: 'province' as const, id })),
            ...LAND_BORDERS.flatMap(border => border.provinces.map(provinceId => ({
                kind: 'land-border' as const, id: border.id, provinceId
            }))),
            ...SEA_BORDERS.map(border => ({
                kind: 'sea-border' as const, id: border.id, provinceId: border.provinceId
            })),
            ...game.orders.map(order => ({ kind: 'order' as const, id: order.id }))
        ];
        return candidates.filter(target => this.isTargetValid(game, playerId, token, target));
    }

    private isTargetValid(game: StoredGame, playerId: string, token: StoredBattleToken, target: OrderTarget): boolean {
        if (!target || typeof target.id !== 'string')
            return false;

        const playerGame = game.players[playerId];
        if (!playerGame)
            return false;
        if (playerGame.isRonin && (token.type === 'raid' || token.type === 'diplomacy'))
            return false;

        if (target.kind === 'province' && game.provinceSpecials[target.id])
            return false;
        if (target.kind === 'land-border') {
            const border = LAND_BORDERS.find(item => item.id === target.id);
            if (!border ||
                !target.provinceId ||
                !border.provinces.includes(target.provinceId) ||
                border.provinces.some(provinceId => game.provinceSpecials[provinceId]))
                return false;
        }
        if (target.kind === 'sea-border') {
            const provinceId = target.provinceId ??
                SEA_BORDERS.find(border => border.id === target.id)?.provinceId;
            if (!provinceId || game.provinceSpecials[provinceId])
                return false;
        }

        if (target.kind === 'land-border' || target.kind === 'sea-border') {
            if (game.orders.some(order => order.target.kind === target.kind && order.target.id === target.id))
                return false;
        }

        if (token.type === 'blank') {
            if (target.kind === 'province')
                return PROVINCE_IDS.includes(target.id);
            if (target.kind === 'land-border')
                return this.isLandAttackTarget(game, playerId, target);
            return target.kind === 'sea-border' && SEA_BORDERS.some(border =>
                border.id === target.id &&
                border.provinceId === target.provinceId &&
                game.provinces[border.provinceId] !== playerId
            );
        }

        if (token.type === 'army') {
            if (target.kind === 'province')
                return game.provinces[target.id] === playerId;
            if (target.kind !== 'land-border')
                return false;
            return this.isLandAttackTarget(game, playerId, target);
        }

        if (token.type === 'fleet') {
            if (target.kind === 'province')
                return game.provinces[target.id] === playerId && COASTAL_PROVINCES.has(target.id);
            return target.kind === 'sea-border' && SEA_BORDERS.some(border =>
                border.id === target.id &&
                border.provinceId === target.provinceId &&
                game.provinces[border.provinceId] !== playerId
            );
        }

        if (token.type === 'shinobi')
            return target.kind === 'province' && PROVINCE_IDS.includes(target.id);

        if (token.type === 'diplomacy')
            return target.kind === 'province' && game.provinces[target.id] === playerId;

        if (token.type === 'raid') {
            if (target.kind !== 'province' || game.provinces[target.id] === playerId)
                return false;
            return PROVINCE_IDS.includes(target.id);
        }

        if (token.type === 'blessing' && target.kind === 'order') {
            const base = game.orders.find(order => order.id === target.id);
            return !!base && base.playerId === playerId && ['army', 'fleet', 'shinobi'].includes(base.token.type);
        }

        return false;
    }

    private isLandAttackTarget(game: StoredGame, playerId: string, target: OrderTarget): boolean {
        const border = LAND_BORDERS.find(item => item.id === target.id);
        if (!border || !target.provinceId || !border.provinces.includes(target.provinceId))
            return false;

        if (game.players[playerId]?.isRonin)
            return game.provinces[target.provinceId] !== playerId;

        const sourceProvinceId = border.provinces.find(id => id !== target.provinceId)!;
        return game.provinces[sourceProvinceId] === playerId && game.provinces[target.provinceId] !== playerId;
    }

    private createTokenPool(clanId: ClanId): StoredBattleToken[] {
        const tokens: StoredBattleToken[] = [];
        const add = (type: BattleTokenType, strengths: Array<number | null>) => {
            for (const strength of strengths)
                tokens.push({ id: crypto.randomUUID(), type, strength });
        };

        add('blank', [null]);
        add('army', [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5]);
        add('fleet', [1, 1, 2]);
        add('shinobi', [1, 2]);
        add('blessing', [1, 2]);
        add('diplomacy', [null]);
        add('raid', [null]);

        return tokens;
    }

    private migrateLegacyProvinceIds(room: StoredRoom): boolean {
        const game = room.game;
        const storedVersion = room.schemaVersion ?? 0;
        if (storedVersion > ROOM_SCHEMA_VERSION)
            throw new RequestError(
                503,
                'Эта комната создана более новой версией игры. Обновите сервер и повторите попытку.'
            );

        const shouldRecalculateResults = storedVersion < ROOM_SCHEMA_VERSION;
        let changed = shouldRecalculateResults;
        room.schemaVersion = ROOM_SCHEMA_VERSION;
        if (!game)
            return changed;

        const migrateProvinceId = (id: string) =>
            LEGACY_PROVINCE_ID_MAP[id] ?? RENAMED_PROVINCE_ID_MAP[id] ?? id;
        const provinceEntries = Object.entries(game.provinces);
        const hasMigratableProvince = provinceEntries.some(([id]) =>
            id in LEGACY_PROVINCE_ID_MAP || id in RENAMED_PROVINCE_ID_MAP
        );
        const hasMigratableTarget = game.orders.some(order =>
            order.target.id.includes('province-') ||
            Object.keys(RENAMED_PROVINCE_ID_MAP).some(id => order.target.id.includes(id)) ||
            (!!order.target.provinceId &&
                (order.target.provinceId in LEGACY_PROVINCE_ID_MAP ||
                    order.target.provinceId in RENAMED_PROVINCE_ID_MAP))
        );

        if (hasMigratableProvince) {
            const migratedProvinces: Record<string, string | null> = Object.fromEntries(
                PROVINCE_IDS.map(id => [id, null])
            );
            for (const [id, ownerId] of provinceEntries) {
                const migratedId = migrateProvinceId(id);
                if (PROVINCE_IDS.includes(migratedId))
                    migratedProvinces[migratedId] = ownerId;
            }
            game.provinces = migratedProvinces;
            changed = true;
        }

        if (hasMigratableTarget) {
            for (const order of game.orders) {
                const target = order.target;
                target.provinceId = target.provinceId ? migrateProvinceId(target.provinceId) : undefined;

                if (target.kind === 'province') {
                    target.id = migrateProvinceId(target.id);
                    continue;
                }

                if (target.kind === 'land-border') {
                    const legacyBorder = /^land-(province-\d{2})-(province-\d{2})$/.exec(target.id);
                    const provinceIds = legacyBorder
                        ? [legacyBorder[1], legacyBorder[2]]
                        : target.id.slice('land-'.length).split('-');
                    if (provinceIds.length === 2)
                        target.id = `land-${migrateProvinceId(provinceIds[0])}-${migrateProvinceId(provinceIds[1])}`;
                    continue;
                }

                if (target.kind === 'sea-border')
                    target.id = `sea-${migrateProvinceId(target.id.slice('sea-'.length))}`;
            }
            changed = true;
        }

        if (!game.defenseBonuses) {
            game.defenseBonuses = Object.fromEntries(PROVINCE_IDS.map(id => [id, 0]));
            changed = true;
        } else {
            const hasMigratableDefense = Object.keys(game.defenseBonuses).some(id =>
                id in LEGACY_PROVINCE_ID_MAP || id in RENAMED_PROVINCE_ID_MAP
            );
            const normalizedBonuses = Object.fromEntries(PROVINCE_IDS.map(id => [id, 0])) as Record<string, number>;
            for (const [id, bonus] of Object.entries(game.defenseBonuses))
                normalizedBonuses[migrateProvinceId(id)] = bonus;
            if (Object.keys(game.defenseBonuses).length !== PROVINCE_IDS.length || hasMigratableDefense) {
                game.defenseBonuses = normalizedBonuses;
                changed = true;
            }
        }

        if (!game.provinceSpecials) {
            game.provinceSpecials = {};
            changed = true;
        } else if (Object.keys(game.provinceSpecials).some(id =>
            id in LEGACY_PROVINCE_ID_MAP || id in RENAMED_PROVINCE_ID_MAP
        )) {
            game.provinceSpecials = Object.fromEntries(
                Object.entries(game.provinceSpecials).map(([id, special]) => [migrateProvinceId(id), special])
            );
            changed = true;
        }
        if (!game.readyPlayerIds) {
            game.readyPlayerIds = [];
            changed = true;
        }
        if (!game.attemptedAttackProvinceIds) {
            const legacyCancelledAttackProvinceIds =
                (game as StoredGame & { cancelledAttackProvinceIds?: string[] })
                    .cancelledAttackProvinceIds ?? [];
            game.attemptedAttackProvinceIds = [...new Set([
                ...legacyCancelledAttackProvinceIds,
                ...game.orders
                    .map(order => this.attackedProvinceId(game, order))
                    .filter((provinceId): provinceId is string =>
                        !!provinceId && !!game.provinces[provinceId]
                    )
            ])];
            changed = true;
        }
        if (!game.log) {
            game.log = [];
            changed = true;
        } else {
            for (const entry of game.log) {
                if (!entry.provinceId)
                    continue;
                const migratedProvinceId = migrateProvinceId(entry.provinceId);
                if (migratedProvinceId !== entry.provinceId) {
                    entry.provinceId = migratedProvinceId;
                    changed = true;
                }
            }
        }
        if (game.results === undefined) {
            game.results = null;
            changed = true;
        }
        for (const [playerId, playerGame] of Object.entries(game.players)) {
            if (!playerGame.actionCards) {
                playerGame.actionCards = { scout: 2, shugenja: 1 };
                changed = true;
            }
            if (!playerGame.scoutedOrderIds) {
                playerGame.scoutedOrderIds = [];
                changed = true;
            }
            if (playerGame.roundPlacedCount === undefined) {
                playerGame.roundPlacedCount = game.orders.filter(order => order.playerId === playerId).length;
                changed = true;
            }
            if (!playerGame.secretObjectiveOptions) {
                playerGame.secretObjectiveOptions = [];
                changed = true;
            }
            if (playerGame.secretObjectiveId === undefined) {
                playerGame.secretObjectiveId = null;
                changed = true;
            }
            if (playerGame.isRonin === undefined) {
                playerGame.isRonin = game.stage === 'rounds' &&
                    !Object.values(game.provinces).includes(playerId);
                changed = true;
            }
            if (playerGame.skipsPlacement === undefined) {
                playerGame.skipsPlacement = false;
                changed = true;
            }
        }

        if (game.objectiveResumePhase === undefined) {
            game.objectiveResumePhase = game.phase === 'objectives' ? 'setup' : null;
            changed = true;
        }

        const allPlayersHaveObjectives = Object.values(game.players)
            .every(playerGame => !!playerGame.secretObjectiveId);
        if (shouldRecalculateResults &&
            game.stage !== 'finished' &&
            game.phase !== 'objectives' &&
            !allPlayersHaveObjectives) {
            let resumePhase = game.phase as Exclude<GamePhase, 'objectives'>;
            if (resumePhase === 'resolution' && game.orders.length > 0) {
                resumePhase = 'reveal';
                game.readyPlayerIds = room.players
                    .filter(player => player.kind === 'bot')
                    .map(player => player.id);
                this.addLog(game, 'reveal', `Раунд ${game.round}: все приказы открыты.`);
            }

            const objectiveDeck = shuffled(SECRET_OBJECTIVES.map(objective => objective.id));
            for (const [index, player] of room.players.entries()) {
                const options = objectiveDeck.slice(index * 2, index * 2 + 2);
                const playerGame = game.players[player.id];
                playerGame.secretObjectiveOptions = player.kind === 'bot' ? [] : options;
                playerGame.secretObjectiveId = player.kind === 'bot' ? randomItem(options) : null;
            }
            game.objectiveResumePhase = resumePhase;
            game.phase = 'objectives';
            this.addLog(game, 'round', 'Перед продолжением старой партии игроки выбирают тайные цели.');
            changed = true;
        }

        if (game.phase === 'finished' &&
            (shouldRecalculateResults || hasMigratableProvince || game.results === null ||
                game.results.some(result => !result.provinceHonorSources))) {
            game.results = this.calculateResults(room);
            changed = true;
        }

        if (game.phase === 'resolution' && game.orders.length > 0) {
            game.phase = 'reveal';
            game.readyPlayerIds = room.players.filter(player => player.kind === 'bot').map(player => player.id);
            this.addLog(game, 'reveal', `Раунд ${game.round}: все приказы открыты.`);
            changed = true;
        }

        return changed;
    }

    private requireGame(room: StoredRoom): StoredGame {
        if (room.status !== 'playing' || !room.game)
            throw new RequestError(400, 'Игра ещё не запущена');
        return room.game;
    }

    private findPlayer(request: Request, room: StoredRoom): StoredPlayer | undefined {
        const token = request.headers.get('x-player-token');
        return room.players.find(player => player.token === token);
    }

    private requirePlayer(request: Request, room: StoredRoom): StoredPlayer {
        const player = this.findPlayer(request, room);
        if (!player)
            throw new RequestError(401, 'Сессия игрока не найдена');
        return player;
    }

    private requireHost(request: Request, room: StoredRoom): StoredPlayer {
        const player = this.requirePlayer(request, room);
        if (!player.isHost)
            throw new RequestError(403, 'Это действие доступно только хозяину комнаты');
        return player;
    }

    private ensureLobby(room: StoredRoom): void {
        if (room.status !== 'lobby')
            throw new RequestError(400, 'Игра уже запущена');
    }

    private createHuman(name: string, isHost: boolean): StoredPlayer {
        const normalizedName = name?.trim().slice(0, 24);
        if (!normalizedName)
            throw new RequestError(400, 'Введите имя игрока');

        return {
            id: crypto.randomUUID(),
            token: crypto.randomUUID(),
            name: normalizedName,
            kind: 'human',
            isHost,
            isReady: false,
            clanId: null
        };
    }

    private toPublicState(room: StoredRoom, viewer?: StoredPlayer): RoomState {
        const game = room.game;
        return {
            code: room.code,
            status: room.status,
            maxPlayers: room.maxPlayers,
            players: room.players.map(({ token, ...player }) => player),
            createdAt: room.createdAt,
            game: game ? {
                stage: game.stage,
                round: game.round,
                phase: game.phase,
                firstPlayerId: game.firstPlayerId,
                turnPlayerId: game.turnPlayerId,
                players: room.players.map(player => {
                    const playerGame = game.players[player.id];
                    return {
                        playerId: player.id,
                        handCount: playerGame.hand.length,
                        stockCount: playerGame.stock.length,
                        discardCount: playerGame.discard.length,
                        placedCount: playerGame.roundPlacedCount,
                        provinceCount: Object.values(game.provinces).filter(owner => owner === player.id).length,
                        setupRemaining: playerGame.setupRemaining,
                        hasSecretObjective: !!playerGame.secretObjectiveId,
                        isRonin: playerGame.isRonin,
                        skipsPlacement: playerGame.skipsPlacement
                    };
                }),
                provinces: game.provinces,
                defenseBonuses: game.defenseBonuses,
                provinceSpecials: game.provinceSpecials,
                readyPlayerIds: game.readyPlayerIds,
                orders: game.orders.map(order => this.toPublicOrder(
                    order,
                    game.phase,
                    viewer?.id,
                    viewer ? game.players[viewer.id]?.scoutedOrderIds ?? [] : []
                )),
                log: game.log,
                hand: viewer ? game.players[viewer.id]?.hand ?? [] : [],
                tokenPool: viewer ? this.toTokenPoolView(game, viewer.id) : [],
                actionCards: viewer
                    ? game.players[viewer.id]?.actionCards ?? { scout: 0, shugenja: 0 }
                    : { scout: 0, shugenja: 0 },
                canPassPlacement: !!viewer &&
                    game.phase === 'placement' &&
                    game.turnPlayerId === viewer.id &&
                    !this.hasAnyValidPlacement(game, viewer.id),
                secretObjectiveOptions: viewer
                    ? game.players[viewer.id]?.secretObjectiveOptions
                        .map(id => SECRET_OBJECTIVES_BY_ID[id]) ?? []
                    : [],
                secretObjective: viewer
                    ? game.players[viewer.id]?.secretObjectiveId
                        ? SECRET_OBJECTIVES_BY_ID[game.players[viewer.id].secretObjectiveId!]
                        : null
                    : null,
                results: game.results
            } : null
        };
    }

    private toTokenPoolView(game: StoredGame, playerId: string) {
        const player = game.players[playerId];
        if (!player)
            return [];

        const placed = game.orders.filter(order => order.playerId === playerId).map(order => order.token);
        const allTokens = [...player.stock, ...player.hand, ...player.discard, ...placed];
        return TOKEN_TYPES.flatMap(type => {
            const strengths = [...new Set(allTokens.filter(token => token.type === type).map(token => token.strength))]
                .sort((left, right) => (left ?? -1) - (right ?? -1));
            return strengths.map(strength => {
                const matches = (tokens: StoredBattleToken[]) =>
                    tokens.filter(token => token.type === type && token.strength === strength).length;
                const totalTokens = allTokens.filter(token => token.type === type && token.strength === strength);
                return {
                    type,
                    strength,
                    stock: matches(player.stock),
                    hand: matches(player.hand),
                    discard: matches(player.discard),
                    placed: matches(placed),
                    total: totalTokens.length
                };
            });
        });
    }

    private toPublicOrder(
        order: StoredPlacedOrder,
        phase: GamePhase,
        viewerId?: string,
        scoutedOrderIds: string[] = []
    ): PlacedOrderView {
        const revealed = phase === 'reveal' || phase === 'resolution' || phase === 'finished' ||
            order.playerId === viewerId || order.token.type === 'blessing' || scoutedOrderIds.includes(order.id);
        return {
            id: order.id,
            playerId: order.playerId,
            target: order.target,
            type: revealed ? order.token.type : 'hidden',
            strength: revealed ? order.token.strength : null,
            revealed
        };
    }

    private toSession(roomCode: string, player: StoredPlayer) {
        return { roomCode, playerId: player.id, playerToken: player.token };
    }

    private save(room: StoredRoom): Promise<void> {
        return this.state.storage.put('room', room);
    }
}
