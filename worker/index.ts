import { ChatObject } from './ChatObject';
import { RoomObject } from './RoomObject';

export { ChatObject, RoomObject };

interface Env {
    ROOMS: DurableObjectNamespace;
    CHATS: DurableObjectNamespace;
    ASSETS: Fetcher;
}

interface RoomSessionPayload {
    room: {
        code: string;
        players: Array<{ id: string; name: string }>;
    };
    session: {
        playerId: string;
        playerToken: string;
    };
}

const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff'
    }
});

function createRoomCode(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return Array.from(bytes, value => ROOM_CODE_CHARS[value % ROOM_CODE_CHARS.length]).join('');
}

function getRoomStub(env: Env, code: string): DurableObjectStub {
    return env.ROOMS.get(env.ROOMS.idFromName(code));
}

function getChatStub(env: Env, code: string): DurableObjectStub {
    return env.CHATS.get(env.CHATS.idFromName(code));
}

function normalizeCode(value: string): string {
    return value.trim().toUpperCase();
}

async function forward(request: Request, stub: DurableObjectStub, path: string): Promise<Response> {
    return stub.fetch(new Request(`https://room${path}`, request));
}

async function registerChatSession(env: Env, response: Response): Promise<Response> {
    if (!response.ok)
        return response;

    try {
        const payload = await response.clone().json<RoomSessionPayload>();
        const player = payload.room.players.find(candidate => candidate.id === payload.session.playerId);
        if (!player)
            return response;

        const registration = await getChatStub(env, payload.room.code).fetch('https://chat/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                playerId: payload.session.playerId,
                playerName: player.name,
                playerToken: payload.session.playerToken
            })
        });
        if (!registration.ok)
            console.error('Chat session registration failed', registration.status, await registration.text());
    } catch (error) {
        console.error('Chat session registration failed', error);
    }

    return response;
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    if (url.pathname === '/api/health')
        return json({ status: 'ok' });

    if (request.method === 'POST' && url.pathname === '/api/rooms') {
        const body = await request.json<{ playerName: string }>();

        for (let attempt = 0; attempt < 5; attempt++) {
            const code = createRoomCode();
            const response = await getRoomStub(env, code).fetch('https://room/create', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ code, playerName: body.playerName })
            });
            if (response.status !== 409)
                return registerChatSession(env, response);
        }

        return json({ error: 'Не удалось создать уникальный код комнаты' }, 500);
    }

    if (parts[0] !== 'api')
        return env.ASSETS.fetch(request);

    if (parts[1] !== 'rooms' || !parts[2])
        return json({ error: 'Маршрут API не найден' }, 404);

    const code = normalizeCode(parts[2]);
    if (!/^[A-Z2-9]{6}$/.test(code))
        return json({ error: 'Некорректный код комнаты' }, 400);

    const roomStub = getRoomStub(env, code);
    if (parts[3] === 'chat' && (request.method === 'GET' || request.method === 'POST')) {
        const roomResponse = await roomStub.fetch(new Request('https://room/state', { headers: request.headers }));
        if (!roomResponse.ok)
            return roomResponse;
        return forward(request, getChatStub(env, code), '/messages');
    }

    if (request.method === 'GET' && parts.length === 3)
        return forward(request, roomStub, '/state');
    if (request.method === 'POST' && parts[3] === 'join')
        return registerChatSession(env, await forward(request, roomStub, '/join'));
    if (request.method === 'POST' && parts[3] === 'clan')
        return forward(request, roomStub, '/clan');
    if (request.method === 'POST' && parts[3] === 'ready')
        return forward(request, roomStub, '/ready');
    if (request.method === 'POST' && parts[3] === 'bots')
        return forward(request, roomStub, '/bots');
    if (request.method === 'DELETE' && parts[3] === 'bots' && parts[4])
        return forward(request, roomStub, `/bots/${encodeURIComponent(parts[4])}`);
    if (request.method === 'POST' && parts[3] === 'start')
        return forward(request, roomStub, '/start');
    if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'advance')
        return forward(request, roomStub, '/game/advance');
    if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'objective')
        return forward(request, roomStub, '/game/objective');
    if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'ready')
        return forward(request, roomStub, '/game/ready');
    if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'cards' && parts[5] === 'scout')
        return forward(request, roomStub, '/game/cards/scout');
    if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'cards' && parts[5] === 'shugenja')
        return forward(request, roomStub, '/game/cards/shugenja');
    if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'clan' && parts[5] === 'dragon-return')
        return forward(request, roomStub, '/game/clan/dragon-return');
    if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'clan' && parts[5] === 'scorpion-peek')
        return forward(request, roomStub, '/game/clan/scorpion-peek');
    if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'clan' && parts[5] === 'unicorn-swap')
        return forward(request, roomStub, '/game/clan/unicorn-swap');
    if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'orders')
        return forward(request, roomStub, '/game/orders');
    if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'pass')
        return forward(request, roomStub, '/game/pass');
    if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'control')
        return forward(request, roomStub, '/game/control');
    if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'bot-turn')
        return forward(request, roomStub, '/game/bot-turn');

    return json({ error: 'Маршрут API не найден' }, 404);
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        try {
            return await handleRequest(request, env);
        } catch (error) {
            if (error instanceof SyntaxError)
                return json({ error: 'Некорректное тело запроса' }, 400);

            console.error('Worker request failed', error);
            return json({ error: 'Внутренняя ошибка сервера' }, 500);
        }
    }
};
