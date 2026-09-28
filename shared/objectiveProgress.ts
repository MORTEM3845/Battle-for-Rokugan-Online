import {
    adjacentProvinceIds, CLAN_CAPITALS, COASTAL_PROVINCES, PROVINCE_NAMES,
    PROVINCE_REGIONS, REGIONS, SHADOWLANDS_PROVINCES
} from './map';
import type { SecretObjectiveId } from './objectives';
import type { ClanId } from './room';

export interface ObjectiveProgress {
    achieved: boolean;
    label: string;
    current: number;
    target: number;
    detail: string;
    secondary?: { label: string; current: number; target: number };
    items: Array<{ id: string; name: string; controlled: boolean; count?: number }>;
}

const CLAN_OBJECTIVES: Partial<Record<SecretObjectiveId, ClanId>> = {
    five_winds_court: 'unicorn', great_northern_wall: 'dragon', lair_of_secrets: 'scorpion',
    last_line: 'crab', fields_of_battle: 'lion', great_library: 'phoenix', rice_of_the_empire: 'crane'
};

export function getSecretObjectiveProgress(
    objectiveId: SecretObjectiveId, controlledProvinceIds: string[], hasFewestProvinces: boolean
): ObjectiveProgress {
    const controlled = new Set(controlledProvinceIds);
    const provinceItems = (ids: string[]) => ids.map(id => ({
        id, name: PROVINCE_NAMES[id], controlled: controlled.has(id)
    }));
    const clanId = CLAN_OBJECTIVES[objectiveId];
    if (clanId) {
        const capitalId = CLAN_CAPITALS[clanId];
        const region = REGIONS.find(region => region.id === PROVINCE_REGIONS[capitalId])!;
        const current = region.provinceIds.filter(id => controlled.has(id)).length;
        const capitalControlled = controlled.has(capitalId);
        return {
            achieved: capitalControlled || current >= 2,
            label: capitalControlled ? 'Столица под контролем' : 'Провинции региона',
            current: capitalControlled ? 1 : current, target: capitalControlled ? 1 : 2,
            detail: capitalControlled ? 'Столица под вашим контролем — условие выполнено.'
                : 'Достаточно столицы или любых двух провинций региона.',
            items: provinceItems(region.provinceIds)
        };
    }
    switch (objectiveId) {
        case 'web_of_influence': {
            const items = REGIONS.map(region => {
                const count = region.provinceIds.filter(id => controlled.has(id)).length;
                return { id: region.id, name: region.name.replace('Регион клана ', 'Клан '), controlled: count > 0, count };
            });
            const current = items.filter(item => item.controlled).length;
            return {
                achieved: current >= 7, label: 'Разные территории', current, target: 7, items,
                detail: 'Северные и Южные Земли Теней считаются отдельно. Несколько провинций одной территории дают один пункт.'
            };
        }
        case 'path_of_the_sail': {
            const items = provinceItems([...COASTAL_PROVINCES]);
            const current = items.filter(item => item.controlled).length;
            return { achieved: current >= 6, label: 'Прибрежные провинции', current, target: 6, items,
                detail: 'Учитываются только провинции с морской границей.' };
        }
        case 'reclaiming_lost_lands': {
            const items = provinceItems([...SHADOWLANDS_PROVINCES]);
            const current = items.filter(item => item.controlled).length;
            return { achieved: current === items.length, label: 'Земли Теней', current, target: items.length, items,
                detail: 'Нужен контроль и Северных, и Южных Земель Теней.' };
        }
        case 'path_of_humanity':
            return { achieved: hasFewestProvinces, label: 'Наименьшее число провинций',
                current: hasFewestProvinces ? 1 : 0, target: 1, items: [],
                detail: 'Равенство с другим игроком тоже выполняет условие.' };
        case 'emerald_of_the_empire': {
            const group = findConnectedProvinceGroup(controlled, 6, 3);
            const regionCount = new Set(group.map(id => PROVINCE_REGIONS[id])).size;
            return { achieved: group.length === 6 && regionCount === 3,
                label: 'Связанные провинции', current: group.length, target: 6,
                secondary: { label: 'Территории в группе', current: regionCount, target: 3 },
                detail: `В этой связанной группе: ${regionCount}/3 территории. Нужны ровно 6 провинций в 3 территориях.`,
                items: provinceItems(group) };
        }
        default:
            throw new Error(`Unknown secret objective: ${objectiveId}`);
    }
}

export function hasConnectedProvinceGroup(controlled: Set<string>, provinceCount: number, regionCount: number): boolean {
    const group = findConnectedProvinceGroup(controlled, provinceCount, regionCount);
    return group.length === provinceCount && new Set(group.map(id => PROVINCE_REGIONS[id])).size === regionCount;
}

// Search connected subsets, rather than counting an entire connected component:
// a larger component may span too many territories for the objective.
function findConnectedProvinceGroup(controlled: Set<string>, provinceCount: number, regionCount: number): string[] {
    const visited = new Set<string>();
    let best: string[] = [];
    let bestRegionCount = 0;
    const visit = (selected: Set<string>): boolean => {
        const key = [...selected].sort().join('|');
        if (visited.has(key)) return false;
        visited.add(key);
        const regions = new Set([...selected].map(id => PROVINCE_REGIONS[id]));
        if (regions.size > regionCount) return false;
        if (selected.size > best.length || (selected.size === best.length && regions.size > bestRegionCount)) {
            best = [...selected];
            bestRegionCount = regions.size;
        }
        if (selected.size === provinceCount) return regions.size === regionCount;
        const frontier = new Set([...selected].flatMap(id => adjacentProvinceIds(id))
            .filter(id => controlled.has(id) && !selected.has(id)));
        for (const id of frontier) {
            const next = new Set(selected);
            next.add(id);
            if (visit(next)) return true;
        }
        return false;
    };
    for (const id of controlled)
        if (visit(new Set([id]))) break;
    return best;
}
