import {
    COASTAL_PROVINCES,
    LAND_BORDERS,
    PROVINCE_IDS,
    PROVINCE_NAMES,
    SEA_BORDERS
} from '../shared/map';
import type { BattleTokenType, ClanId, GameLogEntry, OrderTarget, ProvinceSpecial, RoomPlayer } from '../shared/room';
import { RoomObject as BaseRoomObject } from './RoomObject';

interface Env {
    ROOMS: DurableObjectNamespace;
}

interface StoredPlayer extends RoomPlayer {
    token: string;
}

interface StoredBattleToken {
    id: string;
    type: BattleTokenType;
    strength: number | null;
    isClanToken?: boolean;
}

interface StoredPlacedOrder {
    id: string;
    playerId: string;
    token: StoredBattleToken;
    target: OrderTarget;
    movedByUnicorn?: boolean;
}

interface StoredPlayerGame {
    hand: StoredBattleToken[];
    stock: StoredBattleToken[];
    discard: StoredBattleToken[];
    setupRemaining: number;
    roundPlacedCount: number;
    actionCards: Record<'scout' | 'shugenja', number>;
    scoutedOrderIds: string[];
    secretObjectiveOptions: string[];
    secretObjectiveId: string | null;
    isRonin: boolean;
    skipsPlacement: boolean;
    clanAbilityUsed: boolean;
    mustReturnToken: boolean;
}

interface StoredGame {
    stage: 'setup' | 'rounds' | 'finished';
    round: number;
    phase: string;
    turnPlayerId: string | null;
    players: Record<string, StoredPlayerGame>;
    provinces: Record<string, string | null>;
    provinceSpecials: Record<string, ProvinceSpecial>;
    readyPlayerIds: string[];
    orders: StoredPlacedOrder[];
    log: GameLogEntry[];
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

class PatchError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' }
});

export class RoomObject extends BaseRoomObject {
    private patchQueue: Promise<void> = Promise.resolve();

    constructor(private readonly patchedState: DurableObjectState, env: Env) {
        super(patchedState, env);
    }

    override fetch(request: Request): Promise<Response> {
        const queued = request.clone() as unknown as Request;
        const response = this.patchQueue.then(() => this.handlePatchedFetch(queued));
        this.patchQueue = response.then(() => undefined, () => undefined);
        return response;
    }

    private async handlePatchedFetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        try {
            if (request.method === 'DELETE' && url.pathname.startsWith('/players/'))
                return await this.kickPlayer(request, decodeURIComponent(url.pathname.slice('/players/'.length)));
            if (request.method === 'POST' && url.pathname === '/game/clan/unicorn-swap')
                return await this.swapUnicornOrders(request);

            if (await this.willResolveRound(request, url.pathname))
                await this.discardIllegalUnicornOrders();

            return await super.fetch(request);
        } catch (error) {
            if (error instanceof PatchError)
                return json({ error: error.message }, error.status);
            if (error instanceof SyntaxError)
                return json({ error: 'Некорректное тело запроса' }, 400);
            console.error('RoomObject patch failed', error);
            return json({ error: 'Внутренняя ошибка сервера' }, 500);
        }
    }

    private async kickPlayer(request: Request, playerId: string): Promise<Response> {
        const room = await this.requireRoom();
        if (room.status !== 'lobby')
            throw new PatchError(400, 'Игроков можно исключать только до начала партии');

        const host = this.requireHost(request, room);
        const target = room.players.find(player => player.id === playerId);
        if (!target)
            throw new PatchError(404, 'Игрок не найден');
        if (target.id === host.id || target.isHost)
            throw new PatchError(400, 'Хозяин комнаты не может исключить себя');

        room.players = room.players.filter(player => player.id !== playerId);
        await this.patchedState.storage.put('room', room);
        return super.fetch(new Request('https://room/state', { headers: request.headers }));
    }

    private async swapUnicornOrders(request: Request): Promise<Response> {
        const room = await this.requireRoom();
        const player = this.requirePlayer(request, room);
        const game = room.game;
        const playerGame = game?.players[player.id];
        if (!game || game.phase !== 'reveal' || player.clanId !== 'unicorn' || !playerGame || playerGame.clanAbilityUsed)
            throw new PatchError(400, 'Манёвр Единорога сейчас недоступен');

        const body = await request.json<{ orderIds?: string[] }>();
        const orderIds = body.orderIds ?? [];
        game.readyPlayerIds = game.readyPlayerIds.filter(id => id !== player.id);
        if (orderIds.length === 0) {
            playerGame.clanAbilityUsed = true;
            this.addLog(game, `🦄 ${player.name} оставляет свои приказы на местах.`, player.id);
        } else {
            if (orderIds.length !== 2 || orderIds[0] === orderIds[1])
                throw new PatchError(400, 'Выберите ровно два разных жетона');
            const orders = orderIds.map(id => game.orders.find(order => order.id === id));
            if (orders.some(order => !order || order.playerId !== player.id || order.target.kind === 'order'))
                throw new PatchError(400, 'Можно менять местами только два своих основных жетона');
            const [first, second] = orders as [StoredPlacedOrder, StoredPlacedOrder];
            if (this.hasBlessing(game, first.id) || this.hasBlessing(game, second.id))
                throw new PatchError(400, 'Жетон под благословением нельзя перемещать способностью клана');

            const firstPlace = this.targetName(first.target);
            const secondPlace = this.targetName(second.target);
            [first.target, second.target] = [second.target, first.target];
            first.movedByUnicorn = true;
            second.movedByUnicorn = true;
            playerGame.clanAbilityUsed = true;
            this.addLog(
                game,
                `🦄 ${player.name} меняет местами два приказа: «${firstPlace}» ↔ «${secondPlace}». ` +
                'Они остаются на поле; законность новых позиций проверится при исполнении.',
                player.id
            );
        }

        await this.patchedState.storage.put('room', room);
        return super.fetch(new Request('https://room/state', { headers: request.headers }));
    }

    private async willResolveRound(request: Request, path: string): Promise<boolean> {
        const room = await this.patchedState.storage.get<StoredRoom>('room');
        const game = room?.game;
        if (!room || !game || game.phase !== 'reveal')
            return false;

        if (request.method === 'POST' && path === '/game/advance') {
            const body = await request.clone().json<{ expectedPhase?: string }>();
            return body.expectedPhase === 'reveal';
        }
        if (request.method !== 'POST' || path !== '/game/ready')
            return false;

        const player = this.findPlayer(request, room);
        const body = await request.clone().json<{ isReady?: boolean }>();
        if (!player || body.isReady !== true)
            return false;
        const ready = new Set(game.readyPlayerIds);
        ready.add(player.id);
        return room.players.every(candidate => ready.has(candidate.id));
    }

    private async discardIllegalUnicornOrders(): Promise<void> {
        const room = await this.patchedState.storage.get<StoredRoom>('room');
        const game = room?.game;
        if (!room || !game)
            return;

        const moved = game.orders.filter(order => order.movedByUnicorn);
        if (moved.length === 0)
            return;

        const validationGame: StoredGame = { ...game, orders: game.orders.filter(order => !order.movedByUnicorn) };
        const illegal: Array<{ order: StoredPlacedOrder; reason: string }> = [];
        for (const order of moved) {
            const reason = this.invalidTargetReason(validationGame, order);
            if (reason)
                illegal.push({ order, reason });
            else
                validationGame.orders.push(order);
        }

        for (const order of moved)
            delete order.movedByUnicorn;
        if (illegal.length === 0) {
            await this.patchedState.storage.put('room', room);
            return;
        }

        const removedIds = new Set(illegal.map(item => item.order.id));
        const attachedBlessings = game.orders.filter(order => order.target.kind === 'order' && removedIds.has(order.target.id));
        for (const blessing of attachedBlessings)
            removedIds.add(blessing.id);
        game.orders = game.orders.filter(order => !removedIds.has(order.id));

        for (const { order, reason } of illegal) {
            const playerGame = game.players[order.playerId];
            if (order.token.type === 'blank')
                playerGame.hand.push(order.token);
            else
                playerGame.discard.push(order.token);
            this.addLog(
                game,
                `🦄 ${this.playerName(room, order.playerId)}: ${this.tokenName(order.token)} в позиции ` +
                `«${this.targetName(order.target)}» сброшен при исполнении — ${reason}.`,
                order.playerId
            );
        }
        for (const blessing of attachedBlessings)
            game.players[blessing.playerId].discard.push(blessing.token);

        await this.patchedState.storage.put('room', room);
    }

    private invalidTargetReason(game: StoredGame, order: StoredPlacedOrder): string | null {
        const { playerId, token, target } = order;
        if (target.kind === 'province' && game.provinceSpecials[target.id])
            return 'провинция недоступна из-за мира или выжженной земли';
        if (target.kind === 'land-border') {
            const border = LAND_BORDERS.find(item => item.id === target.id);
            if (!border || !target.provinceId || !border.provinces.includes(target.provinceId))
                return 'граница больше не соответствует цели атаки';
            if (game.orders.some(candidate => candidate.target.kind === 'land-border' && candidate.target.id === target.id))
                return 'на этой границе уже лежит другой приказ';
            const sourceId = border.provinces.find(id => id !== target.provinceId)!;
            if (token.type !== 'blank' && token.type !== 'army')
                return 'этот тип жетона нельзя ставить на сухопутную границу';
            if (!game.players[playerId]?.isRonin && game.provinces[sourceId] !== playerId)
                return 'у игрока нет подконтрольной провинции с этой стороны границы';
            if (game.provinces[target.provinceId] === playerId)
                return 'приказ направлен в собственную провинцию';
            return null;
        }
        if (target.kind === 'sea-border') {
            const sea = SEA_BORDERS.find(item => item.id === target.id);
            if (!sea || sea.provinceId !== target.provinceId)
                return 'морская граница больше не соответствует цели';
            if (game.orders.some(candidate => candidate.target.kind === 'sea-border' && candidate.target.id === target.id))
                return 'на этой морской границе уже лежит другой приказ';
            if (token.type !== 'blank' && token.type !== 'fleet')
                return 'этот тип жетона нельзя ставить на морскую границу';
            return game.provinces[sea.provinceId] === playerId ? 'флот направлен в собственную провинцию' : null;
        }
        if (target.kind !== 'province' || !PROVINCE_IDS.includes(target.id))
            return 'цель больше не существует';
        if (token.type === 'army')
            return game.provinces[target.id] === playerId ? null : 'армия не защищает подконтрольную провинцию';
        if (token.type === 'fleet')
            return game.provinces[target.id] === playerId && COASTAL_PROVINCES.has(target.id)
                ? null : 'флот можно защищать только свою прибрежную провинцию';
        if (token.type === 'diplomacy')
            return game.provinces[target.id] === playerId ? null : 'дипломатия находится не в своей провинции';
        if (token.type === 'raid')
            return game.provinces[target.id] !== playerId ? null : 'погром находится в собственной провинции';
        if (token.type === 'shinobi' || token.type === 'blank')
            return null;
        return 'этот жетон нельзя размещать в центре провинции';
    }

    private requireHost(request: Request, room: StoredRoom): StoredPlayer {
        const player = this.requirePlayer(request, room);
        if (!player.isHost)
            throw new PatchError(403, 'Это действие доступно только хозяину комнаты');
        return player;
    }

    private requirePlayer(request: Request, room: StoredRoom): StoredPlayer {
        const player = this.findPlayer(request, room);
        if (!player)
            throw new PatchError(401, 'Сессия игрока не найдена');
        return player;
    }

    private findPlayer(request: Request, room: StoredRoom): StoredPlayer | undefined {
        const token = request.headers.get('x-player-token');
        return room.players.find(player => player.token === token);
    }

    private async requireRoom(): Promise<StoredRoom> {
        const room = await this.patchedState.storage.get<StoredRoom>('room');
        if (!room)
            throw new PatchError(404, 'Комната не найдена');
        return room;
    }

    private hasBlessing(game: StoredGame, orderId: string): boolean {
        return game.orders.some(order => order.token.type === 'blessing' && order.target.kind === 'order' && order.target.id === orderId);
    }

    private addLog(game: StoredGame, message: string, playerId?: string): void {
        game.log.push({ id: crypto.randomUUID(), round: game.round, type: 'card', message, playerId });
    }

    private playerName(room: StoredRoom, playerId: string): string {
        return room.players.find(player => player.id === playerId)?.name ?? 'неизвестный игрок';
    }

    private tokenName(token: StoredBattleToken): string {
        const names: Record<BattleTokenType, string> = {
            army: 'армия', fleet: 'флот', shinobi: 'синоби', blessing: 'благословение',
            diplomacy: 'дипломатия', raid: 'погром', blank: 'пустой жетон'
        };
        return token.strength === null ? names[token.type] : `${names[token.type]} ${token.strength}`;
    }

    private targetName(target: OrderTarget): string {
        if (target.kind === 'province')
            return PROVINCE_NAMES[target.id] ?? target.id;
        if (target.kind === 'sea-border')
            return `морская граница → ${PROVINCE_NAMES[target.provinceId ?? ''] ?? target.provinceId ?? target.id}`;
        if (target.kind === 'land-border') {
            const border = LAND_BORDERS.find(item => item.id === target.id);
            const destination = target.provinceId;
            const source = border?.provinces.find(id => id !== destination);
            return `${source ? PROVINCE_NAMES[source] : 'граница'} → ${destination ? PROVINCE_NAMES[destination] : target.id}`;
        }
        return `жетон ${target.id}`;
    }
}