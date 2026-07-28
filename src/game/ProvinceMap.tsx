import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { adjacentProvinceIds, COASTAL_PROVINCES, LAND_BORDERS, PROVINCE_CENTERS, SEA_BORDERS } from '../../shared/map';
import type {
    BattleTokenView,
    GameViewState,
    OrderTarget,
    RoomPlayer,
    VisibleTokenType
} from '../../shared/room';
import provinceSvg from '../assets/rokugan-provinces.svg?raw';
import { CLAN_COLORS, TOKEN_INFO } from './GameBoard';

interface ProvinceMapProps {
    game: GameViewState;
    players: RoomPlayer[];
    currentPlayerId: string;
    hoveredPlayerId: string | null;
    selectedToken: BattleTokenView | null;
    disabled: boolean;
    onTarget: (target: OrderTarget) => void;
}

function findProvince(target: EventTarget | null): SVGPathElement | null {
    return target instanceof Element ? target.closest<SVGPathElement>('path[data-province-id]') : null;
}

export function ProvinceMap(props: ProvinceMapProps) {
    const { game, players, currentPlayerId, hoveredPlayerId, selectedToken, disabled, onTarget } = props;
    const layerRef = useRef<HTMLDivElement>(null);
    const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
    const playersById = Object.fromEntries(players.map(player => [player.id, player]));

    useEffect(() => {
        const paths = layerRef.current?.querySelectorAll<SVGPathElement>('path[data-province-id]');
        paths?.forEach(path => {
            const id = path.dataset.provinceId!;
            const ownerId = game.provinces[id];
            const owner = ownerId ? playersById[ownerId] : undefined;
            path.classList.toggle('is-owned', !!owner);
            path.classList.toggle('is-player-highlight', !!ownerId && ownerId === hoveredPlayerId);
            path.classList.toggle('is-valid-target', !disabled && !!selectedToken &&
                provinceIsEligible(selectedToken, id, game, currentPlayerId));
            if (owner?.clanId)
                path.style.setProperty('--owner-color', CLAN_COLORS[owner.clanId]);
            else
                path.style.removeProperty('--owner-color');
        });
    }, [currentPlayerId, disabled, game, hoveredPlayerId, playersById, selectedToken]);

    function handleMapClick(event: MouseEvent<HTMLDivElement>) {
        const path = findProvince(event.target);
        if (!path || disabled || !selectedToken)
            return;
        const id = path.dataset.provinceId!;
        if (provinceIsEligible(selectedToken, id, game, currentPlayerId))
            onTarget({ kind: 'province', id });
    }

    const landTargets = selectedToken && ['army', 'blank'].includes(selectedToken.type);
    const seaTargets = selectedToken && ['fleet', 'blank'].includes(selectedToken.type);
    const orderTargets = selectedToken?.type === 'blessing';

    return <div className="province-map landscape-map">
        <div className="rotated-map">
            <img className="rokugan-map-image" src="/assets/rokugan-map.webp" alt="Карта Рокугана" draggable={false} />
            <div ref={layerRef} className="province-layer"
                onPointerMove={event => setHoveredProvince(findProvince(event.target)?.dataset.provinceName ?? null)}
                onPointerLeave={() => setHoveredProvince(null)}
                onClick={handleMapClick}
                dangerouslySetInnerHTML={{ __html: provinceSvg }} />

            <div className="map-markers">
                {Object.entries(game.provinces).map(([provinceId, playerId]) => {
                    if (!playerId)
                        return null;
                    const point = PROVINCE_CENTERS[provinceId];
                    const player = playersById[playerId];
                    if (!point || !player)
                        return null;
                    const style = markerStyle(point.x, point.y, player.clanId ? CLAN_COLORS[player.clanId] : '#8b7566');
                    return <span key={`control-${provinceId}`} className={`control-marker ${hoveredPlayerId === playerId ? 'is-highlighted' : ''}`}
                        style={style} title={`${player.name}: ${provinceId}`}>{player.clanId ? player.clanId.slice(0, 1).toUpperCase() : '?'}</span>;
                })}

                {LAND_BORDERS.map(border => {
                    const occupied = game.orders.some(order => order.target.kind === 'land-border' && order.target.id === border.id);
                    const eligible = !!landTargets && !occupied &&
                        (selectedToken?.type === 'blank' || border.provinces.filter(id => game.provinces[id] === currentPlayerId).length === 1);
                    return <TargetMarker key={border.id} kind="land-border" id={border.id} x={border.x} y={border.y}
                        symbol="•" eligible={eligible && !disabled} onTarget={onTarget} />;
                })}

                {SEA_BORDERS.map(border => {
                    const occupied = game.orders.some(order => order.target.kind === 'sea-border' && order.target.id === border.id);
                    return <TargetMarker key={border.id} kind="sea-border" id={border.id} x={border.x} y={border.y}
                        symbol="≈" eligible={!!seaTargets && !occupied && !disabled} onTarget={onTarget} />;
                })}

                {game.orders.map(order => {
                    const point = orderPoint(order.target, game);
                    if (!point)
                        return null;
                    const player = playersById[order.playerId];
                    const style = markerStyle(point.x, point.y, player?.clanId ? CLAN_COLORS[player.clanId] : '#8b7566');
                    const canBless = orderTargets && order.playerId === currentPlayerId &&
                        ['army', 'fleet', 'shinobi'].includes(order.type);
                    return <button key={order.id}
                        className={`placed-order ${hoveredPlayerId === order.playerId ? 'is-highlighted' : ''} ${canBless ? 'is-target' : ''}`}
                        style={style} disabled={!canBless || disabled}
                        onClick={() => onTarget({ kind: 'order', id: order.id })}
                        title={order.type === 'hidden' ? 'Скрытый приказ' : tokenLabel(order.type)}>
                        <span>{tokenSymbol(order.type)}</span>
                        {order.strength !== null && <b>{order.strength}</b>}
                    </button>;
                })}
            </div>
        </div>

        <div className={`province-label ${hoveredProvince ? 'visible' : ''}`}>
            <span>Провинция</span><strong>{hoveredProvince ?? ''}</strong>
        </div>
        {selectedToken && <div className="target-legend">
            <b>{TOKEN_INFO[selectedToken.type].label}</b><span>{TOKEN_INFO[selectedToken.type].hint}</span>
        </div>}
    </div>;
}

function TargetMarker(props: {
    kind: 'land-border' | 'sea-border';
    id: string;
    x: number;
    y: number;
    symbol: string;
    eligible: boolean;
    onTarget: (target: OrderTarget) => void;
}) {
    const { kind, id, x, y, symbol, eligible, onTarget } = props;
    return <button className={`border-target ${kind} ${eligible ? 'is-active' : ''}`}
        style={markerStyle(x, y)} disabled={!eligible} onClick={() => onTarget({ kind, id })} aria-label="Выбрать границу">
        {symbol}
    </button>;
}

function provinceIsEligible(token: BattleTokenView, provinceId: string, game: GameViewState, playerId: string): boolean {
    if (token.type === 'blank' || token.type === 'shinobi')
        return true;
    if (token.type === 'army' || token.type === 'diplomacy')
        return game.provinces[provinceId] === playerId;
    if (token.type === 'fleet')
        return game.provinces[provinceId] === playerId && COASTAL_PROVINCES.has(provinceId);
    if (token.type === 'raid') {
        if (game.provinces[provinceId] === playerId)
            return false;
        return adjacentProvinceIds(provinceId).some(id => game.provinces[id] === playerId) ||
            game.orders.some(order => order.playerId === playerId && order.type === 'shinobi' &&
                order.target.kind === 'province' && order.target.id === provinceId);
    }
    return false;
}

function orderPoint(target: OrderTarget, game: GameViewState): { x: number; y: number } | null {
    if (target.kind === 'province')
        return PROVINCE_CENTERS[target.id] ?? null;
    if (target.kind === 'land-border')
        return LAND_BORDERS.find(border => border.id === target.id) ?? null;
    if (target.kind === 'sea-border')
        return SEA_BORDERS.find(border => border.id === target.id) ?? null;
    const base = game.orders.find(order => order.id === target.id);
    return base ? orderPoint(base.target, game) : null;
}

function markerStyle(x: number, y: number, color?: string): CSSProperties {
    return {
        left: `${x / 1024 * 100}%`,
        top: `${y / 1536 * 100}%`,
        '--marker-color': color
    } as CSSProperties;
}

function tokenSymbol(type: VisibleTokenType): string {
    return type === 'hidden' ? '?' : TOKEN_INFO[type].symbol;
}

function tokenLabel(type: VisibleTokenType): string {
    return type === 'hidden' ? 'Скрытый приказ' : TOKEN_INFO[type].label;
}
