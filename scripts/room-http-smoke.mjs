import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
    configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom', logLevel: 'error'
});

// Durable Object storage returns persisted values, rather than a shared mutable fixture.
function memoryState() {
    const data = new Map();
    return { storage: {
        get: async key => structuredClone(data.get(key)),
        put: async (key, value) => { data.set(key, structuredClone(value)); }
    } };
}

try {
    const { ChatObject } = await vite.ssrLoadModule('/worker/ChatObject.ts');
    const { RoomObject } = await vite.ssrLoadModule('/worker/RoomObjectPatched.ts');
    const { default: worker } = await vite.ssrLoadModule('/worker/index.ts');
    const namespace = factory => {
        const objects = new Map();
        return {
            idFromName: code => code,
            get: code => {
                if (!objects.has(code)) objects.set(code, factory());
                const object = objects.get(code);
                return { fetch: (request, init) => object.fetch(
                    typeof request === 'string' ? new Request(request, init) : request
                ) };
            }
        };
    };
    const env = {
        ROOMS: namespace(() => new RoomObject(memoryState(), env)),
        CHATS: namespace(() => new ChatObject(memoryState()))
    };
    const request = (route, method = 'GET', body, session) => worker.fetch(new Request(`https://local${route}`, {
        method, headers: session ? { 'x-player-token': session.playerToken } : {},
        body: body === undefined ? undefined : JSON.stringify(body)
    }), env);
    async function expectJson(response, status) {
        assert.equal(response.status, status);
        const data = await response.json();
        if (status >= 400) assert.equal(typeof data.error, 'string');
        return data;
    }

    await expectJson(await request('/api/rooms', 'POST', { playerName: '' }), 400);
    const host = await expectJson(await request('/api/rooms', 'POST', { playerName: 'Host' }), 201);
    const route = `/api/rooms/${host.room.code}`;
    assert.equal(host.session.roomCode, host.room.code);
    assert.equal(host.room.players[0].id, host.session.playerId);
    assert.ok(!('token' in host.room.players[0]), 'Public room state must not contain player tokens');
    const guest = await expectJson(await request(`${route}/join`, 'POST', { playerName: 'Guest' }), 201);

    await expectJson(await request(`${route}/clan`, 'POST', { clanId: 'crab' }), 401);
    await expectJson(await request(`${route}/bots`, 'POST', undefined, guest.session), 403);
    await expectJson(await request(`${route}/clan`, 'POST', { clanId: 'unknown' }, host.session), 400);
    const selected = await expectJson(await request(`${route}/clan`, 'POST', { clanId: 'crab' }, host.session), 200);
    assert.equal(selected.players.find(player => player.id === host.session.playerId).clanId, 'crab');
    await expectJson(await request(`${route}/clan`, 'POST', { clanId: 'crab' }, guest.session), 400);
    await expectJson(await request(`${route}/clan`, 'POST', { clanId: 'dragon' }, guest.session), 200);

    const message = text => ({ playerId: guest.session.playerId, playerName: 'Guest', text });
    await expectJson(await request(`${route}/chat`, 'POST', message('Hello')), 401);
    await expectJson(await request(`${route}/chat`, 'POST', message('Hello'), {
        ...guest.session, playerToken: 'incorrect-token'
    }), 401);
    await expectJson(await request(`${route}/chat`, 'POST', message(''), guest.session), 400);
    const sent = await expectJson(await request(`${route}/chat`, 'POST', message('Hello'), guest.session), 201);
    assert.equal(sent.messages.at(-1).playerId, guest.session.playerId);
    assert.equal(sent.messages.at(-1).text, 'Hello');

    await expectJson(await request(`${route}/players/${guest.session.playerId}`, 'DELETE', undefined, guest.session), 403);
    await expectJson(await request(`${route}/players/${host.session.playerId}`, 'DELETE', undefined, host.session), 400);
    const kicked = await expectJson(await request(`${route}/players/${guest.session.playerId}`, 'DELETE', undefined, host.session), 200);
    assert.ok(!kicked.players.some(player => player.id === guest.session.playerId));
    await expectJson(await request(`${route}/chat`, 'POST', message('After removal'), guest.session), 401);
    await expectJson(await request(`${route}/ready`, 'POST', { isReady: true }, guest.session), 401);
    const publicRoom = await expectJson(await request(route), 200);
    assert.equal(publicRoom.code, host.room.code, 'Room preview must remain available before joining');
    const publicChat = await expectJson(await request(`${route}/chat`), 200);
    assert.equal(publicChat.messages.length, 1, 'Rejected chat sends must not write messages');

    // Both request queues still work after rejected actions and kicking a guest.
    await expectJson(await request(`${route}/bots`, 'POST', undefined, host.session), 201);
    await expectJson(await request(`${route}/ready`, 'POST', { isReady: true }, host.session), 200);
    const started = await expectJson(await request(`${route}/start`, 'POST', undefined, host.session), 200);
    assert.equal(started.status, 'playing');
    assert.equal(started.game.phase, 'objectives');
    const outsider = await expectJson(await request(route), 200);
    assert.deepEqual(outsider.game.hand, []);
    assert.deepEqual(outsider.game.secretObjectiveOptions, []);
    assert.equal(outsider.game.secretObjective, null);

    // Direct ChatObject coverage: asynchronous failures must resolve to HTTP responses.
    const chatState = memoryState();
    const chat = new ChatObject(chatState);
    const direct = (route, body, token) => chat.fetch(new Request(`https://chat${route}`, {
        method: 'POST', headers: token ? { 'x-player-token': token } : {}, body: JSON.stringify(body)
    }));
    await expectJson(await direct('/register', {}), 400);
    await expectJson(await direct('/messages', { playerId: 'sender', playerName: 'Sender', text: 'Hi' }), 401);
    await expectJson(await direct('/register', {
        playerId: 'sender', playerName: 'Sender', playerToken: 'test-token'
    }), 201);
    await expectJson(await direct('/messages', {
        playerId: 'sender', playerName: 'Sender', text: 'Hi'
    }, 'wrong-token'), 401);
    // A future timestamp makes the cooldown case deterministic even on a slow test machine.
    await chatState.storage.put('messages', [{
        id: 'recent', playerId: 'sender', playerName: 'Sender', text: 'Recent',
        createdAt: new Date(Date.now() + 60_000).toISOString()
    }]);
    await expectJson(await direct('/messages', {
        playerId: 'sender', playerName: 'Sender', text: 'Too soon'
    }, 'test-token'), 429);
    await chatState.storage.put('messages', []);
    await expectJson(await direct('/messages', {
        playerId: 'sender', playerName: 'Sender', text: 'Recovered'
    }, 'test-token'), 201);

    console.log('room HTTP smoke: ok (production RoomObjectPatched, auth, lobby, kick, chat errors, queue recovery, private state)');
} finally {
    await vite.close();
}
