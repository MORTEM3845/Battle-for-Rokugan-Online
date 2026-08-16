import {
    PROVINCE_BASE_DEFENSE, PROVINCE_CENTERS, PROVINCE_HONOR, PROVINCE_IDS, PROVINCE_NAMES
} from '../../../shared/map';
import { CLANS, type GameViewState, type RoomPlayer } from '../../../shared/room';
import { CLAN_COLORS, CLAN_MON } from '../presentation';
import { markerStyle } from './geometry';

interface ProvinceMarkerProps {
    game: GameViewState;
    playersById: Record<string, RoomPlayer>;
}

export function ControlMarkers({ game, playersById, hoveredPlayerId }: ProvinceMarkerProps & { hoveredPlayerId: string | null }) {
    return <>{Object.entries(game.provinces).map(([provinceId, playerId]) => {
        if (!playerId)
            return null;
        const point = PROVINCE_CENTERS[provinceId];
        const player = playersById[playerId];
        if (!point || !player)
            return null;
        const color = player.clanId ? CLAN_COLORS[player.clanId] : '#8b7566';
        const clanName = player.clanId ? CLANS.find(clan => clan.id === player.clanId)?.name ?? player.clanId : 'без клана';
        return <span key={`control-${provinceId}`}
            className={`control-marker ${hoveredPlayerId === playerId ? 'is-highlighted' : ''}`}
            style={markerStyle(point.x, point.y, color)}
            title={`${PROVINCE_NAMES[provinceId]} · принадлежит клану ${clanName} (${player.name}) · ⭐ ${PROVINCE_HONOR[provinceId] ?? 0}`}>
            {player.clanId ? CLAN_MON[player.clanId] : '?'}
        </span>;
    })}</>;
}

export function DefenseMarkers({ game, playersById }: ProvinceMarkerProps) {
    return <>{PROVINCE_IDS.map(provinceId => {
        const ownerId = game.provinces[provinceId];
        const owner = ownerId ? playersById[ownerId] : undefined;
        const earnedMarkers = game.defenseBonuses[provinceId] ?? 0;
        const earnedDefense = earnedMarkers * (owner?.clanId === 'crab' ? 3 : 1);
        const bonus = (PROVINCE_BASE_DEFENSE[provinceId] ?? 0) + earnedDefense;
        const point = PROVINCE_CENTERS[provinceId];
        if (bonus <= 0 || !point)
            return null;
        return <span key={`defense-${provinceId}`} className="defense-marker"
            style={markerStyle(point.x + 25, point.y - 20)}
            title={`${PROVINCE_NAMES[provinceId]}: общая защита +${bonus}` +
                `${owner?.clanId === 'crab' && earnedMarkers > 0 ? ` (${earnedMarkers} открытых жетонов Краба × 3)` : ''}`}>
            🛡<b>+{bonus}</b>
        </span>;
    })}</>;
}

export function SpecialMarkers({ game }: Pick<ProvinceMarkerProps, 'game'>) {
    return <>{Object.entries(game.provinceSpecials).map(([provinceId, special]) => {
        const point = PROVINCE_CENTERS[provinceId];
        if (!point)
            return null;
        return <span key={`special-${provinceId}`} className={`special-marker special-${special}`}
            style={markerStyle(point.x, point.y)}
            title={`${PROVINCE_NAMES[provinceId]}: ${special === 'scorched' ? 'разорена' : 'мир'}`}>
            {special === 'scorched' ? '🔥' : '☮'}
        </span>;
    })}</>;
}
