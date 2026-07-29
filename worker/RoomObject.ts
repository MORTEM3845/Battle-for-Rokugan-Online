import { adjacentProvinceIds, COASTAL_PROVINCES, LAND_BORDERS, PROVINCE_IDS, SEA_BORDERS } from '../shared/map';
import type {
    BattleTokenType,
    BattleTokenView,
    ClanId,
    GamePhase,
    OrderTarget,
    PlacedOrderView,
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
}

interface StoredGame {
    stage: 'setup' | 'rounds' | 'finished';
    round: number;
    phase: GamePhase;
    firstPlayerId: string;
    turnPlayerId: string | null;
    firstPlayerBag: string[];
    players: Record<string, StoredPlayerGame>;
    provinces: Record<string, string | null>;
    orders: StoredPlacedOrder[];
}

interface StoredRoom {
    code: string;
    status: 'lobby' | 'playing';
    maxPlayers: number;
    players: StoredPlayer[];
    createdAt: string;
    game: StoredGame | null;
}

const ALL_CLANS: ClanId[] = ['crab', 'crane', 'dragon', 'lion', 'phoenix', 'scorpion', 'unicorn'];
const TOKEN_TYPES: BattleTokenType[] = ['army', 'fleet', 'shinobi', 'blessing', 'diplomacy', 'raid', 'blank'];
const SETUP_CONTROL_TOKENS: Record<number, number> = { 2: 11, 3: 7, 4: 5, 5: 4 };
const CAPITALS: Record<ClanId, string> = {
    crab: 'province-11',
    crane: 'province-20',
    dragon: 'province-02',
    lion: 'province-21',
    phoenix: 'province-04',
    scorpion: 'province-10',
    unicorn: 'province-18'
};

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
});

const randomItem = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export class RoomObject {
    constructor(private readonly state: DurableObjectState, private readonly env: Env) {}

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const room = await this.state.storage.get<StoredRoom>('room');

        try {
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
            if (request.method === 'POST' && url.pathname === '/game/orders')
                return this.placeOrder(request, room);
            if (request.method === 'POST' && url.pathname === '/game/control')
                return this.placeControl(request, room);
            if (request.method === 'POST' && url.pathname === '/game/bot-turn')
                return this.playBotTurn(request, room);

            return json({ error: 'Маршрут не найден' }, 404);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
            return json({ error: message }, 400);
        }
    }

    private async createRoom(request: Request, existing: StoredRoom | undefined): Promise<Response> {
        if (existing)
            return json({ error: 'Код комнаты уже занят' }, 409);

        const body = await request.json<{ code: string; playerName: string }>();
        const player = this.createHuman(body.playerName, true);
        const room: StoredRoom = {
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
            throw new Error('Комната заполнена');

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
            throw new Error('Неизвестный клан');
        if (room.players.some(item => item.id !== player.id && item.clanId === body.clanId))
            throw new Error('Этот клан уже выбран');

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
            throw new Error('Сначала выберите клан');

        player.isReady = body.isReady;
        await this.save(room);
        return json(this.toPublicState(room, player));
    }

    private async addBot(request: Request, room: StoredRoom): Promise<Response> {
        this.ensureLobby(room);
        const host = this.requireHost(request, room);
        if (room.players.length >= room.maxPlayers)
            throw new Error('Комната заполнена');

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
            throw new Error('Бот не найден');

        room.players = room.players.filter(player => player.id !== botId);
        await this.save(room);
        return json(this.toPublicState(room, host));
    }

    private async startGame(request: Request, room: StoredRoom): Promise<Response> {
        this.ensureLobby(room);
        const host = this.requireHost(request, room);
        if (room.players.length < 2 || room.players.length > room.maxPlayers)
            throw new Error('Для запуска нужны от 2 до 5 игроков');
        if (room.players.some(player => !player.clanId))
            throw new Error('Все игроки должны выбрать клан');
        if (room.players.some(player => !player.isReady))
            throw new Error('Все игроки должны быть готовы');

        const firstPlayerBag = room.players.map(player => player.id);
        const firstPlayerId = randomItem(firstPlayerBag);
        room.status = 'playing';
        room.game = {
            stage: 'setup',
            round: 0,
            phase: 'setup',
            firstPlayerId,
            turnPlayerId: null,
            firstPlayerBag: firstPlayerBag.filter(id => id !== firstPlayerId),
            players: Object.fromEntries(room.players.map(player => [player.id, {
                hand: [],
                stock: this.createTokenPool(player.clanId!),
                discard: [],
                setupRemaining: SETUP_CONTROL_TOKENS[room.players.length]
            }])),
            provinces: Object.fromEntries(PROVINCE_IDS.map(id => [id, null])),
            orders: []
        };

        for (const player of room.players)
            room.game.provinces[CAPITALS[player.clanId!]] = player.id;
        room.game.turnPlayerId = room.game.firstPlayerId;
        this.playAutomaticBotTurns(room);

        await this.save(room);
        return json(this.toPublicState(room, host));
    }

    private async advanceGame(request: Request, room: StoredRoom): Promise<Response> {
        const host = this.requireHost(request, room);
        const game = this.requireGame(room);

        if (game.phase === 'setup') {
            if (Object.values(game.players).some(player => player.setupRemaining > 0))
                throw new Error('Сначала разместите все начальные жетоны контроля');
            this.beginRound(room, false);
        } else if (game.phase === 'resolution') {
            this.cleanUpResolvedOrders(game);
            if (game.round >= 5) {
                game.stage = 'finished';
                game.phase = 'finished';
                game.turnPlayerId = null;
            } else {
                this.chooseNextFirstPlayer(room);
                this.beginRound(room, true);
            }
        } else {
            throw new Error('Сейчас нельзя перейти к следующей фазе');
        }

        this.playAutomaticBotTurns(room);
        await this.save(room);
        return json(this.toPublicState(room, host));
    }

    private async placeOrder(request: Request, room: StoredRoom): Promise<Response> {
        const player = this.requirePlayer(request, room);
        const game = this.requireGame(room);
        if (game.phase !== 'placement')
            throw new Error('Сейчас жетоны не размещаются');
        if (game.turnPlayerId !== player.id)
            throw new Error('Сейчас ход другого игрока');
        if (player.kind === 'bot')
            throw new Error('Ход бота выполняется автоматически');

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
            throw new Error('Начальная расстановка уже завершена');
        if (game.turnPlayerId !== player.id)
            throw new Error('Сейчас ход другого игрока');
        if (player.kind === 'bot')
            throw new Error('Ход бота выполняется автоматически');

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
            throw new Error('Сейчас ход не бота');

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
            const options = playerGame.hand.flatMap(token =>
                this.targetsForToken(game, bot.id, token).map(target => ({ token, target }))
            );
            if (options.length === 0) {
                const skippedToken = randomItem(playerGame.hand);
                playerGame.hand = playerGame.hand.filter(token => token.id !== skippedToken.id);
                if (skippedToken.type === 'blank')
                    playerGame.stock.push(skippedToken);
                else
                    playerGame.discard.push(skippedToken);
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
            throw new Error('Все ваши начальные жетоны уже размещены');
        if (!PROVINCE_IDS.includes(provinceId))
            throw new Error('Провинция не найдена');
        if (game.provinces[provinceId] !== null)
            throw new Error('В этой провинции уже есть жетон контроля');

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
        game.orders = [];

        for (const player of room.players)
            this.fillHand(game.players[player.id]);

        game.turnPlayerId = game.firstPlayerId;
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
                player.stock.push(order.token);
            else
                player.discard.push(order.token);
        }
        game.orders = [];
    }

    private commitOrder(room: StoredRoom, playerId: string, tokenId: string, target: OrderTarget): void {
        const game = this.requireGame(room);
        const playerGame = game.players[playerId];
        if (playerGame.hand.length <= 1)
            throw new Error('Последний жетон должен остаться за ширмой');

        const tokenIndex = playerGame.hand.findIndex(token => token.id === tokenId);
        if (tokenIndex < 0)
            throw new Error('Жетон не найден в вашей руке');

        const token = playerGame.hand[tokenIndex];
        if (!this.isTargetValid(game, playerId, token, target))
            throw new Error('Этот жетон нельзя поставить на выбранную цель');

        playerGame.hand.splice(tokenIndex, 1);
        game.orders.push({ id: crypto.randomUUID(), playerId, token, target });
    }

    private advancePlacementTurn(room: StoredRoom, afterPlayerId: string): void {
        const game = this.requireGame(room);
        if (Object.values(game.players).every(player => player.hand.length <= 1)) {
            game.phase = 'resolution';
            game.turnPlayerId = null;
            return;
        }

        const currentIndex = room.players.findIndex(player => player.id === afterPlayerId);
        for (let offset = 1; offset <= room.players.length; offset++) {
            const candidate = room.players[(currentIndex + offset) % room.players.length];
            if (game.players[candidate.id].hand.length > 1) {
                game.turnPlayerId = candidate.id;
                return;
            }
        }
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
                border.id === target.id && border.provinceId === target.provinceId
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
                border.id === target.id && border.provinceId === target.provinceId
            );
        }

        if (token.type === 'shinobi')
            return target.kind === 'province' && PROVINCE_IDS.includes(target.id);

        if (token.type === 'diplomacy')
            return target.kind === 'province' && game.provinces[target.id] === playerId;

        if (token.type === 'raid') {
            if (target.kind !== 'province' || game.provinces[target.id] === playerId)
                return false;
            const adjacentOwned = adjacentProvinceIds(target.id).some(id => game.provinces[id] === playerId);
            const ownShinobi = game.orders.some(order =>
                order.playerId === playerId && order.token.type === 'shinobi' &&
                order.target.kind === 'province' && order.target.id === target.id
            );
            return adjacentOwned || ownShinobi;
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

        const sourceProvinceId = border.provinces.find(id => id !== target.provinceId)!;
        return game.provinces[sourceProvinceId] === playerId && game.provinces[target.provinceId] !== playerId;
    }

    private createTokenPool(clanId: ClanId): StoredBattleToken[] {
        const tokens: StoredBattleToken[] = [];
        const add = (type: BattleTokenType, strengths: Array<number | null>, isClanSpecial = false) => {
            for (const strength of strengths)
                tokens.push({ id: crypto.randomUUID(), type, strength, isClanSpecial });
        };

        add('blank', [null]);
        add('army', [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3]);
        add('fleet', [1, 1, 2]);
        add('shinobi', [1, 1, 2]);
        add('blessing', [1, 2]);
        add('diplomacy', [null, null]);
        add('raid', [null, null, null]);

        const clanSpecial: Record<ClanId, [BattleTokenType, number | null]> = {
            crab: ['fleet', 3],
            crane: ['diplomacy', null],
            dragon: ['blessing', 3],
            lion: ['army', 6],
            phoenix: ['blessing', 3],
            scorpion: ['shinobi', 3],
            unicorn: ['raid', null]
        };
        add(clanSpecial[clanId][0], [clanSpecial[clanId][1]], true);
        return tokens;
    }

    private requireGame(room: StoredRoom): StoredGame {
        if (room.status !== 'playing' || !room.game)
            throw new Error('Игра ещё не запущена');
        return room.game;
    }

    private findPlayer(request: Request, room: StoredRoom): StoredPlayer | undefined {
        const token = request.headers.get('x-player-token');
        return room.players.find(player => player.token === token);
    }

    private requirePlayer(request: Request, room: StoredRoom): StoredPlayer {
        const player = this.findPlayer(request, room);
        if (!player)
            throw new Error('Сессия игрока не найдена');
        return player;
    }

    private requireHost(request: Request, room: StoredRoom): StoredPlayer {
        const player = this.requirePlayer(request, room);
        if (!player.isHost)
            throw new Error('Это действие доступно только хозяину комнаты');
        return player;
    }

    private ensureLobby(room: StoredRoom): void {
        if (room.status !== 'lobby')
            throw new Error('Игра уже запущена');
    }

    private createHuman(name: string, isHost: boolean): StoredPlayer {
        const normalizedName = name?.trim().slice(0, 24);
        if (!normalizedName)
            throw new Error('Введите имя игрока');

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
                        placedCount: game.orders.filter(order => order.playerId === player.id).length,
                        provinceCount: Object.values(game.provinces).filter(owner => owner === player.id).length,
                        setupRemaining: playerGame.setupRemaining
                    };
                }),
                provinces: game.provinces,
                orders: game.orders.map(order => this.toPublicOrder(order, game.phase, viewer?.id)),
                hand: viewer ? game.players[viewer.id]?.hand ?? [] : [],
                tokenPool: viewer ? this.toTokenPoolView(game, viewer.id) : []
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
                    commonTotal: totalTokens.filter(token => !token.isClanSpecial).length,
                    specialTotal: totalTokens.filter(token => token.isClanSpecial).length
                };
            });
        });
    }

    private toPublicOrder(order: StoredPlacedOrder, phase: GamePhase, viewerId?: string): PlacedOrderView {
        const revealed = phase === 'resolution' || phase === 'finished' ||
            order.playerId === viewerId || order.token.type === 'blessing';
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
