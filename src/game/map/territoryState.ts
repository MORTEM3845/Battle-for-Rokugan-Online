import {
    PROVINCE_BASE_DEFENSE, PROVINCE_HONOR, PROVINCE_IDS, PROVINCE_NAMES,
    PROVINCE_REGIONS, REGIONS, SHADOWLANDS_PROVINCES
} from '../../../shared/map';
import { CLANS, type BattleTokenView, type GameViewState, type RoomPlayer } from '../../../shared/room';
import { CLAN_COLORS } from '../presentation';
import { provinceIsEligible } from './targeting';

export function buildTerritoryState({ game, playersById, currentPlayerId, hoveredPlayerId,
    selectedToken, orderPlacementDisabled, controlPlacementActive, actionProvinceId }: {
    game: GameViewState;
    playersById: Record<string, RoomPlayer>;
    currentPlayerId: string;
    hoveredPlayerId: string | null;
    selectedToken: BattleTokenView | null;
    orderPlacementDisabled: boolean;
    controlPlacementActive: boolean;
    actionProvinceId?: string;
}) {
    // Match the scoring rules: scorched land is excluded, and an empty region
    // or the Shadowlands cannot award a full-region bonus.
    const completedRegions = REGIONS.flatMap(region => {
        if (!region.awardsHonor)
            return [];
        const provinceIds = region.provinceIds.filter(id => game.provinceSpecials[id] !== 'scorched');
        const ownerId = game.provinces[provinceIds[0]];
        const owner = ownerId ? playersById[ownerId] : undefined;
        if (!owner || !provinceIds.length || !provinceIds.every(id => game.provinces[id] === ownerId))
            return [];
        return [{ ...region, provinceIds, owner, color: owner.clanId ? CLAN_COLORS[owner.clanId] : '#b6a184' }];
    });
    const completedById = new Map(completedRegions.map(region => [region.id, region]));
    const provinces = PROVINCE_IDS.map(id => {
        const ownerId = game.provinces[id];
        const owner = ownerId ? playersById[ownerId] : undefined;
        const clanName = owner?.clanId ? CLANS.find(clan => clan.id === owner.clanId)?.name : null;
        const region = REGIONS.find(region => region.id === PROVINCE_REGIONS[id])!;
        const completed = completedById.get(region.id);
        const available = region.provinceIds.filter(id => game.provinceSpecials[id] !== 'scorched');
        const controlled = ownerId ? available.filter(id => game.provinces[id] === ownerId).length : 0;
        const earnedDefense = game.defenseBonuses[id] ?? 0;
        const defenseStrength = earnedDefense * (owner?.clanId === 'crab' ? 3 : 1);
        const baseDefense = PROVINCE_BASE_DEFENSE[id] ?? 0;
        const honor = PROVINCE_HONOR[id] ?? 0;
        const special = game.provinceSpecials[id];
        const description = [
            PROVINCE_NAMES[id],
            SHADOWLANDS_PROVINCES.has(id) ? `⭐ ${honor} на поле (0 чести в конце игры)` : `⭐ ${honor}`,
            `🛡 ${baseDefense + defenseStrength} (база ${baseDefense}, открытые жетоны ${defenseStrength}` +
                `${owner?.clanId === 'crab' && earnedDefense > 0 ? ` = ${earnedDefense} × 3, Краб` : ''})`,
            owner ? `Принадлежит ${clanName ? `клану ${clanName} ` : ''}(${owner.name})` : 'Ничейная провинция',
            completed ? `${region.name}: полный контроль — ${completed.owner.name}, +5 чести`
                : `${region.name}${ownerId && region.awardsHonor ? `: ${controlled}/${available.length} провинций` : ''}`,
            ...(special ? [special === 'scorched' ? '🔥 Разорённая земля' : '☮ Мир'] : [])
        ].join(' · ');
        return {
            id, description, ownerId,
            color: owner ? (owner.clanId ? CLAN_COLORS[owner.clanId] : '#b6a184') : null,
            completed: !!completed && special !== 'scorched',
            highlighted: !!owner && ownerId === hoveredPlayerId,
            eligible: (controlPlacementActive && ownerId === null) ||
                (!orderPlacementDisabled && !!selectedToken && provinceIsEligible(selectedToken, id, game, currentPlayerId)),
            resolving: game.resolution?.currentStep.provinceId === id || actionProvinceId === id
        };
    });
    return { provinces, completedRegions };
}

export type TerritoryState = ReturnType<typeof buildTerritoryState>;
