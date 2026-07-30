import type { ChatMessage, ChatState } from '../shared/chat';

interface ChatIdentity {
    tokenHash: string;
    playerName: string;
}

interface RegisterIdentityBody {
    playerId: string;
    playerName: string;
    playerToken: string;
}

interface SendMessageBody {
    playerId: string;
    playerName: string;
    text: string;
}

const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 500;
const MESSAGE_COOLDOWN_MS = 700;

class ChatError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
        this.name = 'ChatError';
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

export class ChatObject {
    private requestQueue: Promise<void> = Promise.resolve();

    constructor(private readonly state: DurableObjectState) {}

    fetch(request: Request): Promise<Response> {
        const queuedRequest = request.clone() as unknown as Request;
        const response = this.requestQueue.then(() => this.handleFetch(queuedRequest));
        this.requestQueue = response.then(() => undefined, () => undefined);
        return response;
    }

    private async handleFetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        try {
            if (request.method === 'POST' && url.pathname === '/register')
                return this.registerIdentity(request);
            if (request.method === 'GET' && url.pathname === '/messages')
                return json(await this.getState());
            if (request.method === 'POST' && url.pathname === '/messages')
                return this.sendMessage(request);

            return json({ error: 'Маршрут чата не найден' }, 404);
        } catch (error) {
            if (error instanceof ChatError)
                return json({ error: error.message }, error.status);
            if (error instanceof SyntaxError)
                return json({ error: 'Некорректное тело сообщения' }, 400);

            console.error('ChatObject request failed', error);
            return json({ error: 'Внутренняя ошибка чата' }, 500);
        }
    }

    private async registerIdentity(request: Request): Promise<Response> {
        const body = await request.json<RegisterIdentityBody>();
        const playerId = body.playerId?.trim().slice(0, 80);
        const playerName = body.playerName?.trim().slice(0, 24);
        if (!playerId || !playerName || !body.playerToken)
            throw new ChatError(400, 'Некорректная сессия чата');

        const identities = await this.state.storage.get<Record<string, ChatIdentity>>('identities') ?? {};
        identities[playerId] = { tokenHash: await this.hash(body.playerToken), playerName };
        await this.state.storage.put('identities', identities);
        return json({ status: 'registered' }, 201);
    }

    private async sendMessage(request: Request): Promise<Response> {
        const playerToken = request.headers.get('x-player-token');
        if (!playerToken)
            throw new ChatError(401, 'Сессия игрока не найдена');

        const body = await request.json<SendMessageBody>();
        const playerId = body.playerId?.trim().slice(0, 80);
        const playerName = body.playerName?.trim().slice(0, 24);
        const text = body.text?.trim().slice(0, MAX_MESSAGE_LENGTH);
        if (!playerId || !playerName)
            throw new ChatError(400, 'Не удалось определить отправителя');
        if (!text)
            throw new ChatError(400, 'Введите сообщение');

        const identities = await this.state.storage.get<Record<string, ChatIdentity>>('identities') ?? {};
        const identity = identities[playerId];
        if (!identity || identity.tokenHash !== await this.hash(playerToken))
            throw new ChatError(401, 'Сессия чата не зарегистрирована');
        if (identity.playerName !== playerName)
            throw new ChatError(400, 'Имя игрока не совпадает с сессией');

        const state = await this.getState();
        const previous = [...state.messages].reverse().find(message => message.playerId === playerId);
        if (previous && Date.now() - Date.parse(previous.createdAt) < MESSAGE_COOLDOWN_MS)
            throw new ChatError(429, 'Сообщения отправляются слишком часто');

        state.messages.push({
            id: crypto.randomUUID(),
            playerId,
            playerName: identity.playerName,
            text,
            createdAt: new Date().toISOString()
        });
        state.messages = state.messages.slice(-MAX_MESSAGES);

        await this.state.storage.put('messages', state.messages);
        return json(state, 201);
    }

    private async getState(): Promise<ChatState> {
        return { messages: await this.state.storage.get<ChatMessage[]>('messages') ?? [] };
    }

    private async hash(value: string): Promise<string> {
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
        return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    }
}
