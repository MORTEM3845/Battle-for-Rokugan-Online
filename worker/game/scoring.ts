import {
    PROVINCE_HONOR, PROVINCE_IDS, PROVINCE_NAMES, REGIONS, SHADOWLANDS_PROVINCES
} from '../../shared/map';
import { SECRET_OBJECTIVES_BY_ID, type SecretObjectiveId } from '../../shared/objectives';
import type { GameResultView } from '../../shared/room';
import { getSecretObjectiveProgress } from '../../shared/objectiveProgress';
import type { StoredRoom } from '../room/types';
export { hasConnectedProvinceGroup } from '../../shared/objectiveProgress';

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
    return getSecretObjectiveProgress(objectiveId, controlledProvinceIds, hasFewestProvinces).achieved;
}

function sumHonor(sources: Array<{ honor: number }>): number {
    return sources.reduce((sum, source) => sum + source.honor, 0);
}
