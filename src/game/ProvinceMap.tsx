import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import {
    adjacentProvinceIds,
    COASTAL_PROVINCES,
    LAND_BORDERS,
    PROVINCE_CENTERS,
    PROVINCE_NAMES,
    SEA_BORDERS,
    type MapPoint
} from '../../shared/map';
import type {
    BattleTokenView,
    GameViewState,
    OrderTarget,
    PlacedOrderView,
    RoomPlayer,
    VisibleTokenType
} from '../../shared/room';
import provinceSvg from '../assets/rokugan-provinces.svg?raw';
import { CLAN_COLORS, CLAN_MON, TOKEN_INFO } from './GameBoard';

interface ProvinceMapProps {
    game: GameViewState;
    players: RoomPlayer[];
    currentPlayerId: string;
    hoveredPlayerId: string | null;
    selectedToken: BattleTokenView | null;
    orderPlacementDisabled: boolean;
    controlPlacementActive: boolean;
    onTarget: (target: OrderTarget) => void;
    onPlaceControl: (provinceId: string) => void;
}

function findProvince(target: EventTarget | null): SVGPathElement | null {
    return target instanceof Element ? target.closest<SVGPathElement>('path[data-province-id]') : null;
}

export function ProvinceMap(props: ProvinceMapProps) {
    const {
        game,
        players,
        currentPlayerId,
        hoveredPlayerId,
        selectedToken,
        orderPlacementDisabled,
        controlPlacementActive,
        onTarget,
        onPlaceControl
    } = props;
    const layerRef = useRef<HTMLDivElement>(null);
    const [hoveredProvinceId, setHoveredProvinceId] = useState<string | null>(null);
    const playersById = useMemo(() => Object.fromEntries(players.map(player => [player.id, player])), [players]);

    useEffect(() => {
        const paths = layerRef.current?.querySelectorAll<SVGPathElement>('path[data-province-id]');
        paths?.forEach(path => {
            const id = path.dataset.provinceId!;
            const ownerId = game.provinces[id];
            const owner = ownerId ? playersById[ownerId] : undefined;
            const validOrderTarget = !!selectedToken && provinceIsEligible(selectedToken, id, game, currentPlayerId);
            const validControlTarget = controlPlacementActive && game.provinces[id] === null;

            path.dataset.provinceName = PROVINCE_NAMES[id];
            path.setAttribute('aria-label', PROVINCE_NAMES[id]);
            const title = path.querySelector('title');
            if (title)
                title.textContent = PROVINCE_NAMES[id];

            path.classList.toggle('is-owned', !!owner);
            path.classList.toggle('is-player-highlight', !!ownerId && ownerId === hoveredPlayerId);
            path.classList.toggle('is-valid-target', validControlTarget || (!orderPlacementDisabled && validOrderTarget));
            if (owner?.clanId)
                path.style.setProperty('--owner-color', CLAN_COLORS[owner.clanId]);
            else
                path.style.removeProperty('--owner-color');
        });
    }, [controlPlacementActive, currentPlayerId, game, hoveredPlayerId, orderPlacementDisabled, playersById, selectedToken]);

    function handleMapClick(event: MouseEvent<HTMLDivElement>) {
        const path = findProvince(event.target);
        if (!path)
            return;

        const id = path.dataset.provinceId!;
        if (controlPlacementActive && game.provinces[id] === null) {
            onPlaceControl(id);
            return;
        }

        if (!orderPlacementDisabled && selectedToken && provinceIsEligible(selectedToken, id, game, currentPlayerId))
            onTarget({ kind: 'province', id, provinceId: id });
    }

    const landTargets = selectedToken && ['army', 'blank'].includes(selectedToken.type);
    const seaTargets = selectedToken && ['fleet', 'blank'].includes(selectedToken.type);
    const orderTargets = selectedToken?.type === 'blessing';

    return <div className="province-map landscape-map">
        <div className="rotated-map">
            <img className="rokugan-map-image" src="/assets/rokugan-map.webp" alt="Карта Рокугана" draggable={false} />
            <div ref={layerRef} className="province-layer"
                onPointerMove={event => setHoveredProvinceId(findProvince(event.target)?.dataset.provinceId ?? null)}
                onPointerLeave={() => setHoveredProvinceId(null)}
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
                    const color = player.clanId ? CLAN_COLORS[player.clanId] : '#8b7566';
                    return <span key={`control-${provinceId}`}
                        className={`control-marker ${hoveredPlayerId === playerId ? 'is-highlighted' : ''}`}
                        style={markerStyle(point.x, point.y, color)}
                        title={`${player.name}: ${PROVINCE_NAMES[provinceId]}`}>
                        {player.clanId ? CLAN_MON[player.clanId] : '?'}
                    </span>;
                })}

                {LAND_BORDERS.map(border => {
                    const occupied = game.orders.some(order => order.target.kind === 'land-border' && order.target.id === border.id);
                    const ownedSource = border.provinces.filter(id => game.provinces[id] === currentPlayerId);
                    const attackedProvinceId = ownedSource.length === 1
                        ? border.provinces.find(id => id !== ownedSource[0])!
                        : null;
                    const eligible = !!landTargets && !occupied && !!attackedProvinceId &&
                        game.provinces[attackedProvinceId] !== currentPlayerId;
                    const angle = attackedProvinceId
                        ? angleToward(border, PROVINCE_CENTERS[attackedProvinceId])
                        : 0;
                    return <TargetMarker key={border.id} kind="land-border" id={border.id}
                        provinceId={attackedProvinceId ?? undefined} point={border} angle={angle}
                        eligible={eligible && !orderPlacementDisabled} onTarget={onTarget} />;
                })}

                {SEA_BORDERS.map(border => {
                    const occupied = game.orders.some(order => order.target.kind === 'sea-border' && order.target.id === border.id);
                    const angle = angleToward(border, PROVINCE_CENTERS[border.provinceId]);
                    return <TargetMarker key={border.id} kind="sea-border" id={border.id}
                        provinceId={border.provinceId} point={border} angle={angle}
                        eligible={!!seaTargets && !occupied && !orderPlacementDisabled} onTarget={onTarget} />;
                })}

                {game.orders.map(order => {
                    const placement = orderPlacement(order, game);
                    if (!placement)
                        return null;
                    const player = playersById[order.playerId];
                    const color = player?.clanId ? CLAN_COLORS[player.clanId] : '#8b7566';
                    const canBless = orderTargets && order.playerId === currentPlayerId &&
                        ['army', 'fleet', 'shinobi'].includes(order.type);
                    return <button key={order.id}
                        className={`placed-order placed-order-${order.type} ${hoveredPlayerId === order.playerId ? 'is-highlighted' : ''} ${canBless ? 'is-target' : ''}`}
                        style={markerStyle(placement.x, placement.y, color, placement.angle)}
                        disabled={!canBless || orderPlacementDisabled}
                        onClick={() => onTarget({ kind: 'order', id: order.id })}
                        title={order.type === 'hidden' ? 'Скрытый приказ' : tokenLabel(order.type)}>
                        <span>{tokenSymbol(order.type)}</span>
                        {order.strength !== null && <b>{order.strength}</b>}
                    </button>;
                })}
            </div>
        </div>

        <div className={`province-label ${hoveredProvinceId ? 'visible' : ''}`}>
            <span>Провинция</span><strong>{hoveredProvinceId ? PROVINCE_NAMES[hoveredProvinceId] : ''}</strong>
        </div>
        {selectedToken && <div className="target-legend">
            <b>{TOKEN_INFO[selectedToken.type].label}</b><span>{TOKEN_INFO[selectedToken.type].hint}</span>
        </div>}
        {controlPlacementActive && <div className="target-legend setup-legend">
            <b>Жетон контроля</b><span>Выберите свободную провинцию</span>
        </div>}
    </div>;
}

function TargetMarker(props: {
    kind: 'land-border' | 'sea-border';
    id: string;
    provinceId?: string;
    point: MapPoint;
    angle: number;
    eligible: boolean;
    onTarget: (target: OrderTarget) => void;
}) {
    const { kind, id, provinceId, point, angle, eligible, onTarget } = props;
    return <button className={`border-target ${kind} ${eligible ? 'is-active' : ''}`}
        style={markerStyle(point.x, point.y, undefined, angle)}
        disabled={!eligible}
        onClick={() => onTarget({ kind, id, provinceId })}
        aria-label="Выбрать границу">
        <span>+</span>
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

function orderPlacement(order: PlacedOrderView, game: GameViewState): { x: number; y: number; angle: number } | null {
    if (order.target.kind === 'order') {
        const base = game.orders.find(item => item.id === order.target.id);
        const placement = base ? orderPlacement(base, game) : null;
        return placement ? { x: placement.x + 9, y: placement.y - 9, angle: placement.angle } : null;
    }

    if (order.target.kind === 'province') {
        const center = PROVINCE_CENTERS[order.target.id];
        if (!center)
            return null;
        const provinceOrders = game.orders.filter(item =>
            item.target.kind === 'province' && item.target.id === order.target.id
        );
        const index = provinceOrders.findIndex(item => item.id === order.id);
        const spread = (index - (provinceOrders.length - 1) / 2) * 34;
        const orbitAngle = 90 + spread;
        const radius = 34;
        const point = {
            x: center.x + Math.cos(orbitAngle * Math.PI / 180) * radius,
            y: center.y + Math.sin(orbitAngle * Math.PI / 180) * radius
        };
        return { ...point, angle: angleToward(point, center) };
    }

    const border = order.target.kind === 'land-border'
        ? LAND_BORDERS.find(item => item.id === order.target.id)
        : SEA_BORDERS.find(item => item.id === order.target.id);
    if (!border)
        return null;

    const provinceId = order.target.provinceId ??
        (order.target.kind === 'sea-border' && 'provinceId' in border ? border.provinceId : undefined);
    const targetCenter = provinceId ? PROVINCE_CENTERS[provinceId] : null;
    return { x: border.x, y: border.y, angle: targetCenter ? angleToward(border, targetCenter) : 0 };
}

function markerStyle(x: number, y: number, color?: string, angle = -90): CSSProperties {
    return {
        left: `${x / 1024 * 100}%`,
        top: `${y / 1536 * 100}%`,
        '--marker-color': color,
        '--token-angle': `${angle}deg`,
        '--token-counter-angle': `${-90 - angle}deg`
    } as CSSProperties;
}

function angleToward(from: MapPoint, to: MapPoint): number {
    return Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI + 90;
}

function tokenSymbol(type: VisibleTokenType): string {
    return type === 'hidden' ? '?' : TOKEN_INFO[type].symbol;
}

function tokenLabel(type: VisibleTokenType): string {
    return type === 'hidden' ? 'Скрытый приказ' : TOKEN_INFO[type].label;
}
