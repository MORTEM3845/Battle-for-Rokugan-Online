import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const vite = await createServer({
    configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom', logLevel: 'error'
});
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const settle = () => new Promise(resolve => setImmediate(resolve));

try {
    const { buildTerritoryState } = await vite.ssrLoadModule('/src/game/map/territoryState.ts');
    const { PROVINCE_IDS, REGIONS } = await vite.ssrLoadModule('/shared/map.ts');
    const { getSecretObjectiveProgress } = await vite.ssrLoadModule('/shared/objectiveProgress.ts');
    const { SECRET_OBJECTIVES_BY_ID } = await vite.ssrLoadModule('/shared/objectives.ts');
    const { SecretObjectiveTab } = await vite.ssrLoadModule('/src/game/objectives/SecretObjectiveTab.tsx');
    {
        const north = REGIONS.find(region => region.id === 'blackshadowlandsnorth').provinceIds[0];
        const south = REGIONS.find(region => region.id === 'blackshadowlandssouth').provinceIds[0];
        const dragon = REGIONS.find(region => region.id === 'greendragon');
        const owned = [...dragon.provinceIds, north];
        const progress = () => getSecretObjectiveProgress('web_of_influence', owned, false);
        assert.equal(progress().current, 2, 'Multiple provinces in one territory count once');
        assert.equal(progress().items.find(item => item.id === dragon.id).count, 3);
        assert.equal(progress().items.find(item => item.id === 'blackshadowlandsnorth').controlled, true);
        assert.equal(progress().items.find(item => item.id === 'blackshadowlandssouth').controlled, false);
        owned.push(south);
        assert.equal(progress().current, 3, 'North and South Shadowlands count as separate territories');
        REGIONS.filter(region => ![dragon.id, 'blackshadowlandsnorth', 'blackshadowlandssouth'].includes(region.id))
            .slice(0, 4).forEach(region => owned.push(region.provinceIds[0]));
        assert.equal(progress().current, 7);
        assert.equal(progress().achieved, true);
        owned.pop();
        assert.equal(progress().current, 6);
        assert.equal(progress().achieved, false, 'Losing the last province removes territory credit');
        assert.equal(getSecretObjectiveProgress('reclaiming_lost_lands', [north], false).current, 1);
        assert.equal(getSecretObjectiveProgress('reclaiming_lost_lands', [north, south], false).achieved, true);
        assert.equal(getSecretObjectiveProgress('great_northern_wall', [dragon.provinceIds.find(id => id.includes('_capital_'))], false).achieved,
            true, 'A single capital satisfies the alternative requirement');
        assert.equal(getSecretObjectiveProgress('great_northern_wall', dragon.provinceIds.filter(id => !id.includes('_capital_')), false).achieved, true);
        assert.equal(getSecretObjectiveProgress('path_of_humanity', [], true).achieved, true, 'A tie for fewest provinces counts');
        const connected = ['redscorpion_province_1_15', 'redscorpion_province_3_14',
            'yellowlion_province_2_12', 'yellowlion_capital_2_10', 'greendragon_province_3_03', 'greendragon_capital_2_01'];
        assert.equal(getSecretObjectiveProgress('emerald_of_the_empire', connected, false).achieved, true);
        assert.equal(getSecretObjectiveProgress('emerald_of_the_empire', connected.slice(0, 5), false).current, 5);
        assert.equal(getSecretObjectiveProgress('emerald_of_the_empire', REGIONS.find(region => region.id === 'lavenderislands').provinceIds, false).achieved, false);
        const game = {
            phase: 'placement', secretObjective: SECRET_OBJECTIVES_BY_ID.web_of_influence, secretObjectiveAchieved: false,
            provinces: Object.fromEntries(PROVINCE_IDS.map(id => [id, owned.includes(id) ? 'me' : null])),
            players: [{ playerId: 'me' }, { playerId: 'other' }]
        };
        const render = () => renderToStaticMarkup(createElement(SecretObjectiveTab, { game, currentPlayerId: 'me' }));
        assert.ok(render().includes('6 / 7') && render().includes('Северные Земли Теней') && render().includes('Южные Земли Теней'));
        game.secretObjective = SECRET_OBJECTIVES_BY_ID.path_of_humanity;
        game.provinces = Object.fromEntries(PROVINCE_IDS.map(id => [id, null]));
        assert.ok(render().includes('0 / 0'), 'Minimum is calculated from the displayed map, including ties');
        game.secretObjective = null;
        assert.equal(render(), '', 'Spectators and players without an objective receive no objective card');
    }
    const { TerritoryLayer, RegionControlMarkers } = await vite.ssrLoadModule('/src/game/map/TerritoryLayer.tsx');
    {
        const region = REGIONS.find(region => region.id === 'greendragon');
        const playersById = {
            crane: { id: 'crane', name: 'Журавль', clanId: 'crane' },
            phoenix: { id: 'phoenix', name: 'Феникс', clanId: 'phoenix' }
        };
        const game = {
            provinces: Object.fromEntries(PROVINCE_IDS.map(id => [id, null])),
            provinceSpecials: {}, defenseBonuses: {}, players: [], resolution: null
        };
        const options = { game, playersById, currentPlayerId: 'crane', hoveredPlayerId: null,
            selectedToken: null, orderPlacementDisabled: false, controlPlacementActive: false };
        const state = () => buildTerritoryState(options);
        assert.equal(state().completedRegions.length, 0, 'Neutral regions are not controlled');
        region.provinceIds.forEach(id => { game.provinces[id] = 'crane'; });
        assert.equal(state().completedRegions[0].owner.id, 'crane');
        game.provinces[region.provinceIds[0]] = 'phoenix';
        assert.equal(state().completedRegions.length, 0, 'A contested region loses its bonus');
        game.provinces[region.provinceIds[0]] = null;
        assert.equal(state().completedRegions.length, 0, 'Neutral land interrupts full control');
        game.provinceSpecials[region.provinceIds[0]] = 'scorched';
        assert.deepEqual(state().completedRegions[0].provinceIds, region.provinceIds.slice(1),
            'Scorched land is excluded exactly as in scoring');
        region.provinceIds.forEach(id => { game.provinceSpecials[id] = 'scorched'; });
        assert.equal(state().completedRegions.length, 0, 'An entirely scorched region has no bonus');
        game.provinceSpecials = {};
        region.provinceIds.forEach(id => { game.provinces[id] = 'crane'; });
        REGIONS.filter(region => !region.awardsHonor).forEach(region => {
            region.provinceIds.forEach(id => { game.provinces[id] = 'crane'; });
        });
        assert.equal(state().completedRegions.length, 1, 'Shadowlands never display +5 honor');
        options.selectedToken = { type: 'shinobi' };
        options.hoveredPlayerId = 'crane';
        options.actionProvinceId = region.provinceIds[0];
        const province = state().provinces.find(province => province.id === region.provinceIds[0]);
        assert.ok(province.completed && province.highlighted && province.eligible && province.resolving,
            'Ownership, region control, targeting and resolution coexist');
        options.orderPlacementDisabled = true;
        assert.equal(state().provinces.find(candidate => candidate.id === province.id)?.eligible, false);
        const phoenixProvince = REGIONS.find(region => region.id === 'orangephoenix').provinceIds[0];
        game.provinces[phoenixProvince] = 'phoenix';
        const renderTerritories = hoveredPlayerId => {
            options.hoveredPlayerId = hoveredPlayerId;
            const territoryState = state();
            return renderToStaticMarkup(createElement(Fragment, null,
                createElement(TerritoryLayer, { state: territoryState, hoveredPlayerId }),
                createElement(RegionControlMarkers, { regions: territoryState.completedRegions, hoveredPlayerId })));
        };
        const restingMap = renderTerritories(null);
        assert.ok(!restingMap.includes('class="territory-owner '), 'No ownership overlay without player hover');
        assert.ok(!restingMap.includes('data-region-id='), 'No region outlines without player hover');
        assert.ok(!restingMap.includes('class="region-control-marker '), 'No +5 badges without player hover');
        const craneMap = renderTerritories('crane');
        assert.ok(craneMap.includes('data-region-id="greendragon"') && craneMap.includes('class="region-control-marker '),
            'Hover shows full regions and bonuses belonging to that player');
        assert.ok(!craneMap.includes('--territory-color:#de7338'), 'Other players have no ownership overlay');
        const phoenixMap = renderTerritories('phoenix');
        assert.equal([...phoenixMap.matchAll(/class="territory-owner /g)].length, 1,
            'Switching hover highlights only the new player');
        assert.ok(!phoenixMap.includes('data-region-id=') && !phoenixMap.includes('class="region-control-marker '),
            'Switching hover removes the previous player\'s region outlines and bonuses');
        assert.equal(renderTerritories(null), restingMap, 'Leaving the player panel restores the quiet map');
        options.hoveredPlayerId = null;
        game.provinces[region.provinceIds[0]] = null;
        const neutral = state().provinces.find(province => province.id === region.provinceIds[0]);
        assert.equal(neutral.color, null);
        assert.equal(neutral.highlighted, false);
        assert.equal(neutral.completed, false, 'Losing land removes the completed-region presentation');
    }
    const { RoomConnection } = await vite.ssrLoadModule('/src/room/RoomConnection.ts');
    function fixture(load) {
        const rooms = [], loadErrors = [], actionErrors = [], busy = [], timers = new Set();
        let delay = 2_000;
        const connection = new RoomConnection({
            load, onRoom: room => rooms.push(room), onLoadError: error => loadErrors.push(error),
            onActionError: error => actionErrors.push(error), onBusy: value => busy.push(value),
            pollDelay: () => delay,
            schedule: (task, milliseconds) => {
                const timer = { task, milliseconds };
                timers.add(timer);
                return () => timers.delete(timer);
            }
        });
        return { connection, rooms, loadErrors, actionErrors, busy, timers,
            hide: () => { delay = 15_000; },
            poll: () => {
                const timer = [...timers][0];
                assert.ok(timer, 'Polling should be scheduled');
                timers.delete(timer);
                timer.task();
            } };
    }

    // A poll started before a command must never roll the room back, in either response order.
    for (const pollFirst of [true, false]) {
        const oldPoll = deferred(), command = deferred();
        const f = fixture(() => oldPoll.promise);
        f.connection.start();
        const pending = f.connection.run(() => command.promise);
        if (pollFirst) {
            oldPoll.resolve({ code: 'OLD' });
            await settle();
            assert.deepEqual(f.rooms, []);
        }
        command.resolve({ code: 'NEW' });
        await pending;
        if (!pollFirst) {
            oldPoll.resolve({ code: 'OLD' });
            await settle();
        }
        assert.deepEqual(f.rooms, [{ code: 'NEW' }]);
        assert.deepEqual(f.busy, [true, false]);
        assert.equal(f.timers.size, 1);
        f.connection.stop();
        assert.equal(f.timers.size, 0);
    }

    // A second command is ignored while the first is in progress, even before React rerenders.
    {
        const command = deferred();
        const f = fixture(async () => ({ code: 'ROOM' }));
        f.connection.start();
        await settle();
        let calls = 0;
        const action = () => { calls++; return command.promise; };
        const pending = f.connection.run(action);
        await f.connection.run(action);
        assert.equal(calls, 1);
        command.resolve({ code: 'UPDATED' });
        await pending;
        await f.connection.run(async () => { calls++; return { code: 'NEXT' }; });
        assert.equal(calls, 2, 'Further actions must be possible after completion');
        f.connection.stop();
    }

    // Background success cannot erase a command failure; polling still recovers and adapts its delay.
    {
        let loads = 0;
        const f = fixture(async () => {
            if (++loads === 1) throw new Error('offline');
            return { code: 'ROOM' };
        });
        f.connection.start();
        f.connection.start();
        await settle();
        assert.equal(loads, 1);
        assert.equal(f.loadErrors.at(-1).message, 'offline');
        const failure = new Error('Clan is taken');
        await f.connection.run(async () => { throw failure; });
        f.hide();
        f.poll();
        await settle();
        assert.equal(f.loadErrors.at(-1), null);
        assert.equal(f.actionErrors.at(-1), failure);
        assert.deepEqual(f.busy, [true, false]);
        assert.equal([...f.timers][0].milliseconds, 15_000);
        f.connection.stop();
    }

    // Leaving a room suppresses every late callback and prevents new commands.
    for (const reject of [false, true]) {
        const poll = deferred(), command = deferred();
        const f = fixture(() => poll.promise);
        f.connection.start();
        const pending = f.connection.run(() => command.promise);
        f.connection.stop();
        const before = [f.rooms.length, f.loadErrors.length, f.actionErrors.length, f.busy.length];
        if (reject) {
            poll.reject(new Error('late poll'));
            command.reject(new Error('late command'));
        } else {
            poll.resolve({ code: 'OLD' });
            command.resolve({ code: 'OLD' });
        }
        await pending;
        await settle();
        assert.deepEqual([f.rooms.length, f.loadErrors.length, f.actionErrors.length, f.busy.length], before);
        assert.equal(f.timers.size, 0);
        await f.connection.run(() => { assert.fail('A closed room must not execute a command'); });
    }

    const originalStorage = globalThis.localStorage;
    try {
        const values = new Map();
        globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
        const { loadSession, saveSession } = await vite.ssrLoadModule('/src/room/sessionStorage.ts');
        const session = { roomCode: 'ABC234', playerId: 'player', playerToken: 'token' };
        saveSession(session);
        assert.deepEqual(loadSession('ABC234'), session);
        assert.equal(loadSession('XYZ234'), null);
        for (const invalid of ['{', 'null', '42', '[]', '{}',
            JSON.stringify({ ...session, roomCode: 'XYZ234' }),
            JSON.stringify({ ...session, playerId: 42 }), JSON.stringify({ ...session, playerToken: '' })]) {
            values.set('rokugan-session-ABC234', invalid);
            assert.equal(loadSession('ABC234'), null, `Invalid stored session: ${invalid}`);
        }
        globalThis.localStorage.getItem = () => { throw new Error('Storage blocked'); };
        assert.equal(loadSession('ABC234'), null);
    } finally {
        if (originalStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = originalStorage;
    }

    // Keep feature boundaries enforceable as the project grows. Type imports count too.
    const root = path.resolve('src');
    const features = new Set(['home', 'lobby', 'game', 'room']);
    for (const file of fs.readdirSync(root, { recursive: true }).filter(file => /\.tsx?$/.test(file))) {
        const absolute = path.join(root, file);
        const owner = file.split(path.sep)[0];
        const source = fs.readFileSync(absolute, 'utf8');
        const imports = /(?:^|\n)\s*(?:import\s+(?:type\s+)?(?:[^;]*?\s+from\s+)?|export\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+)['"]([^'"]+)['"]/g;
        for (const [, specifier] of source.matchAll(imports)) {
            if (specifier.startsWith('.')) {
                const target = path.relative(root, path.resolve(path.dirname(absolute), specifier));
                const [dependency, ...internal] = target.split(path.sep);
                if (features.has(dependency) && dependency !== owner) {
                    assert.ok(owner !== 'components', `${file}: shared UI must not depend on ${dependency}`);
                    if (features.has(owner))
                        assert.equal(dependency, 'room', `${file}: ${owner} must not depend on ${dependency}`);
                    assert.ok(internal.length === 0 || (internal.length === 1 && internal[0] === 'index'),
                        `${file}: import ${dependency} through its public index`);
                }
            }
        }
    }
    console.log('client module smoke: ok (territory states, region control, polling races, duplicate commands, cleanup, errors, storage, module boundaries)');
} finally {
    await vite.close();
}
