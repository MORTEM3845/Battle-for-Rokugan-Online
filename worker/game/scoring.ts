import {
    adjacentProvinceIds, CLAN_CAPITALS, COASTAL_PROVINCES, PROVINCE_HONOR, PROVINCE_IDS,
    PROVINCE_NAMES, PROVINCE_REGIONS, REGIONS, SHADOWLANDS_PROVINCES
} from '../../shared/map';
import { SECRET_OBJECTIVES_BY_ID, type SecretObjectiveId } from '../../shared/objectives';
import type { ClanId, GameResultView } from '../../shared/room';
import type { StoredRoom } from '../room/types';

export function calculateGameResults(room: StoredRoom): GameResultView[] {
    const game = room.game;
    if (room.status !== 'playing' || !game)
        throw new Error('Игра ещё не запущена');
    const provinceCounts = Object.fromEntries(room.players.map(player => [
        player.id, PROVINCE_IDS.filter(id => game.provinces[id] === player.id).length
    ]));
    const fewestProvinceCount = Math.min(...Object.values(provinceCounts));
    const results = room.players.map(player => {
        const controlledProvinceIds = PROVINCE_IDS.filter(id => game.provinces[id] === player.id);
        const controlledRegions = REGIONS.filter(region => region.awardsHonor).filter(region => {
            const available = region.provinceIds.filter(id => game.provinceSpecials[id] !== 'scorched');
            return available.length > 0 && available.every(id => game.provinces[id] === player.id);
        });
        const provinceHonorSources = controlledProvinceIds.filter(id => !SHADOWLANDS_PROVINCES.has(id))
            .map(id => ({ provinceId: id, name: PROVINCE_NAMES[id], honor: PROVINCE_HONOR[id] ?? 0 }))
            .filter(source => source.honor > 0);
        const controlHonorSources = controlledProvinceIds.filter(id => !SHADOWLANDS_PROVINCES.has(id))
            .map(id => ({ provinceId: id, name: PROVINCE_NAMES[id], honor: game.defenseBonuses[id] ?? 0 }))
            .filter(source => source.honor > 0);
        const regionHonorSources = controlledRegions.map(region => ({ name: region.name, honor: 5 }));
        const provinceHonor = sumHonor(provinceHonorSources);
        const controlHonor = sumHonor(controlHonorSources);
        const regionHonor = sumHonor(regionHonorSources);
        const secretObjectiveId = game.players[player.id].secretObjectiveId;
        const secretObjective = secretObjectiveId ? SECRET_OBJECTIVES_BY_ID[secretObjectiveId] : null;
        const secretObjectiveAchieved = secretObjectiveId
            ? isSecretObjectiveAchieved(secretObjectiveId, controlledProvinceIds, provinceCounts[player.id] === fewestProvinceCount)
            : false;
        const secretHonor = secretObjectiveAchieved ? secretObjective?.honor ?? 0 : 0;
        return {
            playerId: player.id, provinceHonor, controlHonor, regionHonor, secretHonor,
            totalHonor: provinceHonor + controlHonor + regionHonor + secretHonor,
            controlledRegions: controlledRegions.map(region => region.name), provinceCount: controlledProvinceIds.length,
            provinceHonorSources, controlHonorSources, regionHonorSources, secretObjective,
            secretObjectiveAchieved, rank: 0, isWinner: false
        };
    });
    const sorted = [...results].sort((left, right) =>
        right.totalHonor - left.totalHonor ||
        right.controlledRegions.length - left.controlledRegions.length ||
        right.provinceCount - left.provinceCount
    );
    let rank = 0;
    let previous: GameResultView | undefined;
    for (const [index, result] of sorted.entries()) {
        const tied = previous && result.totalHonor === previous.totalHonor &&
            result.controlledRegions.length === previous.controlledRegions.length &&
            result.provinceCount === previous.provinceCount;
        if (!tied)
            rank = index + 1;
        result.rank = rank;
        result.isWinner = rank === 1;
        previous = result;
    }
    return sorted;
}

export function isSecretObjectiveAchieved(
    objectiveId: SecretObjectiveId, controlledProvinceIds: string[], hasFewestProvinces: boolean
): boolean {
    const controlled = new Set(controlledProvinceIds);
    const controlsClanCapitalOrTwo = (clanId: ClanId, regionId: string) =>
        controlled.has(CLAN_CAPITALS[clanId]) || controlledProvinceIds.filter(id => PROVINCE_REGIONS[id] === regionId).length >= 2;
    switch (objectiveId) {
        case 'five_winds_court': return controlsClanCapitalOrTwo('unicorn', 'purpleunicorn');
        case 'great_northern_wall': return controlsClanCapitalOrTwo('dragon', 'greendragon');
        case 'lair_of_secrets': return controlsClanCapitalOrTwo('scorpion', 'redscorpion');
        case 'last_line': return controlsClanCapitalOrTwo('crab', 'graycrab');
        case 'fields_of_battle': return controlsClanCapitalOrTwo('lion', 'yellowlion');
        case 'great_library': return controlsClanCapitalOrTwo('phoenix', 'orangephoenix');
        case 'rice_of_the_empire': return controlsClanCapitalOrTwo('crane', 'lightbluecrane');
        case 'emerald_of_the_empire': return hasConnectedProvinceGroup(controlled, 6, 3);
        case 'path_of_the_sail': return controlledProvinceIds.filter(id => COASTAL_PROVINCES.has(id)).length >= 6;
        case 'reclaiming_lost_lands': return [...SHADOWLANDS_PROVINCES].every(id => controlled.has(id));
        case 'path_of_humanity': return hasFewestProvinces;
        case 'web_of_influence': return new Set(controlledProvinceIds.map(id => PROVINCE_REGIONS[id])).size >= 7;
    }
}

export function hasConnectedProvinceGroup(controlledProvinceIds: Set<string>, provinceCount: number, regionCount: number): boolean {
    const visitedGroups = new Set<string>();
    const canComplete = (selected: Set<string>): boolean => {
        const key = [...selected].sort().join('|');
        if (visitedGroups.has(key)) return false;
        visitedGroups.add(key);
        const selectedRegions = new Set([...selected].map(id => PROVINCE_REGIONS[id]));
        if (selectedRegions.size > regionCount) return false;
        if (selected.size === provinceCount) return selectedRegions.size === regionCount;
        const frontier = new Set([...selected].flatMap(id => adjacentProvinceIds(id))
            .filter(id => controlledProvinceIds.has(id) && !selected.has(id)));
        for (const provinceId of frontier) {
            const next = new Set(selected);
            next.add(provinceId);
            if (canComplete(next)) return true;
        }
        return false;
    };
    for (const provinceId of controlledProvinceIds)
        if (canComplete(new Set([provinceId]))) return true;
    return false;
}

function sumHonor(sources: Array<{ honor: number }>): number {
    return sources.reduce((sum, source) => sum + source.honor, 0);
}
