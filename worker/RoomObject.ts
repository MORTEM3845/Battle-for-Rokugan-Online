import type { ClanId, RoomPlayer, RoomState } from '../shared/room';

interface Env {
    ROOMS: DurableObjectNamespace;
}

interface StoredPlayer extends RoomPlayer {
    token: string;
}

interface StoredRoom {
    code: string;
    status: 'lobby' | 'playing';
    maxPlayers: number;
    players: StoredPlayer[];
    createdAt: string;
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
});

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

            if (request.method === 'GET' && url.pathname === '/state')
                return json(this.toPublicState(room));

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
            maxPlayers: 2,
            players: [player],
            createdAt: new Date().toISOString()
        };

        await this.save(room);
        return json({ room: this.toPublicState(room), session: this.toSession(room.code, player) }, 201);
    }

    private async joinRoom(request: Request, room: StoredRoom): Promise<Response> {
        this.ensureLobby(room);
        if (room.players.length >= room.maxPlayers)
            throw new Error('В комнате уже два игрока');

        const body = await request.json<{ playerName: string }>();
        const player = this.createHuman(body.playerName, false);
        room.players.push(player);
        await this.save(room);
        return json({ room: this.toPublicState(room), session: this.toSession(room.code, player) }, 201);
    }

    private async selectClan(request: Request, room: StoredRoom): Promise<Response> {
        this.ensureLobby(room);
        const player = this.requirePlayer(request, room);
        const body = await request.json<{ clanId: ClanId }>();
        const validClans: ClanId[] = ['crab', 'crane', 'dragon', 'lion', 'phoenix', 'scorpion', 'unicorn'];

        if (!validClans.includes(body.clanId))
            throw new Error('Неизвестный клан');
        if (room.players.some(x => x.id !== player.id && x.clanId === body.clanId))
            throw new Error('Этот клан уже выбран');

        player.clanId = body.clanId;
        player.isReady = false;
        await this.save(room);
        return json(this.toPublicState(room));
    }

    private async setReady(request: Request, room: StoredRoom): Promise<Response> {
        this.ensureLobby(room);
        const player = this.requirePlayer(request, room);
        const body = await request.json<{ isReady: boolean }>();

        if (body.isReady && !player.clanId)
            throw new Error('Сначала выберите клан');

        player.isReady = body.isReady;
        await this.save(room);
        return json(this.toPublicState(room));
    }

    private async addBot(request: Request, room: StoredRoom): Promise<Response> {
        this.ensureLobby(room);
        this.requireHost(request, room);
        if (room.players.length >= room.maxPlayers)
            throw new Error('В комнате уже два игрока');

        const freeClans: ClanId[] = ['crab', 'crane', 'dragon', 'lion', 'phoenix', 'scorpion', 'unicorn']
            .filter(clan => !room.players.some(player => player.clanId === clan));
        const clanId = freeClans[Math.floor(Math.random() * freeClans.length)];
        room.players.push({
            id: crypto.randomUUID(),
            token: crypto.randomUUID(),
            name: 'Случайный бот',
            kind: 'bot',
            isHost: false,
            isReady: true,
            clanId
        });

        await this.save(room);
        return json(this.toPublicState(room), 201);
    }

    private async removeBot(request: Request, room: StoredRoom, botId: string): Promise<Response> {
        this.ensureLobby(room);
        this.requireHost(request, room);
        const bot = room.players.find(player => player.id === botId && player.kind === 'bot');
        if (!bot)
            throw new Error('Бот не найден');

        room.players = room.players.filter(player => player.id !== botId);
        await this.save(room);
        return json(this.toPublicState(room));
    }

    private async startGame(request: Request, room: StoredRoom): Promise<Response> {
        this.ensureLobby(room);
        this.requireHost(request, room);
        if (room.players.length !== 2)
            throw new Error('Для запуска нужны два игрока');
        if (room.players.some(player => !player.clanId))
            throw new Error('Все игроки должны выбрать клан');
        if (room.players.some(player => !player.isReady))
            throw new Error('Все игроки должны быть готовы');

        room.status = 'playing';
        await this.save(room);
        return json(this.toPublicState(room));
    }

    private requirePlayer(request: Request, room: StoredRoom): StoredPlayer {
        const token = request.headers.get('x-player-token');
        const player = room.players.find(item => item.token === token);
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

    private toPublicState(room: StoredRoom): RoomState {
        return {
            code: room.code,
            status: room.status,
            maxPlayers: room.maxPlayers,
            players: room.players.map(({ token, ...player }) => player),
            createdAt: room.createdAt
        };
    }

    private toSession(roomCode: string, player: StoredPlayer) {
        return { roomCode, playerId: player.id, playerToken: player.token };
    }

    private save(room: StoredRoom): Promise<void> {
        return this.state.storage.put('room', room);
    }
}
