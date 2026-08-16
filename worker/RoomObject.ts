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
import {
    CLAN_RULES,
    type BattleTokenType,
    type ClanActionType,
    type ClanId,
    type GameLogEntry,
    type GameLogEventType,
    type GamePhase,
    type GameResultView,
    type OrderTarget,
    type PlacedOrderView,
    type RoomState
} from '../shared/room';
import type { Env, StoredBattleToken, StoredGame, StoredPlacedOrder, StoredPlayer, StoredPlayerGame, StoredRoom } from './room/types';
import { randomItem, shuffled } from './room/collections';
import { RoomRequestError as RequestError, jsonResponse as json } from './room/http';
import {
    ROOM_SCHEMA_VERSION, addLobbyBot, assertLobbyCanStart, createLobby, findPlayer,
    joinLobby, removeLobbyBot, requireHost, requirePlayer, selectLobbyClan, setLobbyReady, toPlayerSession
} from './room/lobby';
import { hasAttachedBlessing, hasLandOrderInDirection, hasSeaBorderOrder } from './game/orderQueries';
import { calculateGameResults, hasConnectedProvinceGroup, isSecretObjectiveAchieved } from './game/scoring';

interface BotPlacementChoice {
    token: StoredBattleToken;
    target: OrderTarget;
    score: number;
}

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
                const botHasTurn = room.status === 'playing' && !!room.game?.turnPlayerId &&
                    room.players.some(player =>
                        player.id === room.game?.turnPlayerId && player.kind === 'bot'
                    );
                const botHasPendingClanAction = room.status === 'playing' &&
                    this.pendingClanAction(room)?.player.kind === 'bot';
                if (botHasTurn || botHasPendingClanAction) {
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
            if (request.method === 'POST' && url.pathname === '/game/clan/dragon-return')
                return this.returnDragonToken(request, room);
            if (request.method === 'POST' && url.pathname === '/game/clan/scorpion-peek')
                return this.useScorpionPeek(request, room);
            if (request.method === 'POST' && url.pathname === '/game/clan/unicorn-swap')
                return this.swapUnicornOrders(request, room);
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
        const { room, player } = createLobby(body.code, body.playerName);

        await this.save(room);
        return json({ room: this.toPublicState(room, player), session: this.toSession(room.code, player) }, 201);
    }

    private async joinRoom(request: Request, room: StoredRoom): Promise<Response> {
        const body = await request.json<{ playerName: string }>();
        const player = joinLobby(room, body.playerName);
        await this.save(room);
        return json({ room: this.toPublicState(room, player), session: this.toSession(room.code, player) }, 201);
    }

    private async selectClan(request: Request, room: StoredRoom): Promise<Response> {
        const player = this.requirePlayer(request, room);
        const body = await request.json<{ clanId: ClanId }>();
        selectLobbyClan(room, player, body.clanId);
        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private async setReady(request: Request, room: StoredRoom): Promise<Response> {
        const player = this.requirePlayer(request, room);
        const body = await request.json<{ isReady: boolean }>();
        setLobbyReady(room, player, body.isReady);
        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private async addBot(request: Request, room: StoredRoom): Promise<Response> {
        const host = this.requireHost(request, room);
        addLobbyBot(room);
        await this.save(room);
        return json(this.toPublicState(room, host), 201);
    }

    private async removeBot(request: Request, room: StoredRoom, botId: string): Promise<Response> {
        const host = this.requireHost(request, room);
        removeLobbyBot(room, botId);
        await this.save(room);
        return json(this.toPublicState(room, host));
    }

    private async startGame(request: Request, room: StoredRoom): Promise<Response> {
        const host = this.requireHost(request, room);
        assertLobbyCanStart(room);

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
                secretObjectiveId: player.kind === 'bot'
                    ? this.chooseBotSecretObjective(objectiveOptions, player.clanId!)
                    : null,
                isRonin: false,
                skipsPlacement: false,
                clanAbilityUsed: false,
                mustReturnToken: false
            }];
            })),
            provinces: Object.fromEntries(PROVINCE_IDS.map(id => [id, null])),
            defenseBonuses: Object.fromEntries(PROVINCE_IDS.map(id => [id, 0])),
            provinceSpecials: {},
            readyPlayerIds: [],
            orders: [],
            attemptedAttackProvinceIds: [],
            cancelledAttackProvinceIds: [],
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
            this.resolveAutomaticClanActions(room);
            this.skipPendingClanActions(room, host);
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
        return calculateGameResults(room);
    }

    private isSecretObjectiveAchieved(
        objectiveId: SecretObjectiveId,
        controlledProvinceIds: string[],
        hasFewestProvinces: boolean
    ): boolean {
        return isSecretObjectiveAchieved(objectiveId, controlledProvinceIds, hasFewestProvinces);
    }

    private hasConnectedProvinceGroup(
        controlledProvinceIds: Set<string>,
        provinceCount: number,
        regionCount: number
    ): boolean {
        return hasConnectedProvinceGroup(controlledProvinceIds, provinceCount, regionCount);
    }

    private async setRevealReady(request: Request, room: StoredRoom): Promise<Response> {
        const player = this.requirePlayer(request, room);
        const game = this.requireGame(room);
        if (game.phase !== 'reveal')
            throw new RequestError(400, 'Сейчас подтверждение просмотра не требуется');
        this.resolveAutomaticClanActions(room);
        if (this.pendingClanAction(room))
            throw new RequestError(400, 'Сначала завершите доступную способность клана перед вскрытием');
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

    private pendingScorpionPlayer(room: StoredRoom): StoredPlayer | undefined {
        const game = room.game;
        if (!game || game.phase !== 'reveal')
            return undefined;
        return room.players.find(player => {
            const playerGame = game.players[player.id];
            if (player.clanId !== 'scorpion' || playerGame?.clanAbilityUsed ||
                playerGame?.roundPlacedCount < 1)
                return false;
            return game.orders.some(order =>
                order.playerId !== player.id &&
                order.token.type !== 'blessing' &&
                !playerGame.scoutedOrderIds.includes(order.id) &&
                !this.isOrderProtectedByBlessing(game, order.id)
            );
        });
    }

    private pendingUnicornPlayer(room: StoredRoom): StoredPlayer | undefined {
        const game = room.game;
        if (!game || game.phase !== 'reveal')
            return undefined;
        return room.players.find(player => {
            if (player.clanId !== 'unicorn' || game.players[player.id]?.clanAbilityUsed)
                return false;
            const movableOrders = game.orders.filter(order =>
                order.playerId === player.id &&
                order.target.kind !== 'order' &&
                !this.isOrderProtectedByBlessing(game, order.id)
            );
            return movableOrders.length >= 2;
        });
    }

    private pendingClanAction(
        room: StoredRoom
    ): { type: ClanActionType; player: StoredPlayer } | undefined {
        const scorpion = this.pendingScorpionPlayer(room);
        if (scorpion)
            return { type: 'scorpion-peek', player: scorpion };
        const unicorn = this.pendingUnicornPlayer(room);
        return unicorn ? { type: 'unicorn-swap', player: unicorn } : undefined;
    }

    private resolveAutomaticClanActions(room: StoredRoom): void {
        for (let guard = 0; guard < room.players.length; guard++) {
            const pending = this.pendingClanAction(room);
            if (!pending || pending.player.kind !== 'bot')
                return;
            if (pending.type === 'scorpion-peek')
                this.maybeUseBotScorpionPeek(room, pending.player);
            else
                this.commitBotUnicornSwap(room, pending.player);

            if (!this.requireGame(room).players[pending.player.id].clanAbilityUsed)
                throw new Error(`Бот ${pending.player.name} не завершил способность клана`);
        }
    }

    private skipPendingClanActions(room: StoredRoom, host: StoredPlayer): void {
        for (let guard = 0; guard < room.players.length; guard++) {
            const pending = this.pendingClanAction(room);
            if (!pending)
                return;
            const game = this.requireGame(room);
            game.players[pending.player.id].clanAbilityUsed = true;
            game.readyPlayerIds = game.readyPlayerIds.filter(id => id !== pending.player.id);
            this.addLog(
                game,
                'card',
                `⏭ ${host.name} продолжает исполнение без способности клана ${pending.player.name}.`,
                undefined,
                pending.player.id
            );
        }
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
        const cancelledAttackProvinceId = this.attackedProvinceId(game, order);
        if (cancelledAttackProvinceId && game.provinces[cancelledAttackProvinceId]) {
            game.cancelledAttackProvinceIds ??= [];
            if (!game.cancelledAttackProvinceIds.includes(cancelledAttackProvinceId))
                game.cancelledAttackProvinceIds.push(cancelledAttackProvinceId);
        }
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

    private async returnDragonToken(request: Request, room: StoredRoom): Promise<Response> {
        const player = this.requirePlayer(request, room);
        const game = this.requireGame(room);
        const playerGame = game.players[player.id];
        if (game.phase !== 'placement' || player.clanId !== 'dragon' || !playerGame.mustReturnToken)
            throw new RequestError(400, 'Сейчас Дракону не нужно возвращать жетон');

        const body = await request.json<{ tokenId: string }>();
        const tokenIndex = playerGame.hand.findIndex(token => token.id === body.tokenId);
        if (tokenIndex < 0)
            throw new RequestError(400, 'Жетон не найден в вашем активе');
        if (playerGame.hand[tokenIndex].type === 'blank')
            throw new RequestError(400, 'Пустой жетон нельзя вернуть в запас');

        const [token] = playerGame.hand.splice(tokenIndex, 1);
        playerGame.stock.push(token);
        playerGame.mustReturnToken = false;
        this.addLog(
            game,
            'card',
            `🐉 ${player.name} завершает предвидение Дракона и возвращает один жетон в запас.`,
            undefined,
            player.id
        );

        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private async useScorpionPeek(request: Request, room: StoredRoom): Promise<Response> {
        const player = this.requirePlayer(request, room);
        const game = this.requireGame(room);
        const playerGame = game.players[player.id];
        const revealWindow = game.phase === 'reveal' &&
            this.pendingScorpionPlayer(room)?.id === player.id;
        if ((game.phase !== 'placement' && !revealWindow) || player.clanId !== 'scorpion')
            throw new RequestError(400, 'Способность Скорпиона сейчас недоступна');
        if (playerGame.clanAbilityUsed)
            throw new RequestError(400, 'Способность Скорпиона уже использована в этом раунде');
        if (playerGame.roundPlacedCount < 1)
            throw new RequestError(400, 'Сначала разместите боевой жетон');

        const body = await request.json<{ orderId?: string | null }>();
        if (!body.orderId) {
            if (!revealWindow)
                throw new RequestError(400, 'Пропустить способность можно перед вскрытием приказов');
            playerGame.clanAbilityUsed = true;
            game.readyPlayerIds = game.readyPlayerIds.filter(id => id !== player.id);
            this.addLog(
                game,
                'card',
                `🦂 ${player.name} не использует способность Скорпиона в этом раунде.`,
                undefined,
                player.id
            );
            await this.save(room);
            return json(this.toPublicState(room, player));
        }

        const order = this.requireOpponentOrder(game, player.id, body.orderId);
        if (order.token.type === 'blessing' || this.isOrderProtectedByBlessing(game, order.id))
            throw new RequestError(400, 'Этот жетон защищён благословением');
        if (playerGame.scoutedOrderIds.includes(order.id))
            throw new RequestError(400, 'Этот жетон уже открыт для вас');

        playerGame.scoutedOrderIds.push(order.id);
        playerGame.clanAbilityUsed = true;
        if (revealWindow)
            game.readyPlayerIds = game.readyPlayerIds.filter(id => id !== player.id);
        this.addLog(
            game,
            'card',
            `🦂 ${player.name} использует способность Скорпиона и тайно осматривает жетон соперника.`,
            this.battleProvinceId(order) ?? undefined,
            player.id
        );

        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private async swapUnicornOrders(request: Request, room: StoredRoom): Promise<Response> {
        const player = this.requirePlayer(request, room);
        const game = this.requireGame(room);
        const playerGame = game.players[player.id];
        if (game.phase !== 'reveal' || player.clanId !== 'unicorn' || playerGame.clanAbilityUsed)
            throw new RequestError(400, 'Манёвр Единорога сейчас недоступен');

        const body = await request.json<{ orderIds?: string[] }>();
        const orderIds = body.orderIds ?? [];
        game.readyPlayerIds = game.readyPlayerIds.filter(id => id !== player.id);
        if (orderIds.length === 0) {
            playerGame.clanAbilityUsed = true;
            this.addLog(game, 'card', `🦄 ${player.name} оставляет свои приказы на местах.`, undefined, player.id);
        } else {
            if (orderIds.length !== 2 || orderIds[0] === orderIds[1])
                throw new RequestError(400, 'Выберите ровно два разных жетона');
            const orders = orderIds.map(id => game.orders.find(order => order.id === id));
            if (orders.some(order => !order || order.playerId !== player.id || order.target.kind === 'order'))
                throw new RequestError(400, 'Можно менять местами только два своих основных жетона');
            const [first, second] = orders as [StoredPlacedOrder, StoredPlacedOrder];
            if (this.isOrderProtectedByBlessing(game, first.id) || this.isOrderProtectedByBlessing(game, second.id))
                throw new RequestError(400, 'Жетон под благословением нельзя перемещать способностью клана');

            [first.target, second.target] = [second.target, first.target];
            this.discardIllegalUnicornOrders(room, player.id, [first.id, second.id]);
            playerGame.clanAbilityUsed = true;
            this.rebuildAttemptedAttacks(game);
            this.addLog(
                game,
                'card',
                `🦄 ${player.name} меняет местами два приказа перед вскрытием.`,
                undefined,
                player.id
            );
        }

        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private discardIllegalUnicornOrders(room: StoredRoom, playerId: string, orderIds: string[]): void {
        const game = this.requireGame(room);
        const movedOrders = game.orders.filter(order => orderIds.includes(order.id));
        const gameWithoutMoved = {
            ...game,
            orders: game.orders.filter(order => !orderIds.includes(order.id))
        };
        const illegalOrders = movedOrders.filter(order =>
            !this.isTargetValid(gameWithoutMoved, playerId, order.token, order.target)
        );
        if (illegalOrders.length === 0)
            return;

        const illegalIds = new Set(illegalOrders.map(order => order.id));
        game.orders = game.orders.filter(order => !illegalIds.has(order.id));
        const playerGame = game.players[playerId];
        for (const order of illegalOrders) {
            if (order.token.type === 'blank')
                playerGame.hand.push(order.token);
            else
                playerGame.discard.push(order.token);
        }
        this.addLog(
            game,
            'card',
            `🦄 После манёвра незаконно расположенные жетоны сброшены: ${illegalOrders.length}.`,
            undefined,
            playerId
        );
    }

    private activeAttackProvinceIds(game: StoredGame): string[] {
        return game.orders
            .map(order => this.attackedProvinceId(game, order))
            .filter((provinceId): provinceId is string =>
                !!provinceId && !!game.provinces[provinceId]
            );
    }

    private rebuildAttemptedAttacks(game: StoredGame): void {
        game.attemptedAttackProvinceIds = [...new Set(
            [...(game.cancelledAttackProvinceIds ?? []), ...this.activeAttackProvinceIds(game)]
        )];
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
        return hasAttachedBlessing(game, orderId);
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
                break;

            this.commitBotTurn(room, bot);
            turns++;
            if (turns > 100)
                throw new Error('Автоматические ходы ботов превысили безопасный предел');
        }

        this.resolveAutomaticClanActions(room);
    }

    private commitBotTurn(room: StoredRoom, bot: StoredPlayer): void {
        const game = this.requireGame(room);

        if (game.phase === 'setup') {
            const freeProvinces = PROVINCE_IDS.filter(id => game.provinces[id] === null);
            if (freeProvinces.length === 0)
                throw new Error('На карте не осталось свободных провинций');
            const choice = freeProvinces
                .map(provinceId => ({
                    provinceId,
                    score: this.scoreBotSetupProvince(room, bot, provinceId) +
                        this.stableBotJitter(`${room.code}:${bot.id}:setup:${provinceId}`)
                }))
                .sort((left, right) => right.score - left.score)[0];
            this.commitControl(room, bot.id, choice.provinceId);
        } else if (game.phase === 'placement') {
            const playerGame = game.players[bot.id];
            if (playerGame.mustReturnToken) {
                this.returnDragonTokenForBot(game, bot);
                return;
            }

            this.maybeUseBotScorpionPeek(room, bot);
            this.maybeUseBotScout(room, bot);
            let options = playerGame.hand.flatMap(token =>
                this.targetsForToken(game, bot.id, token).map(target => ({ token, target }))
            );

            const shugenja = this.chooseBotShugenjaOrder(room, bot);
            if (shugenja && (options.length === 0 || shugenja.score >= 15)) {
                this.commitShugenja(room, bot, shugenja.order);
                options = playerGame.hand.flatMap(token =>
                    this.targetsForToken(game, bot.id, token).map(target => ({ token, target }))
                );
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

            const choice = options
                .map(({ token, target }): BotPlacementChoice => ({
                    token,
                    target,
                    score: this.scoreBotPlacement(room, bot, token, target) +
                        this.stableBotJitter(
                            `${room.code}:${game.round}:${bot.id}:${token.id}:${this.orderTargetKey(target)}`
                        )
                }))
                .sort((left, right) => right.score - left.score)[0];
            this.commitOrder(room, bot.id, choice.token.id, choice.target);
            this.maybeUseBotScorpionPeek(room, bot);
            this.advancePlacementTurn(room, bot.id);
        } else {
            throw new Error('Бот сейчас не может сделать ход');
        }
    }

    private chooseBotSecretObjective(options: SecretObjectiveId[], clanId: ClanId): SecretObjectiveId {
        const matchingClanObjective: Partial<Record<ClanId, SecretObjectiveId>> = {
            unicorn: 'five_winds_court',
            dragon: 'great_northern_wall',
            scorpion: 'lair_of_secrets',
            crab: 'last_line',
            lion: 'fields_of_battle',
            phoenix: 'great_library',
            crane: 'rice_of_the_empire'
        };
        return [...options].sort((left, right) => {
            const score = (id: SecretObjectiveId) =>
                (matchingClanObjective[clanId] === id ? 100 : 0) +
                (SECRET_OBJECTIVES_BY_ID[id]?.honor ?? 0);
            return score(right) - score(left);
        })[0] ?? options[0];
    }

    private returnDragonTokenForBot(game: StoredGame, bot: StoredPlayer): void {
        const playerGame = game.players[bot.id];
        const token = playerGame.hand
            .filter(candidate => candidate.type !== 'blank')
            .sort((left, right) => this.botTokenReserveValue(left) - this.botTokenReserveValue(right))[0];
        if (!token)
            throw new Error('Дракону нечего вернуть в запас');
        playerGame.hand = playerGame.hand.filter(candidate => candidate.id !== token.id);
        playerGame.stock.push(token);
        playerGame.mustReturnToken = false;
        this.addLog(
            game,
            'card',
            `🐉 ${bot.name} завершает предвидение Дракона и возвращает один жетон в запас.`,
            undefined,
            bot.id
        );
    }

    private botTokenReserveValue(token: StoredBattleToken): number {
        const base = token.strength ?? 0;
        if (token.type === 'diplomacy' || token.type === 'raid')
            return 3.5;
        if (token.type === 'blessing')
            return base + 2;
        if (token.type === 'shinobi')
            return base + 1.5;
        if (token.type === 'fleet')
            return base + 1;
        return base;
    }

    private scoreBotSetupProvince(room: StoredRoom, bot: StoredPlayer, provinceId: string): number {
        const game = this.requireGame(room);
        const adjacentOwn = adjacentProvinceIds(provinceId)
            .filter(id => game.provinces[id] === bot.id).length;
        return this.provinceStrategicValue(room, bot, provinceId) +
            adjacentOwn * 5 -
            (adjacentOwn === 0 ? 3 : 0);
    }

    private provinceStrategicValue(room: StoredRoom, bot: StoredPlayer, provinceId: string): number {
        const game = this.requireGame(room);
        const region = REGIONS.find(candidate => candidate.provinceIds.includes(provinceId));
        const ownedInRegion = region?.provinceIds.filter(id => game.provinces[id] === bot.id).length ?? 0;
        const remainingInRegion = region ? region.provinceIds.length - ownedInRegion : 0;
        const completesRegion = region?.awardsHonor && remainingInRegion === 1;
        const nearlyCompletesRegion = region?.awardsHonor && remainingInRegion === 2;
        const capital = Object.values(CLAN_CAPITALS).includes(provinceId);
        return (PROVINCE_HONOR[provinceId] ?? 0) * 2 +
            (PROVINCE_BASE_DEFENSE[provinceId] ?? 0) +
            (capital ? 4 : 0) +
            (completesRegion ? 12 : nearlyCompletesRegion ? 4 : 0) +
            this.botObjectiveProvinceValue(game, bot.id, provinceId);
    }

    private botObjectiveProvinceValue(game: StoredGame, playerId: string, provinceId: string): number {
        const objectiveId = game.players[playerId]?.secretObjectiveId;
        if (!objectiveId)
            return 0;
        const targetClanByObjective: Partial<Record<SecretObjectiveId, ClanId>> = {
            five_winds_court: 'unicorn',
            great_northern_wall: 'dragon',
            lair_of_secrets: 'scorpion',
            last_line: 'crab',
            fields_of_battle: 'lion',
            great_library: 'phoenix',
            rice_of_the_empire: 'crane'
        };
        const targetClan = targetClanByObjective[objectiveId];
        if (targetClan) {
            if (CLAN_CAPITALS[targetClan] === provinceId)
                return 14;
            const targetRegion = PROVINCE_REGIONS[CLAN_CAPITALS[targetClan]];
            return PROVINCE_REGIONS[provinceId] === targetRegion ? 5 : 0;
        }
        if (objectiveId === 'path_of_the_sail')
            return COASTAL_PROVINCES.has(provinceId) ? 5 : 0;
        if (objectiveId === 'reclaiming_lost_lands')
            return SHADOWLANDS_PROVINCES.has(provinceId) ? 9 : 0;
        if (objectiveId === 'web_of_influence') {
            const ownedRegions = new Set(
                PROVINCE_IDS
                    .filter(id => game.provinces[id] === playerId)
                    .map(id => PROVINCE_REGIONS[id])
            );
            return ownedRegions.has(PROVINCE_REGIONS[provinceId]) ? 0 : 5;
        }
        if (objectiveId === 'emerald_of_the_empire')
            return adjacentProvinceIds(provinceId).some(id => game.provinces[id] === playerId) ? 4 : 0;
        if (objectiveId === 'path_of_humanity')
            return -4;
        return 0;
    }

    private scoreBotPlacement(
        room: StoredRoom,
        bot: StoredPlayer,
        token: StoredBattleToken,
        target: OrderTarget
    ): number {
        const game = this.requireGame(room);
        if (token.type === 'blessing' && target.kind === 'order') {
            const baseOrder = game.orders.find(order => order.id === target.id);
            const provinceId = baseOrder ? this.battleProvinceId(baseOrder) : null;
            if (!baseOrder || !provinceId)
                return -100;
            const contested = this.visibleThreatCount(game, bot.id, provinceId) > 0 ||
                game.provinces[provinceId] !== bot.id;
            return (token.strength ?? 0) * 3 +
                (contested ? 10 : 1) +
                (baseOrder.token.strength ?? 0);
        }

        const provinceId = this.targetProvinceId(target);
        if (!provinceId)
            return -50;
        const strategicValue = this.provinceStrategicValue(room, bot, provinceId);
        const ownerId = game.provinces[provinceId];
        const defending = ownerId === bot.id;
        const threatCount = this.visibleThreatCount(game, bot.id, provinceId);
        const ownCombatStrength = this.botCombatStrengthAt(game, bot.id, provinceId);
        const tokenStrength = token.strength ?? 0;

        if (token.type === 'raid') {
            const hasSupport = adjacentProvinceIds(provinceId).some(id => game.provinces[id] === bot.id) ||
                game.orders.some(order =>
                    order.playerId === bot.id &&
                    order.token.type === 'shinobi' &&
                    order.target.kind === 'province' &&
                    order.target.id === provinceId
                );
            if (!hasSupport)
                return -1000;
            const touchingOrders = game.orders.filter(order =>
                this.orderProvinceIds(game, order).includes(provinceId)
            ).length;
            return strategicValue * .5 + touchingOrders * 4 +
                (game.defenseBonuses[provinceId] ?? 0) * 3;
        }

        if (token.type === 'diplomacy') {
            const ownTouchingOrders = game.orders.filter(order =>
                order.playerId === bot.id && this.orderProvinceIds(game, order).includes(provinceId)
            ).length;
            return strategicValue + threatCount * 10 + game.round * 1.5 -
                ownTouchingOrders * 4 - (threatCount === 0 ? 8 : 0);
        }

        if (token.type === 'blank')
            return strategicValue * .35 + threatCount * 2 + (game.round < 5 ? 3 : 1);

        if (!['army', 'fleet', 'shinobi'].includes(token.type))
            return 0;

        if (defending) {
            const printedDefense = PROVINCE_BASE_DEFENSE[provinceId] ?? 0;
            const earnedDefense = (game.defenseBonuses[provinceId] ?? 0) *
                (bot.clanId === 'crab' ? 3 : 1);
            const expectedAttack = threatCount * 2;
            const before = printedDefense + earnedDefense + ownCombatStrength;
            const after = before + tokenStrength;
            const crossesThreshold = threatCount > 0 && before < expectedAttack && after >= expectedAttack;
            return strategicValue * .65 + threatCount * 5 +
                (crossesThreshold ? 13 : tokenStrength) -
                (threatCount === 0 ? tokenStrength * .7 : 0);
        }

        const defender = room.players.find(player => player.id === ownerId);
        const printedDefense = PROVINCE_BASE_DEFENSE[provinceId] ?? 0;
        const earnedDefense = (game.defenseBonuses[provinceId] ?? 0) *
            (defender?.clanId === 'crab' ? 3 : 1);
        const expectedDefendingOrders = game.orders.filter(order =>
            order.playerId === ownerId && this.battleProvinceId(order) === provinceId
        ).length * 2;
        const threshold = printedDefense + earnedDefense + expectedDefendingOrders;
        const after = ownCombatStrength + tokenStrength;
        const winsTie = bot.clanId === 'crane';
        const reachesThreshold = winsTie ? after >= threshold : after > threshold;
        const overkill = Math.max(0, after - threshold - 1);
        return strategicValue + (reachesThreshold ? 14 : tokenStrength * 2 - 5) -
            overkill * 1.2 -
            (game.round < 5 ? Math.max(0, tokenStrength - 3) * .8 : 0);
    }

    private visibleThreatCount(game: StoredGame, playerId: string, provinceId: string): number {
        return game.orders.filter(order =>
            order.playerId !== playerId &&
            this.battleProvinceId(order) === provinceId &&
            game.provinces[provinceId] === playerId
        ).length;
    }

    private botCombatStrengthAt(game: StoredGame, playerId: string, provinceId: string): number {
        return game.orders
            .filter(order =>
                order.playerId === playerId &&
                this.battleProvinceId(order) === provinceId &&
                ['army', 'fleet', 'shinobi'].includes(order.token.type)
            )
            .reduce((sum, order) => sum + (order.token.strength ?? 0), 0);
    }

    private targetProvinceId(target: OrderTarget): string | null {
        if (target.kind === 'province')
            return target.id;
        if (target.kind === 'land-border' || target.kind === 'sea-border')
            return target.provinceId ?? null;
        return null;
    }

    private orderTargetKey(target: OrderTarget): string {
        return `${target.kind}:${target.id}:${target.provinceId ?? ''}`;
    }

    private stableBotJitter(value: string): number {
        let hash = 2166136261;
        for (let index = 0; index < value.length; index++) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return ((hash >>> 0) % 1000) / 2000;
    }

    private scoreBotOpponentOrder(room: StoredRoom, bot: StoredPlayer, order: StoredPlacedOrder): number {
        const game = this.requireGame(room);
        const provinceId = this.battleProvinceId(order);
        if (!provinceId)
            return 0;
        const attacksBot = game.provinces[provinceId] === bot.id;
        const blocksBot = game.orders.some(candidate =>
            candidate.playerId === bot.id &&
            this.battleProvinceId(candidate) === provinceId &&
            game.provinces[provinceId] !== bot.id
        );
        const known = game.players[bot.id].scoutedOrderIds.includes(order.id);
        const expectedStrength = known ? order.token.strength ?? 1 : 2;
        return (attacksBot ? 10 : 0) +
            (blocksBot ? 6 : 0) +
            this.provinceStrategicValue(room, bot, provinceId) * .4 +
            expectedStrength;
    }

    private maybeUseBotScout(room: StoredRoom, bot: StoredPlayer): void {
        const game = this.requireGame(room);
        const playerGame = game.players[bot.id];
        if (playerGame.actionCards.scout <= 0)
            return;
        const candidate = game.orders
            .filter(order =>
                order.playerId !== bot.id &&
                order.token.type !== 'blessing' &&
                !this.isOrderProtectedByBlessing(game, order.id) &&
                !playerGame.scoutedOrderIds.includes(order.id)
            )
            .map(order => ({ order, score: this.scoreBotOpponentOrder(room, bot, order) }))
            .sort((left, right) => right.score - left.score)[0];
        if (!candidate || candidate.score < (game.round >= 3 ? 7 : 12))
            return;
        playerGame.actionCards.scout--;
        playerGame.scoutedOrderIds.push(candidate.order.id);
        this.addLog(
            game,
            'card',
            `👁 ${bot.name} использует разведку и тайно осматривает один вражеский жетон.`,
            this.battleProvinceId(candidate.order) ?? undefined,
            bot.id
        );
    }

    private chooseBotShugenjaOrder(
        room: StoredRoom,
        bot: StoredPlayer
    ): { order: StoredPlacedOrder; score: number } | null {
        const game = this.requireGame(room);
        if (game.players[bot.id].actionCards.shugenja <= 0)
            return null;
        return game.orders
            .filter(order => order.playerId !== bot.id && !this.isOrderProtectedByBlessing(game, order.id))
            .map(order => ({ order, score: this.scoreBotOpponentOrder(room, bot, order) }))
            .sort((left, right) => right.score - left.score)[0] ?? null;
    }

    private maybeUseBotScorpionPeek(room: StoredRoom, bot: StoredPlayer): void {
        const game = this.requireGame(room);
        const playerGame = game.players[bot.id];
        if (bot.clanId !== 'scorpion' || playerGame.clanAbilityUsed ||
            playerGame.roundPlacedCount < 1 ||
            (game.phase !== 'placement' && game.phase !== 'reveal'))
            return;
        const candidate = game.orders
            .filter(order =>
                order.playerId !== bot.id &&
                order.token.type !== 'blessing' &&
                !this.isOrderProtectedByBlessing(game, order.id) &&
                !playerGame.scoutedOrderIds.includes(order.id)
            )
            .map(order => ({ order, score: this.scoreBotOpponentOrder(room, bot, order) }))
            .sort((left, right) => right.score - left.score)[0];
        if (!candidate)
            return;
        playerGame.scoutedOrderIds.push(candidate.order.id);
        playerGame.clanAbilityUsed = true;
        this.addLog(
            game,
            'card',
            `🦂 ${bot.name} использует способность Скорпиона и тайно осматривает жетон соперника.`,
            this.battleProvinceId(candidate.order) ?? undefined,
            bot.id
        );
    }

    private commitBotUnicornSwap(room: StoredRoom, bot: StoredPlayer): void {
        const game = this.requireGame(room);
        const playerGame = game.players[bot.id];
        const movable = game.orders.filter(order =>
            order.playerId === bot.id &&
            order.target.kind !== 'order' &&
            !this.isOrderProtectedByBlessing(game, order.id)
        );
        let best: { first: StoredPlacedOrder; second: StoredPlacedOrder; gain: number } | null = null;
        for (let left = 0; left < movable.length; left++) {
            for (let right = left + 1; right < movable.length; right++) {
                const first = movable[left];
                const second = movable[right];
                const gameWithoutPair = {
                    ...game,
                    orders: game.orders.filter(order => order.id !== first.id && order.id !== second.id)
                };
                if (!this.isTargetValid(gameWithoutPair, bot.id, first.token, second.target) ||
                    !this.isTargetValid(gameWithoutPair, bot.id, second.token, first.target))
                    continue;
                const before = this.scoreBotPlacement(room, bot, first.token, first.target) +
                    this.scoreBotPlacement(room, bot, second.token, second.target);
                const after = this.scoreBotPlacement(room, bot, first.token, second.target) +
                    this.scoreBotPlacement(room, bot, second.token, first.target);
                const gain = after - before;
                if (!best || gain > best.gain)
                    best = { first, second, gain };
            }
        }

        if (best && best.gain > 1) {
            [best.first.target, best.second.target] = [best.second.target, best.first.target];
            this.rebuildAttemptedAttacks(game);
            this.addLog(
                game,
                'card',
                `🦄 ${bot.name} меняет местами два приказа перед вскрытием.`,
                undefined,
                bot.id
            );
        } else {
            this.addLog(game, 'card', `🦄 ${bot.name} оставляет свои приказы на местах.`, undefined, bot.id);
        }
        playerGame.clanAbilityUsed = true;
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
        game.cancelledAttackProvinceIds = [];

        for (const player of room.players) {
            const playerGame = game.players[player.id];
            playerGame.scoutedOrderIds = [];
            playerGame.roundPlacedCount = 0;
            playerGame.isRonin = !Object.values(game.provinces).includes(player.id);
            playerGame.skipsPlacement = false;
            playerGame.clanAbilityUsed = false;
            this.fillHand(playerGame, player.clanId!);

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

    private fillHand(player: StoredPlayerGame, clanId: ClanId): void {
        const blankInHand = player.hand.some(token => token.type === 'blank');
        if (!blankInHand) {
            const blankIndex = player.stock.findIndex(token => token.type === 'blank');
            if (blankIndex >= 0)
                player.hand.push(player.stock.splice(blankIndex, 1)[0]);
        }

        const handLimit = clanId === 'dragon' ? 7 : 6;
        while (player.hand.length < handLimit && player.stock.length > 0) {
            const realTokenIndexes = player.stock
                .map((token, index) => token.type === 'blank' ? -1 : index)
                .filter(index => index >= 0);
            if (realTokenIndexes.length === 0)
                break;
            const index = randomItem(realTokenIndexes);
            player.hand.push(player.stock.splice(index, 1)[0]);
        }
        player.mustReturnToken = clanId === 'dragon' && player.hand.length > 6;
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
        const lionDefenseBlanks = blankOrders.filter(order => this.isLionDefenseBlank(room, order));
        for (const order of blankOrders) {
            if (!lionDefenseBlanks.some(candidate => candidate.id === order.id))
                activeOrderIds.delete(order.id);
        }
        const removedBlankCount = blankOrders.length - lionDefenseBlanks.length;
        if (removedBlankCount > 0)
            this.addLog(game, 'reveal', `Пустые жетоны возвращены владельцам: ${removedBlankCount}.`);
        if (lionDefenseBlanks.length > 0)
            this.addLog(
                game,
                'reveal',
                `🦁 Защитный блеф Льва остаётся в бою с силой 2: ${lionDefenseBlanks.length}.`
            );

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
            const lionDefenseBlank = this.isLionDefenseBlank(room, order);
            if (!activeOrderIds.has(order.id) ||
                (!combatTypes.includes(order.token.type) && !lionDefenseBlank))
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
            const tokenStrength = lionDefenseBlank ? 2 : order.token.strength ?? 0;
            playerStrengths.set(
                order.playerId,
                (playerStrengths.get(order.playerId) ?? 0) + tokenStrength + blessingStrength
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
            const defenderClan = room.players.find(player => player.id === defenderId)?.clanId;
            const earnedDefenseStrength = earnedDefense * (defenderClan === 'crab' ? 3 : 1);
            const printedAndEarnedDefense = printedDefense + earnedDefenseStrength;
            const attackers = [...playerStrengths.entries()].filter(([playerId]) => playerId !== defenderId);

            if (attackers.length === 0) {
                const attackWasCancelled = attemptedAttackProvinceIds.has(provinceId);
                const defendedWithoutAttack = !!defenderId && playerStrengths.has(defenderId);
                if (defenderId && (attackWasCancelled || defendedWithoutAttack)) {
                    const reason = attackWasCancelled
                        ? 'атака сорвана до боя'
                        : 'защитный жетон без встречной атаки';
                    this.addLog(
                        game,
                        'battle',
                        attackWasCancelled
                            ? `⚔ Атака на «${PROVINCE_NAMES[provinceId]}» сорвана до боя. Победа засчитана защитнику.`
                            : `🛡 «${PROVINCE_NAMES[provinceId]}» не атаковали. Размещённый защитный жетон приносит победу защитнику.`,
                        provinceId,
                        defenderId
                    );
                    this.rewardDefense(room, provinceId, defenderId, reason);
                }
                continue;
            }

            const participantSummaries = [...playerStrengths.entries()].map(([playerId, tokenTotal]) => {
                const combatOrders = game.orders.filter(order =>
                    activeOrderIds.has(order.id) &&
                    order.playerId === playerId &&
                    (combatTypes.includes(order.token.type) || this.isLionDefenseBlank(room, order)) &&
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
                    const tokenStrength = this.isLionDefenseBlank(room, order)
                        ? 2
                        : order.token.strength ?? 0;
                    return `${TOKEN_TYPE_NAMES[order.token.type]} ${tokenStrength}` +
                        (blessing > 0 ? ` + благословение ${blessing}` : '');
                });
                const isDefender = playerId === defenderId;
                const defenseParts = isDefender
                    ? `${printedDefense > 0 ? ` + базовая защита ${printedDefense}` : ''}` +
                        `${earnedDefense > 0
                            ? ` + открытые жетоны контроля ${earnedDefenseStrength}` +
                                (defenderClan === 'crab' ? ` (${earnedDefense} × 3, Краб)` : '')
                            : ''}`
                    : '';
                const total = isDefender ? tokenTotal + printedAndEarnedDefense : tokenTotal;
                return `${this.playerName(room, playerId)}: ${tokenParts.join(' + ')}${defenseParts} = ${total}`;
            });
            if (defenderId && !playerStrengths.has(defenderId))
                participantSummaries.unshift(
                    `${this.playerName(room, defenderId)}: без боевого жетона` +
                    `${printedDefense > 0 ? ` + базовая защита ${printedDefense}` : ''}` +
                    `${earnedDefense > 0
                        ? ` + открытые жетоны контроля ${earnedDefenseStrength}` +
                            (defenderClan === 'crab' ? ` (${earnedDefense} × 3, Краб)` : '')
                        : ''}` +
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

            const craneAttacker = strongestAttackers.find(([playerId]) =>
                room.players.find(player => player.id === playerId)?.clanId === 'crane'
            );
            const winnerCandidate = strongestAttackers.length === 1
                ? strongestAttackers[0]
                : craneAttacker;

            if (!winnerCandidate) {
                const attackerNames = strongestAttackers
                    .map(([playerId]) => this.playerName(room, playerId))
                    .join(', ');
                if (defenderId) {
                    this.addLog(
                        game,
                        'battle',
                        `⚔ Битва за «${PROVINCE_NAMES[provinceId]}»: атакующие ${attackerNames} сравнялись, поэтому ${this.playerName(room, defenderId)} удерживает провинцию.`,
                        provinceId,
                        defenderId
                    );
                    this.rewardDefense(room, provinceId, defenderId, 'ничья атакующих');
                } else {
                    this.addLog(
                        game,
                        'battle',
                        `⚔ Битва за свободную провинцию «${PROVINCE_NAMES[provinceId]}»: ничья атакующих ${attackerNames} (${highestAttack}). Провинция остаётся без контроля.`,
                        provinceId
                    );
                }
                continue;
            }

            const [winnerId, winnerStrength] = winnerCandidate;
            const winnerClan = room.players.find(player => player.id === winnerId)?.clanId;
            const ignoresCapitalDefense = winnerClan === 'phoenix' &&
                Object.values(CLAN_CAPITALS).includes(provinceId) &&
                printedDefense > 0;
            const effectiveDefense = defenderTokenStrength + earnedDefenseStrength +
                (ignoresCapitalDefense ? 0 : printedDefense);
            const winsDefenseTie = winnerClan === 'crane' && defenderClan !== 'crane';

            if (winnerStrength < effectiveDefense ||
                (winnerStrength === effectiveDefense && !winsDefenseTie)) {
                this.addLog(
                    game,
                    'battle',
                    `⚔ Атака на «${PROVINCE_NAMES[provinceId]}» с силой ${winnerStrength} не преодолела защиту ${effectiveDefense}.`,
                    provinceId
                );
                if (defenderId)
                    this.rewardDefense(room, provinceId, defenderId, 'атака не преодолела защиту');
                continue;
            }

            const previousOwnerName = defenderId ? this.playerName(room, defenderId) : 'никто';
            game.provinces[provinceId] = winnerId;
            game.defenseBonuses[provinceId] = 0;
            const abilityNote = ignoresCapitalDefense
                ? ' Феникс игнорирует напечатанную защиту столицы.'
                : winsDefenseTie && winnerStrength === effectiveDefense
                    ? ' Журавль побеждает при равенстве сил.'
                    : strongestAttackers.length > 1 && winnerClan === 'crane'
                        ? ' Журавль побеждает в ничьей атакующих.'
                        : '';
            this.addLog(
                game,
                'control',
                `🏯 ${this.playerName(room, winnerId)} захватывает «${PROVINCE_NAMES[provinceId]}» с силой ${winnerStrength}. Прежний владелец: ${previousOwnerName}.${abilityNote}`,
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

    private isLionDefenseBlank(room: StoredRoom, order: StoredPlacedOrder): boolean {
        const game = this.requireGame(room);
        const player = room.players.find(candidate => candidate.id === order.playerId);
        return player?.clanId === 'lion' &&
            order.token.type === 'blank' &&
            order.target.kind === 'province' &&
            game.provinces[order.target.id] === order.playerId;
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
        if (playerGame.mustReturnToken)
            throw new RequestError(400, 'Сначала верните один непустой жетон в запас по способности Дракона');
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
        this.addLog(game, 'reveal', `Раунд ${game.round}: размещение завершено, приказы готовы к вскрытию.`);
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

        if (target.kind === 'land-border') {
            // A border may hold one attack in each direction.  Only a second
            // order aimed at the same province is a duplicate placement.
            if (hasLandOrderInDirection(game, target.id, target.provinceId))
                return false;
        }
        if (target.kind === 'sea-border' && hasSeaBorderOrder(game, target.id))
            return false;

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
        const add = (type: BattleTokenType, strengths: Array<number | null>, isClanToken = false) => {
            for (const strength of strengths)
                tokens.push({ id: crypto.randomUUID(), type, strength, isClanToken });
        };

        add('blank', [null]);
        add('army', [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5]);
        add('fleet', [1, 1, 2]);
        add('shinobi', [1, 2]);
        add('blessing', [1, 2]);
        add('diplomacy', [null]);
        add('raid', [null]);
        const uniqueToken = CLAN_RULES[clanId].uniqueToken;
        add(uniqueToken.type, [uniqueToken.strength], true);

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
        if (!game.cancelledAttackProvinceIds) {
            const activeAttackProvinceIds = new Set(this.activeAttackProvinceIds(game));
            game.cancelledAttackProvinceIds = game.attemptedAttackProvinceIds
                .filter(provinceId => !activeAttackProvinceIds.has(provinceId));
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
            if (playerGame.clanAbilityUsed === undefined) {
                playerGame.clanAbilityUsed = false;
                changed = true;
            }
            if (playerGame.mustReturnToken === undefined) {
                playerGame.mustReturnToken = false;
                changed = true;
            }

            const player = room.players.find(candidate => candidate.id === playerId);
            if (player?.clanId) {
                const playerOrders = game.orders
                    .filter(order => order.playerId === playerId)
                    .map(order => order.token);
                const allPlayerTokens = [
                    ...playerGame.hand,
                    ...playerGame.stock,
                    ...playerGame.discard,
                    ...playerOrders
                ];
                if (!allPlayerTokens.some(token => token.isClanToken)) {
                    const uniqueToken = CLAN_RULES[player.clanId].uniqueToken;
                    playerGame.stock.push({
                        id: crypto.randomUUID(),
                        type: uniqueToken.type,
                        strength: uniqueToken.strength,
                        isClanToken: true
                    });
                    changed = true;
                }
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
                this.addLog(game, 'reveal', `Раунд ${game.round}: размещение завершено, приказы готовы к вскрытию.`);
            }

            const objectiveDeck = shuffled(SECRET_OBJECTIVES.map(objective => objective.id));
            for (const [index, player] of room.players.entries()) {
                const options = objectiveDeck.slice(index * 2, index * 2 + 2);
                const playerGame = game.players[player.id];
                playerGame.secretObjectiveOptions = player.kind === 'bot' ? [] : options;
                playerGame.secretObjectiveId = player.kind === 'bot'
                    ? this.chooseBotSecretObjective(options, player.clanId!)
                    : null;
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
            this.addLog(game, 'reveal', `Раунд ${game.round}: размещение завершено, приказы готовы к вскрытию.`);
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
        return findPlayer(request, room);
    }

    private requirePlayer(request: Request, room: StoredRoom): StoredPlayer {
        return requirePlayer(request, room);
    }

    private requireHost(request: Request, room: StoredRoom): StoredPlayer {
        return requireHost(request, room);
    }

    private toPublicState(room: StoredRoom, viewer?: StoredPlayer): RoomState {
        const game = room.game;
        const pendingClanAction = game ? this.pendingClanAction(room) : undefined;
        let secretObjectiveAchieved = false;
        if (game && viewer) {
            const objectiveId = game.players[viewer.id]?.secretObjectiveId;
            if (objectiveId) {
                const provinceCounts = Object.fromEntries(room.players.map(player => [
                    player.id,
                    PROVINCE_IDS.filter(id => game.provinces[id] === player.id).length
                ]));
                const controlledProvinceIds = PROVINCE_IDS.filter(id => game.provinces[id] === viewer.id);
                const fewestProvinceCount = Math.min(...Object.values(provinceCounts));
                secretObjectiveAchieved = this.isSecretObjectiveAchieved(
                    objectiveId,
                    controlledProvinceIds,
                    provinceCounts[viewer.id] === fewestProvinceCount
                );
            }
        }
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
                        skipsPlacement: playerGame.skipsPlacement,
                        clanAbilityUsed: playerGame.clanAbilityUsed,
                        mustReturnToken: playerGame.mustReturnToken
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
                    viewer ? game.players[viewer.id]?.scoutedOrderIds ?? [] : [],
                    !!pendingClanAction
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
                secretObjectiveAchieved,
                clanActionPending: pendingClanAction?.type ?? null,
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
        const variants = new Map<string, Pick<StoredBattleToken, 'type' | 'strength' | 'isClanToken'>>();
        for (const token of allTokens) {
            const key = `${token.type}:${token.strength ?? 'null'}:${token.isClanToken ? 1 : 0}`;
            variants.set(key, {
                type: token.type,
                strength: token.strength,
                isClanToken: !!token.isClanToken
            });
        }

        return [...variants.values()]
            .sort((left, right) =>
                TOKEN_TYPES.indexOf(left.type) - TOKEN_TYPES.indexOf(right.type) ||
                (left.strength ?? -1) - (right.strength ?? -1) ||
                Number(left.isClanToken) - Number(right.isClanToken)
            )
            .map(variant => {
                const matches = (tokens: StoredBattleToken[]) => tokens.filter(token =>
                    token.type === variant.type &&
                    token.strength === variant.strength &&
                    !!token.isClanToken === !!variant.isClanToken
                ).length;
                return {
                    ...variant,
                    stock: matches(player.stock),
                    hand: matches(player.hand),
                    discard: matches(player.discard),
                    placed: matches(placed),
                    total: matches(allTokens)
                };
            });
    }

    private toPublicOrder(
        order: StoredPlacedOrder,
        phase: GamePhase,
        viewerId?: string,
        scoutedOrderIds: string[] = [],
        concealForUnicornSwap = false
    ): PlacedOrderView {
        const publiclyRevealed = !concealForUnicornSwap &&
            (phase === 'reveal' || phase === 'resolution' || phase === 'finished');
        const revealed = publiclyRevealed ||
            order.playerId === viewerId || order.token.type === 'blessing' || scoutedOrderIds.includes(order.id);
        return {
            id: order.id,
            playerId: order.playerId,
            target: order.target,
            type: revealed ? order.token.type : 'hidden',
            strength: revealed ? order.token.strength : null,
            revealed,
            isClanToken: revealed ? !!order.token.isClanToken : false
        };
    }

    private toSession(roomCode: string, player: StoredPlayer) {
        return toPlayerSession(roomCode, player);
    }

    private save(room: StoredRoom): Promise<void> {
        return this.state.storage.put('room', room);
    }
}
