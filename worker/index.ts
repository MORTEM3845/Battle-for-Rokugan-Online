import { RoomObject } from './RoomObject';

export { RoomObject };

interface Env {
    ROOMS: DurableObjectNamespace;
    ASSETS: Fetcher;
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

function normalizeCode(value: string): string {
    return value.trim().toUpperCase();
}

async function forward(request: Request, stub: DurableObjectStub, path: string): Promise<Response> {
    return stub.fetch(new Request(`https://room${path}`, request));
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
                    return response;
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

        const stub = getRoomStub(env, code);
        if (request.method === 'GET' && parts.length === 3)
            return forward(request, stub, '/state');
        if (request.method === 'POST' && parts[3] === 'join')
            return forward(request, stub, '/join');
        if (request.method === 'POST' && parts[3] === 'clan')
            return forward(request, stub, '/clan');
        if (request.method === 'POST' && parts[3] === 'ready')
            return forward(request, stub, '/ready');
        if (request.method === 'POST' && parts[3] === 'bots')
            return forward(request, stub, '/bots');
        if (request.method === 'DELETE' && parts[3] === 'bots' && parts[4])
            return forward(request, stub, `/bots/${encodeURIComponent(parts[4])}`);
        if (request.method === 'POST' && parts[3] === 'start')
            return forward(request, stub, '/start');
        if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'advance')
            return forward(request, stub, '/game/advance');
        if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'objective')
            return forward(request, stub, '/game/objective');
        if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'ready')
            return forward(request, stub, '/game/ready');
        if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'cards' && parts[5] === 'scout')
            return forward(request, stub, '/game/cards/scout');
        if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'cards' && parts[5] === 'shugenja')
            return forward(request, stub, '/game/cards/shugenja');
        if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'clan' && parts[5] === 'dragon-return')
            return forward(request, stub, '/game/clan/dragon-return');
        if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'clan' && parts[5] === 'scorpion-peek')
            return forward(request, stub, '/game/clan/scorpion-peek');
        if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'clan' && parts[5] === 'unicorn-swap')
            return forward(request, stub, '/game/clan/unicorn-swap');
        if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'orders')
            return forward(request, stub, '/game/orders');
        if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'pass')
            return forward(request, stub, '/game/pass');
        if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'control')
            return forward(request, stub, '/game/control');
        if (request.method === 'POST' && parts[3] === 'game' && parts[4] === 'bot-turn')
            return forward(request, stub, '/game/bot-turn');

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
