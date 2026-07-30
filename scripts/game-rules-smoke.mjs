import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error'
});

try {
    const { RoomObject } = await vite.ssrLoadModule('/worker/RoomObject.ts');
    const map = await vite.ssrLoadModule('/shared/map.ts');
    const { SECRET_OBJECTIVES } = await vite.ssrLoadModule('/shared/objectives.ts');
    const northShadowlands = 'blackshadowlandsnorth_1_24';
    const southShadowlands = 'blackshadowlandssouth_1_30';
    const sharedBorder = map.LAND_BORDERS.find(border =>
        border.provinces.includes(northShadowlands) &&
        border.provinces.includes(southShadowlands)
    );
    const southSeaBorder = map.SEA_BORDERS.find(border =>
        border.provinceId === southShadowlands
    );

    assert.ok(sharedBorder, 'Не найдена общая граница Земель Теней');
    assert.ok(southSeaBorder, 'Не найдена морская граница Южных Земель Теней');

    const playerGame = () => ({
        hand: [],
        stock: [],
        discard: [],
        setupRemaining: 0,
        roundPlacedCount: 0,
        actionCards: { scout: 2, shugenja: 1 },
        scoutedOrderIds: [],
        secretObjectiveOptions: [],
        secretObjectiveId: null,
        isRonin: false,
        skipsPlacement: false
    });

    const createRaidFixture = includeFleet => {
        const provinces = Object.fromEntries(map.PROVINCE_IDS.map(id => [id, null]));
        provinces[northShadowlands] = 'defender';
        provinces[southShadowlands] = 'raider';

        const game = {
            stage: 'rounds',
            round: 1,
            phase: 'reveal',
            objectiveResumePhase: null,
            firstPlayerId: 'raider',
            turnPlayerId: null,
            firstPlayerBag: ['defender'],
            players: {
                raider: playerGame(),
                defender: playerGame()
            },
            provinces,
            defenseBonuses: Object.fromEntries(map.PROVINCE_IDS.map(id => [id, 0])),
            provinceSpecials: {},
            readyPlayerIds: [],
            attemptedAttackProvinceIds: [southShadowlands],
            log: [],
            results: null,
            orders: [
                {
                    id: 'raid',
                    playerId: 'raider',
                    token: { id: 'raid-token', type: 'raid', strength: null },
                    target: {
                        kind: 'province',
                        id: northShadowlands,
                        provinceId: northShadowlands
                    }
                },
                {
                    id: 'army',
                    playerId: 'defender',
                    token: { id: 'army-token', type: 'army', strength: 5 },
                    target: {
                        kind: 'land-border',
                        id: sharedBorder.id,
                        provinceId: southShadowlands
                    }
                },
                ...(includeFleet ? [{
                    id: 'fleet',
                    playerId: 'defender',
                    token: { id: 'fleet-token', type: 'fleet', strength: 2 },
                    target: {
                        kind: 'sea-border',
                        id: southSeaBorder.id,
                        provinceId: southShadowlands
                    }
                }] : [])
            ]
        };

        return {
            schemaVersion: 3,
            code: 'TEST01',
            status: 'playing',
            maxPlayers: 5,
            createdAt: new Date(0).toISOString(),
            players: [
                {
                    id: 'raider',
                    token: 'raider-token',
                    name: 'Поджигатель',
                    kind: 'human',
                    isHost: true,
                    isReady: true,
                    clanId: 'crab'
                },
                {
                    id: 'defender',
                    token: 'defender-token',
                    name: 'Защитник',
                    kind: 'bot',
                    isHost: false,
                    isReady: true,
                    clanId: 'scorpion'
                }
            ],
            game
        };
    };

    const roomObject = new RoomObject({ storage: {} }, {});
    const state = { storage: { put: async () => {} } };
    const requestRoomObject = new RoomObject(state, {});
    assert.equal(SECRET_OBJECTIVES.length, 12, 'Должно быть ровно 12 тайных целей');

    const connectedInThreeRegions = new Set([
        'redscorpion_3_14',
        'redscorpion_2_13',
        'yellowlion_2_07',
        'yellowlion_1_12',
        'yellowlion_3_08',
        'lightbluecrane_1_15'
    ]);
    const connectedInFourRegions = new Set([
        'purpleunicorn_2_09',
        'redscorpion_3_14',
        'redscorpion_2_13',
        'yellowlion_2_07',
        'yellowlion_1_12',
        'lightbluecrane_1_15'
    ]);
    assert.equal(roomObject.hasConnectedProvinceGroup(connectedInThreeRegions, 6, 3), true);
    assert.equal(roomObject.hasConnectedProvinceGroup(connectedInFourRegions, 6, 3), false);

    const withFleet = createRaidFixture(true);
    assert.equal(
        roomObject.isTargetValid(
            withFleet.game,
            'raider',
            { id: 'own-sea-fleet', type: 'fleet', strength: 1 },
            {
                kind: 'sea-border',
                id: southSeaBorder.id,
                provinceId: southShadowlands
            }
        ),
        false,
        'Флот нельзя ставить на морскую границу собственной провинции'
    );
    roomObject.resolveRound(withFleet);

    assert.equal(withFleet.game.provinces[northShadowlands], null);
    assert.equal(withFleet.game.provinceSpecials[northShadowlands], 'scorched');
    assert.equal(
        withFleet.game.provinces[southShadowlands],
        'defender',
        'Отдельный флот силой 2 должен захватить Южные Земли Теней через защиту 1'
    );

    const raidLog = withFleet.game.log.find(entry => entry.type === 'raid');
    const battleLog = withFleet.game.log.find(entry =>
        entry.type === 'battle' && entry.message.includes('Расчёт боя')
    );
    assert.ok(raidLog?.message.includes('армия 5'));
    assert.ok(!raidLog?.message.includes('флот 2'));
    assert.ok(battleLog?.message.includes('флот 2'));
    assert.ok(!battleLog?.message.includes('армия 5'));

    const withoutFleet = createRaidFixture(false);
    roomObject.resolveRound(withoutFleet);
    assert.equal(
        withoutFleet.game.provinces[southShadowlands],
        'raider',
        'После снятия общей армии погромом отдельного захвата быть не должно'
    );
    assert.equal(
        withoutFleet.game.defenseBonuses[southShadowlands],
        1,
        'Снятая соседним погромом атака считается победой защитника'
    );

    const scoreRoom = createRaidFixture(false);
    scoreRoom.game.phase = 'finished';
    scoreRoom.game.stage = 'finished';
    scoreRoom.game.orders = [];
    scoreRoom.game.provinces = Object.fromEntries(map.PROVINCE_IDS.map(id => [id, null]));
    scoreRoom.game.provinces[northShadowlands] = 'raider';
    scoreRoom.game.provinces[southShadowlands] = 'raider';
    const shadowlandsScore = roomObject.calculateResults(scoreRoom)
        .find(result => result.playerId === 'raider');
    assert.equal(shadowlandsScore.provinceHonor, 0);
    assert.equal(shadowlandsScore.controlHonor, 0);
    assert.equal(shadowlandsScore.regionHonor, 0);

    const roninRoom = createRaidFixture(false);
    roninRoom.game.phase = 'placement';
    roninRoom.game.orders = [];
    roninRoom.game.provinces = Object.fromEntries(map.PROVINCE_IDS.map(id => [id, null]));
    roninRoom.game.players.raider.isRonin = true;
    const roninBorder = map.LAND_BORDERS[0];
    const roninTarget = {
        kind: 'land-border',
        id: roninBorder.id,
        provinceId: roninBorder.provinces[0]
    };
    assert.equal(
        roomObject.isTargetValid(
            roninRoom.game,
            'raider',
            { id: 'ronin-army', type: 'army', strength: 1 },
            roninTarget
        ),
        true,
        'Ронин должен ставить армию на любую сухопутную границу'
    );
    assert.equal(
        roomObject.isTargetValid(
            roninRoom.game,
            'raider',
            { id: 'ronin-raid', type: 'raid', strength: null },
            { kind: 'province', id: roninBorder.provinces[0] }
        ),
        false,
        'Ронин не может ставить погром'
    );
    roninRoom.game.provinceSpecials[roninBorder.provinces[1]] = 'peace';
    assert.equal(
        roomObject.isTargetValid(
            roninRoom.game,
            'raider',
            { id: 'ronin-army-blocked', type: 'army', strength: 1 },
            roninTarget
        ),
        false,
        'Мирная или разорённая провинция должна блокировать всю общую границу'
    );
    roninRoom.game.provinceSpecials = {};

    roninRoom.game.players.raider.hand = [
        { id: 'raid-only', type: 'raid', strength: null },
        { id: 'diplomacy-only', type: 'diplomacy', strength: null }
    ];
    roninRoom.game.players.defender.hand = [{ id: 'last-token', type: 'army', strength: 1 }];
    roninRoom.game.turnPlayerId = 'raider';
    roomObject.advancePlacementTurn(roninRoom, 'raider', true);
    assert.equal(roninRoom.game.players.raider.skipsPlacement, true);
    assert.equal(roninRoom.game.players.raider.hand.length, 2, 'При пасе жетоны ронина не сбрасываются');
    assert.equal(roninRoom.game.phase, 'reveal');

    const shugenjaPlacementRoom = createRaidFixture(false);
    shugenjaPlacementRoom.game.phase = 'placement';
    shugenjaPlacementRoom.game.turnPlayerId = 'raider';
    shugenjaPlacementRoom.game.players.raider.isRonin = true;
    shugenjaPlacementRoom.game.players.raider.hand = [
        { id: 'blocked-army', type: 'army', strength: 1 },
        { id: 'ronin-diplomacy', type: 'diplomacy', strength: null }
    ];
    shugenjaPlacementRoom.game.provinceSpecials = Object.fromEntries(
        map.PROVINCE_IDS
            .filter(id => !roninBorder.provinces.includes(id))
            .map(id => [id, 'peace'])
    );
    shugenjaPlacementRoom.game.orders = [{
        id: 'border-blocker',
        playerId: 'defender',
        token: { id: 'border-blocker-token', type: 'army', strength: 1 },
        target: {
            kind: 'land-border',
            id: roninBorder.id,
            provinceId: roninBorder.provinces[0]
        }
    }];
    assert.equal(
        roomObject.hasAnyValidPlacement(shugenjaPlacementRoom.game, 'raider'),
        false
    );
    assert.equal(
        roomObject.hasAnyAvailablePlacementAction(shugenjaPlacementRoom.game, 'raider'),
        true,
        'Автопас не должен срабатывать, если сюгэндзя может освободить законную цель'
    );
    const passResponse = await requestRoomObject.passPlacement(
        new Request('https://room/game/pass', {
            method: 'POST',
            headers: { 'x-player-token': 'raider-token' }
        }),
        shugenjaPlacementRoom
    );
    assert.equal(passResponse.status, 200);
    assert.equal(shugenjaPlacementRoom.game.players.raider.skipsPlacement, true);
    assert.equal(shugenjaPlacementRoom.game.phase, 'reveal');

    const shugenjaRoom = createRaidFixture(false);
    shugenjaRoom.game.phase = 'placement';
    shugenjaRoom.game.turnPlayerId = 'raider';
    shugenjaRoom.game.orders = shugenjaRoom.game.orders.filter(order => order.id === 'army');
    const shugenjaResponse = await requestRoomObject.playShugenja(
        new Request('https://room/game/cards/shugenja', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-player-token': 'raider-token'
            },
            body: JSON.stringify({ orderId: 'army' })
        }),
        shugenjaRoom
    );
    assert.equal(shugenjaResponse.status, 200);
    assert.deepEqual(shugenjaRoom.game.attemptedAttackProvinceIds, [southShadowlands]);
    shugenjaRoom.game.phase = 'reveal';
    requestRoomObject.resolveRound(shugenjaRoom);
    assert.equal(
        shugenjaRoom.game.defenseBonuses[southShadowlands],
        1,
        'Снятая сюгэндзя единственная атака должна дать защитнику +1'
    );
    assert.ok(shugenjaRoom.game.log.some(entry =>
        entry.type === 'battle' && entry.message.includes('сорвана до боя')
    ));

    const staleAdvanceRoom = createRaidFixture(false);
    staleAdvanceRoom.game.phase = 'resolution';
    staleAdvanceRoom.game.orders = [];
    const staleResponse = await requestRoomObject.advanceGame(
        new Request('https://room/game/advance', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-player-token': 'raider-token'
            },
            body: JSON.stringify({ expectedPhase: 'reveal' })
        }),
        staleAdvanceRoom
    );
    assert.equal(staleResponse.status, 200);
    assert.equal(
        staleAdvanceRoom.game.phase,
        'resolution',
        'Устаревший host override не должен перескакивать в следующий раунд'
    );

    const blankRoom = createRaidFixture(false);
    blankRoom.game.orders = [{
        id: 'blank-order',
        playerId: 'raider',
        token: { id: 'blank-token', type: 'blank', strength: null },
        target: { kind: 'province', id: southShadowlands, provinceId: southShadowlands }
    }];
    blankRoom.game.attemptedAttackProvinceIds = [];
    roomObject.resolveRound(blankRoom);
    assert.ok(
        blankRoom.game.players.raider.hand.some(token => token.id === 'blank-token'),
        'Пустой жетон после исполнения должен вернуться в актив игрока'
    );
    assert.ok(!blankRoom.game.players.raider.stock.some(token => token.id === 'blank-token'));

    const futureRoom = createRaidFixture(false);
    futureRoom.schemaVersion = 999;
    let futureWrites = 0;
    const futureRoomObject = new RoomObject({
        storage: {
            get: async () => futureRoom,
            put: async () => { futureWrites++; }
        }
    }, {});
    const futureResponse = await futureRoomObject.fetch(new Request('https://room/state'));
    assert.equal(futureResponse.status, 503);
    assert.equal(futureWrites, 0, 'Будущую схему комнаты нельзя понижать или перезаписывать');

    console.log('game-rules smoke: ok');
} finally {
    await vite.close();
}
