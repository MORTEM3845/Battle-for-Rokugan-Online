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
    const { CLAN_RULES } = await vite.ssrLoadModule('/shared/room.ts');
    const northShadowlands = 'blackshadowlandsnorth_province_1_29';
    const southShadowlands = 'blackshadowlandssouth_province_1_30';
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
        skipsPlacement: false,
        clanAbilityUsed: false,
        mustReturnToken: false
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
            cancelledAttackProvinceIds: [],
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
            schemaVersion: 5,
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
    for (const [clanId, rule] of Object.entries(CLAN_RULES)) {
        const tokenPool = roomObject.createTokenPool(clanId);
        assert.equal(tokenPool.length, 27, `У клана ${clanId} должно быть 27 жетонов`);
        const clanTokens = tokenPool.filter(token => token.isClanToken);
        assert.equal(clanTokens.length, 1, `У клана ${clanId} должен быть один клановый жетон`);
        assert.equal(clanTokens[0].type, rule.uniqueToken.type);
        assert.equal(clanTokens[0].strength, rule.uniqueToken.strength);
    }

    const connectedInThreeRegions = new Set([
        'redscorpion_province_1_15',
        'redscorpion_province_3_14',
        'yellowlion_province_2_12',
        'yellowlion_capital_2_10',
        'greendragon_province_3_03',
        'lightbluecrane_capital_2_16'
    ]);
    const connectedInFourRegions = new Set([
        'purpleunicorn_province_1_08',
        'redscorpion_province_1_15',
        'redscorpion_province_3_14',
        'yellowlion_province_2_12',
        'yellowlion_capital_2_10',
        'lightbluecrane_capital_2_16'
    ]);
    assert.equal(roomObject.hasConnectedProvinceGroup(connectedInThreeRegions, 6, 4), true);
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

    const lionDefense = createRaidFixture(false);
    lionDefense.players.find(player => player.id === 'defender').clanId = 'lion';
    lionDefense.game.attemptedAttackProvinceIds = [northShadowlands];
    lionDefense.game.orders = [
        {
            id: 'lion-blank',
            playerId: 'defender',
            token: { id: 'lion-blank-token', type: 'blank', strength: null },
            target: { kind: 'province', id: northShadowlands, provinceId: northShadowlands }
        },
        {
            id: 'lion-attacker',
            playerId: 'raider',
            token: { id: 'lion-attacker-token', type: 'army', strength: 2 },
            target: { kind: 'land-border', id: sharedBorder.id, provinceId: northShadowlands }
        }
    ];
    roomObject.resolveRound(lionDefense);
    assert.equal(lionDefense.game.provinces[northShadowlands], 'defender');
    assert.equal(lionDefense.game.defenseBonuses[northShadowlands], 1);
    assert.ok(
        lionDefense.game.players.defender.hand.some(token => token.id === 'lion-blank-token'),
        'Защитный блеф Льва должен иметь силу 2 и вернуться в актив'
    );

    const craneTie = createRaidFixture(false);
    craneTie.players.find(player => player.id === 'raider').clanId = 'crane';
    craneTie.game.attemptedAttackProvinceIds = [northShadowlands];
    craneTie.game.orders = [{
        id: 'crane-tie-army',
        playerId: 'raider',
        token: { id: 'crane-tie-token', type: 'army', strength: 1 },
        target: { kind: 'land-border', id: sharedBorder.id, provinceId: northShadowlands }
    }];
    roomObject.resolveRound(craneTie);
    assert.equal(
        craneTie.game.provinces[northShadowlands],
        'raider',
        'Журавль должен победить при равенстве атаки и защиты'
    );

    const dragonCapital = map.CLAN_CAPITALS.dragon;
    const dragonBorder = map.LAND_BORDERS.find(border => border.provinces.includes(dragonCapital));
    assert.ok(dragonBorder, 'Не найдена граница столицы Дракона');
    const phoenixSource = dragonBorder.provinces.find(id => id !== dragonCapital);
    const phoenixAttack = createRaidFixture(false);
    phoenixAttack.players.find(player => player.id === 'raider').clanId = 'phoenix';
    phoenixAttack.game.provinces = Object.fromEntries(map.PROVINCE_IDS.map(id => [id, null]));
    phoenixAttack.game.provinces[dragonCapital] = 'defender';
    phoenixAttack.game.provinces[phoenixSource] = 'raider';
    phoenixAttack.game.attemptedAttackProvinceIds = [dragonCapital];
    phoenixAttack.game.orders = [{
        id: 'phoenix-army',
        playerId: 'raider',
        token: { id: 'phoenix-army-token', type: 'army', strength: 1 },
        target: { kind: 'land-border', id: dragonBorder.id, provinceId: dragonCapital }
    }];
    roomObject.resolveRound(phoenixAttack);
    assert.equal(
        phoenixAttack.game.provinces[dragonCapital],
        'raider',
        'Феникс должен игнорировать напечатанные +2 защиты столицы'
    );

    const crabDefense = createRaidFixture(false);
    crabDefense.players.find(player => player.id === 'defender').clanId = 'crab';
    crabDefense.game.defenseBonuses[northShadowlands] = 2;
    crabDefense.game.attemptedAttackProvinceIds = [northShadowlands];
    crabDefense.game.orders = [{
        id: 'crab-attacker',
        playerId: 'raider',
        token: { id: 'crab-attacker-token', type: 'army', strength: 6 },
        target: { kind: 'land-border', id: sharedBorder.id, provinceId: northShadowlands }
    }];
    roomObject.resolveRound(crabDefense);
    assert.equal(
        crabDefense.game.provinces[northShadowlands],
        'defender',
        'Два открытых жетона Краба должны дать 6 защиты'
    );

    const idleDefense = createRaidFixture(false);
    idleDefense.game.attemptedAttackProvinceIds = [];
    idleDefense.game.orders = [{
        id: 'idle-defense',
        playerId: 'defender',
        token: { id: 'idle-defense-token', type: 'army', strength: 5 },
        target: { kind: 'province', id: northShadowlands, provinceId: northShadowlands }
    }];
    roomObject.resolveRound(idleDefense);
    assert.equal(
        idleDefense.game.defenseBonuses[northShadowlands],
        1,
        'Защитный жетон без встречной атаки должен принести победу защитника и открытый контроль'
    );

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
    const oppositeBorderTarget = {
        kind: 'land-border',
        id: roninBorder.id,
        provinceId: roninBorder.provinces[1]
    };
    assert.equal(
        roomObject.isTargetValid(
            shugenjaPlacementRoom.game,
            'raider',
            { id: 'counterattack-army', type: 'army', strength: 1 },
            oppositeBorderTarget
        ),
        true,
        'На общей сухопутной границе должна быть доступна атака в обратном направлении'
    );
    assert.equal(
        roomObject.isTargetValid(
            shugenjaPlacementRoom.game,
            'raider',
            { id: 'duplicate-attack-army', type: 'army', strength: 1 },
            {
                kind: 'land-border',
                id: roninBorder.id,
                provinceId: roninBorder.provinces[0]
            }
        ),
        false,
        'Повторная атака в том же направлении должна оставаться недоступной'
    );
    assert.equal(
        roomObject.hasAnyValidPlacement(shugenjaPlacementRoom.game, 'raider'),
        true,
        'Встречная атака через занятую границу должна считаться доступным размещением'
    );
    assert.equal(
        roomObject.hasAnyAvailablePlacementAction(shugenjaPlacementRoom.game, 'raider'),
        true,
        'Автопас не должен срабатывать, если сюгэндзя может освободить законную цель'
    );
    await assert.rejects(
        () => requestRoomObject.passPlacement(
            new Request('https://room/game/pass', {
                method: 'POST',
                headers: { 'x-player-token': 'raider-token' }
            }),
            shugenjaPlacementRoom
        ),
        /законное размещение жетона/
    );

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
    assert.deepEqual(shugenjaRoom.game.cancelledAttackProvinceIds, [southShadowlands]);
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

    const dragonReturnRoom = createRaidFixture(false);
    dragonReturnRoom.game.phase = 'placement';
    dragonReturnRoom.game.turnPlayerId = 'raider';
    dragonReturnRoom.players.find(player => player.id === 'raider').clanId = 'dragon';
    dragonReturnRoom.game.players.raider.mustReturnToken = true;
    dragonReturnRoom.game.players.raider.hand = [
        { id: 'dragon-blank', type: 'blank', strength: null },
        ...Array.from({ length: 6 }, (_, index) => ({
            id: `dragon-army-${index}`,
            type: 'army',
            strength: index + 1
        }))
    ];
    await assert.rejects(
        () => requestRoomObject.returnDragonToken(
            new Request('https://room/game/clan/dragon-return', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-player-token': 'raider-token'
                },
                body: JSON.stringify({ tokenId: 'dragon-blank' })
            }),
            dragonReturnRoom
        ),
        /Пустой жетон нельзя вернуть/
    );
    const acceptDragonReturn = await requestRoomObject.returnDragonToken(
        new Request('https://room/game/clan/dragon-return', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-player-token': 'raider-token'
            },
            body: JSON.stringify({ tokenId: 'dragon-army-0' })
        }),
        dragonReturnRoom
    );
    assert.equal(acceptDragonReturn.status, 200);
    assert.equal(dragonReturnRoom.game.players.raider.hand.length, 6);
    assert.equal(dragonReturnRoom.game.players.raider.mustReturnToken, false);

    const scorpionPeekRoom = createRaidFixture(false);
    scorpionPeekRoom.game.phase = 'placement';
    scorpionPeekRoom.game.turnPlayerId = 'defender';
    scorpionPeekRoom.players.find(player => player.id === 'raider').clanId = 'scorpion';
    scorpionPeekRoom.game.players.raider.roundPlacedCount = 1;
    scorpionPeekRoom.game.orders = [{
        id: 'scorpion-target',
        playerId: 'defender',
        token: { id: 'scorpion-target-token', type: 'army', strength: 4 },
        target: { kind: 'province', id: northShadowlands, provinceId: northShadowlands }
    }];
    const scorpionPeekResponse = await requestRoomObject.useScorpionPeek(
        new Request('https://room/game/clan/scorpion-peek', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-player-token': 'raider-token'
            },
            body: JSON.stringify({ orderId: 'scorpion-target' })
        }),
        scorpionPeekRoom
    );
    assert.equal(scorpionPeekResponse.status, 200);
    assert.equal(scorpionPeekRoom.game.players.raider.clanAbilityUsed, true);
    assert.ok(scorpionPeekRoom.game.players.raider.scoutedOrderIds.includes('scorpion-target'));
    const scorpionView = await scorpionPeekResponse.json();
    assert.equal(scorpionView.game.orders[0].type, 'army');

    const finalScorpionWindow = createRaidFixture(false);
    finalScorpionWindow.game.phase = 'reveal';
    finalScorpionWindow.players.find(player => player.id === 'raider').clanId = 'scorpion';
    finalScorpionWindow.game.players.raider.roundPlacedCount = 5;
    finalScorpionWindow.game.orders = [{
        id: 'final-scorpion-target',
        playerId: 'defender',
        token: { id: 'final-scorpion-target-token', type: 'army', strength: 4 },
        target: { kind: 'province', id: northShadowlands, provinceId: northShadowlands }
    }];
    const concealedScorpionView = requestRoomObject.toPublicState(
        finalScorpionWindow,
        finalScorpionWindow.players.find(player => player.id === 'raider')
    );
    assert.equal(
        concealedScorpionView.game.clanActionPending,
        'scorpion-peek',
        'После последнего размещения Скорпион должен получить окно способности до общего вскрытия'
    );
    assert.equal(concealedScorpionView.game.orders[0].type, 'hidden');
    const finalScorpionResponse = await requestRoomObject.useScorpionPeek(
        new Request('https://room/game/clan/scorpion-peek', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-player-token': 'raider-token'
            },
            body: JSON.stringify({ orderId: 'final-scorpion-target' })
        }),
        finalScorpionWindow
    );
    assert.equal(finalScorpionResponse.status, 200);
    const revealedAfterScorpion = await finalScorpionResponse.json();
    assert.equal(revealedAfterScorpion.game.clanActionPending, null);
    assert.equal(revealedAfterScorpion.game.orders[0].type, 'army');

    const skippedScorpionWindow = createRaidFixture(false);
    skippedScorpionWindow.game.phase = 'reveal';
    skippedScorpionWindow.players.find(player => player.id === 'raider').clanId = 'scorpion';
    skippedScorpionWindow.game.players.raider.roundPlacedCount = 5;
    skippedScorpionWindow.game.orders = [{
        id: 'skipped-scorpion-target',
        playerId: 'defender',
        token: { id: 'skipped-scorpion-target-token', type: 'army', strength: 2 },
        target: { kind: 'province', id: northShadowlands, provinceId: northShadowlands }
    }];
    const skippedScorpionResponse = await requestRoomObject.useScorpionPeek(
        new Request('https://room/game/clan/scorpion-peek', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-player-token': 'raider-token'
            },
            body: JSON.stringify({ orderId: null })
        }),
        skippedScorpionWindow
    );
    assert.equal(skippedScorpionResponse.status, 200);
    assert.equal(skippedScorpionWindow.game.players.raider.clanAbilityUsed, true);

    const unicornSwapRoom = createRaidFixture(false);
    unicornSwapRoom.game.phase = 'reveal';
    unicornSwapRoom.players.find(player => player.id === 'raider').clanId = 'unicorn';
    unicornSwapRoom.game.players.raider.clanAbilityUsed = false;
    unicornSwapRoom.game.readyPlayerIds = ['raider'];
    const cancelledBeforeUnicorn = map.PROVINCE_IDS.find(id =>
        id !== northShadowlands && id !== southShadowlands
    );
    unicornSwapRoom.game.provinces[cancelledBeforeUnicorn] = 'defender';
    unicornSwapRoom.game.attemptedAttackProvinceIds = [cancelledBeforeUnicorn, northShadowlands];
    unicornSwapRoom.game.cancelledAttackProvinceIds = [cancelledBeforeUnicorn];
    unicornSwapRoom.game.orders = [
        {
            id: 'unicorn-one',
            playerId: 'raider',
            token: { id: 'unicorn-one-token', type: 'shinobi', strength: 1 },
            target: { kind: 'province', id: northShadowlands, provinceId: northShadowlands }
        },
        {
            id: 'unicorn-two',
            playerId: 'raider',
            token: { id: 'unicorn-two-token', type: 'shinobi', strength: 2 },
            target: { kind: 'province', id: southShadowlands, provinceId: southShadowlands }
        }
    ];
    const unicornSwapResponse = await requestRoomObject.swapUnicornOrders(
        new Request('https://room/game/clan/unicorn-swap', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-player-token': 'raider-token'
            },
            body: JSON.stringify({ orderIds: ['unicorn-one', 'unicorn-two'] })
        }),
        unicornSwapRoom
    );
    assert.equal(unicornSwapResponse.status, 200);
    assert.equal(unicornSwapRoom.game.players.raider.clanAbilityUsed, true);
    assert.ok(!unicornSwapRoom.game.readyPlayerIds.includes('raider'));
    assert.equal(unicornSwapRoom.game.orders.find(order => order.id === 'unicorn-one').target.id, southShadowlands);
    assert.equal(unicornSwapRoom.game.orders.find(order => order.id === 'unicorn-two').target.id, northShadowlands);
    assert.ok(
        unicornSwapRoom.game.attemptedAttackProvinceIds.includes(cancelledBeforeUnicorn),
        'Манёвр Единорога не должен забывать снятую ранее атаку и лишать защитника победы'
    );

    const hostUnicornOverride = createRaidFixture(false);
    hostUnicornOverride.game.phase = 'reveal';
    hostUnicornOverride.players.find(player => player.id === 'raider').clanId = 'unicorn';
    hostUnicornOverride.game.players.raider.clanAbilityUsed = false;
    hostUnicornOverride.game.readyPlayerIds = ['raider', 'defender'];
    hostUnicornOverride.game.orders = [
        {
            id: 'host-unicorn-one',
            playerId: 'raider',
            token: { id: 'host-unicorn-one-token', type: 'shinobi', strength: 1 },
            target: { kind: 'province', id: northShadowlands, provinceId: northShadowlands }
        },
        {
            id: 'host-unicorn-two',
            playerId: 'raider',
            token: { id: 'host-unicorn-two-token', type: 'shinobi', strength: 2 },
            target: { kind: 'province', id: southShadowlands, provinceId: southShadowlands }
        }
    ];
    const hostUnicornResponse = await requestRoomObject.advanceGame(
        new Request('https://room/game/advance', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-player-token': 'raider-token'
            },
            body: JSON.stringify({ expectedPhase: 'reveal' })
        }),
        hostUnicornOverride
    );
    assert.equal(hostUnicornResponse.status, 200);
    assert.equal(hostUnicornOverride.game.phase, 'resolution');
    assert.equal(
        hostUnicornOverride.game.players.raider.clanAbilityUsed,
        true,
        'Хозяин комнаты должен уметь пропустить зависшую способность Единорога'
    );

    const legacyBotReveal = createRaidFixture(false);
    legacyBotReveal.schemaVersion = 3;
    legacyBotReveal.game.phase = 'reveal';
    legacyBotReveal.game.turnPlayerId = null;
    legacyBotReveal.players.find(player => player.id === 'defender').clanId = 'unicorn';
    legacyBotReveal.game.players.raider.secretObjectiveId = 'last_line';
    legacyBotReveal.game.players.defender.secretObjectiveId = 'great_northern_wall';
    delete legacyBotReveal.game.players.defender.clanAbilityUsed;
    delete legacyBotReveal.game.players.defender.mustReturnToken;
    delete legacyBotReveal.game.cancelledAttackProvinceIds;
    legacyBotReveal.game.orders = [
        {
            id: 'legacy-bot-unicorn-one',
            playerId: 'defender',
            token: { id: 'legacy-bot-unicorn-one-token', type: 'shinobi', strength: 1 },
            target: { kind: 'province', id: northShadowlands, provinceId: northShadowlands }
        },
        {
            id: 'legacy-bot-unicorn-two',
            playerId: 'defender',
            token: { id: 'legacy-bot-unicorn-two-token', type: 'shinobi', strength: 2 },
            target: { kind: 'province', id: southShadowlands, provinceId: southShadowlands }
        }
    ];
    let legacyBotWrites = 0;
    const legacyBotRoomObject = new RoomObject({
        storage: {
            get: async () => legacyBotReveal,
            put: async () => { legacyBotWrites++; }
        }
    }, {});
    const legacyBotResponse = await legacyBotRoomObject.fetch(new Request('https://room/state', {
        headers: { 'x-player-token': 'raider-token' }
    }));
    assert.equal(legacyBotResponse.status, 200);
    const legacyBotView = await legacyBotResponse.json();
    assert.equal(legacyBotView.game.clanActionPending, null);
    assert.equal(legacyBotReveal.game.players.defender.clanAbilityUsed, true);
    assert.ok(legacyBotWrites >= 1, 'Миграция и автоматическая способность бота должны сохраниться');

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
    assert.ok(blankRoom.game.resolution, 'Исполнение должно сохранить пошаговый сценарий раунда');
    assert.equal(blankRoom.game.resolution.currentIndex, 0);
    assert.deepEqual(
        blankRoom.game.resolution.steps.map(step => step.kind),
        ['reveal', 'reveal', 'summary'],
        'Сценарий должен начинаться со вскрытия и заканчиваться итогом'
    );
    await requestRoomObject.advanceGame(
        new Request('https://room/game/advance', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-player-token': 'raider-token'
            },
            body: JSON.stringify({ expectedPhase: 'resolution' })
        }),
        blankRoom
    );
    assert.equal(blankRoom.game.phase, 'resolution', 'Промежуточный клик не должен начинать новый раунд');
    assert.equal(blankRoom.game.resolution.currentIndex, 1, 'Ведущий должен продвигать общий сценарий на один шаг');

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
