import {
    forwardRef,
    memo,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent,
    type PointerEvent as ReactPointerEvent
} from 'react';
import {
    COASTAL_PROVINCES,
    LAND_BORDERS,
    PROVINCE_BASE_DEFENSE,
    PROVINCE_CENTERS,
    PROVINCE_HONOR,
    PROVINCE_IDS,
    PROVINCE_NAMES,
    SEA_BORDERS,
    SHADOWLANDS_PROVINCES,
    type MapPoint
} from '../../shared/map';
import {
    CLANS,
    type ActionCardType,
    type BattleTokenView,
    type GameViewState,
    type OrderTarget,
    type PlacedOrderView,
    type RoomPlayer,
    type VisibleTokenType
} from '../../shared/room';
import provinceSvg from '../assets/rokugan-provinces.svg?raw';
import { CLAN_COLORS, CLAN_MON, TOKEN_INFO } from './GameBoard';

interface ProvinceMapProps {
    game: GameViewState;
    players: RoomPlayer[];
    currentPlayerId: string;
    hoveredPlayerId: string | null;
    selectedToken: BattleTokenView | null;
    selectedActionCard: ActionCardType | null;
    selectedClanAction: 'scorpion-peek' | 'unicorn-swap' | null;
    selectedClanOrderIds: string[];
    orderPlacementDisabled: boolean;
    controlPlacementActive: boolean;
    onTarget: (target: OrderTarget) => void;
    onActionCardTarget: (orderId: string) => void;
    onClanActionTarget: (orderId: string) => void;
    onPlaceControl: (provinceId: string) => void;
}

function findProvince(target: EventTarget | null): SVGPathElement | null {
    return target instanceof Element ? target.closest<SVGPathElement>('path[data-province-id]') : null;
}

const ProvinceShapes = memo(forwardRef<HTMLDivElement>(function ProvinceShapes(_, ref) {
    return <div ref={ref} className="province-layer"
        dangerouslySetInnerHTML={{ __html: provinceSvg }} />;
}));

export function ProvinceMap(props: ProvinceMapProps) {
    const {
        game,
        players,
        currentPlayerId,
        hoveredPlayerId,
        selectedToken,
        selectedActionCard,
        selectedClanAction,
        selectedClanOrderIds,
        orderPlacementDisabled,
        controlPlacementActive,
        onTarget,
        onActionCardTarget,
        onClanActionTarget,
        onPlaceControl
    } = props;

    const layerRef = useRef<HTMLDivElement>(null);
    const [provinceTooltip, setProvinceTooltip] = useState<{
        text: string;
        x: number;
        y: number;
    } | null>(null);
    const playersById = useMemo(() => Object.fromEntries(players.map(player => [player.id, player])), [players]);
    const currentPlayerGame = game.players.find(player => player.playerId === currentPlayerId);
    const currentPlayerIsRonin = currentPlayerGame?.isRonin ?? false;

    useEffect(() => {
        const paths = layerRef.current?.querySelectorAll<SVGPathElement>('path[data-province-id]');

        paths?.forEach(path => {
            const id = path.dataset.provinceId!;
            const ownerId = game.provinces[id];
            const owner = ownerId ? playersById[ownerId] : undefined;
            const validOrderTarget = !!selectedToken && provinceIsEligible(selectedToken, id, game, currentPlayerId);
            const validControlTarget = controlPlacementActive && game.provinces[id] === null;
            const honor = PROVINCE_HONOR[id] ?? 0;
            const baseDefense = PROVINCE_BASE_DEFENSE[id] ?? 0;
            const earnedDefense = game.defenseBonuses[id] ?? 0;
            const earnedDefenseStrength = earnedDefense * (owner?.clanId === 'crab' ? 3 : 1);
            const clanName = owner?.clanId
                ? CLANS.find(clan => clan.id === owner.clanId)?.name ?? owner.clanId
                : null;
            const ownership = owner
                ? `Принадлежит клану ${clanName} (${owner.name})`
                : 'Ничейная провинция';
            const special = game.provinceSpecials[id] === 'scorched'
                ? ' · 🔥 Разорённая земля'
                : game.provinceSpecials[id] === 'peace'
                    ? ' · ☮ Мир'
                    : '';
            const honorText = SHADOWLANDS_PROVINCES.has(id)
                ? `⭐ ${honor} на поле (0 чести в конце игры)`
                : `⭐ ${honor}`;
            const defenseText = `🛡 ${baseDefense + earnedDefenseStrength}` +
                ` (база ${baseDefense}, открытые жетоны ${earnedDefenseStrength}` +
                `${owner?.clanId === 'crab' && earnedDefense > 0 ? ` = ${earnedDefense} × 3, Краб` : ''})`;
            const tooltip = `${PROVINCE_NAMES[id]} · ${honorText} · ${defenseText} · ${ownership}${special}`;

            path.dataset.provinceName = PROVINCE_NAMES[id];
            path.setAttribute('aria-label', tooltip);

            const title = path.querySelector('title');
            if (title)
                title.textContent = tooltip;

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

    function handleProvincePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        const path = findProvince(event.target);
        if (!path) {
            if (provinceTooltip)
                setProvinceTooltip(null);
            return;
        }
        const text = path.getAttribute('aria-label');
        if (!text)
            return;
        const bounds = event.currentTarget.getBoundingClientRect();
        setProvinceTooltip({
            text,
            x: Math.min(Math.max(4, event.clientX - bounds.left), Math.max(4, bounds.width - 330)),
            y: Math.min(Math.max(4, event.clientY - bounds.top), Math.max(4, bounds.height - 145))
        });
    }

    const landTargets = selectedToken && ['army', 'blank'].includes(selectedToken.type);
    const seaTargets = selectedToken && ['fleet', 'blank'].includes(selectedToken.type);
    const orderTargets = selectedToken?.type === 'blessing';

    return <div className={`province-map landscape-map phase-${game.phase}`}
        onPointerMove={handleProvincePointerMove}
        onPointerLeave={() => setProvinceTooltip(null)}>
        <div className="rotated-map" onClick={handleMapClick}>
            <img className="rokugan-map-image" src="/assets/rokugan-map.webp" alt="Карта Рокугана" draggable={false} />

            <ProvinceShapes ref={layerRef} />

            <div className="map-markers">
                {Object.entries(game.provinces).map(([provinceId, playerId]) => {
                    if (!playerId)
                        return null;

                    const point = PROVINCE_CENTERS[provinceId];
                    const player = playersById[playerId];

                    if (!point || !player)
                        return null;

                    const color = player.clanId ? CLAN_COLORS[player.clanId] : '#8b7566';
                    const clanName = player.clanId
                        ? CLANS.find(clan => clan.id === player.clanId)?.name ?? player.clanId
                        : 'без клана';

                    return <span key={`control-${provinceId}`}
                        className={`control-marker ${hoveredPlayerId === playerId ? 'is-highlighted' : ''}`}
                        style={markerStyle(point.x, point.y, color)}
                        title={`${PROVINCE_NAMES[provinceId]} · принадлежит клану ${clanName} (${player.name}) · ⭐ ${PROVINCE_HONOR[provinceId] ?? 0}`}>
                        {player.clanId ? CLAN_MON[player.clanId] : '?'}
                    </span>;
                })}

                {PROVINCE_IDS.map(provinceId => {
                    const ownerId = game.provinces[provinceId];
                    const owner = ownerId ? playersById[ownerId] : undefined;
                    const earnedMarkers = game.defenseBonuses[provinceId] ?? 0;
                    const earnedDefense = earnedMarkers * (owner?.clanId === 'crab' ? 3 : 1);
                    const bonus = (PROVINCE_BASE_DEFENSE[provinceId] ?? 0) + earnedDefense;
                    if (bonus <= 0)
                        return null;

                    const point = PROVINCE_CENTERS[provinceId];
                    if (!point)
                        return null;

                    return <span key={`defense-${provinceId}`} className="defense-marker"
                        style={markerStyle(point.x + 25, point.y - 20)}
                        title={`${PROVINCE_NAMES[provinceId]}: общая защита +${bonus}` +
                            `${owner?.clanId === 'crab' && earnedMarkers > 0
                                ? ` (${earnedMarkers} открытых жетонов Краба × 3)`
                                : ''}`}>
                        🛡<b>+{bonus}</b>
                    </span>;
                })}

                {Object.entries(game.provinceSpecials).map(([provinceId, special]) => {
                    const point = PROVINCE_CENTERS[provinceId];
                    if (!point)
                        return null;

                    return <span key={`special-${provinceId}`} className={`special-marker special-${special}`}
                        style={markerStyle(point.x, point.y)}
                        title={`${PROVINCE_NAMES[provinceId]}: ${special === 'scorched' ? 'разорена' : 'мир'}`}>
                        {special === 'scorched' ? '🔥' : '☮'}
                    </span>;
                })}

                {LAND_BORDERS.flatMap(border => {
                    const occupied = game.orders.some(order =>
                        order.target.kind === 'land-border' && order.target.id === border.id
                    );

                    if (currentPlayerIsRonin) {
                        return border.provinces.map(attackedProvinceId => {
                            const targetCenter = PROVINCE_CENTERS[attackedProvinceId];
                            const point = targetCenter
                                ? pointToward(border, targetCenter, 14)
                                : border;
                            const eligible = !!landTargets && !occupied &&
                                !border.provinces.some(id => !!game.provinceSpecials[id]) &&
                                game.provinces[attackedProvinceId] !== currentPlayerId;

                            return <TargetMarker
                                key={`${border.id}-${attackedProvinceId}`}
                                kind="land-border"
                                id={border.id}
                                provinceId={attackedProvinceId}
                                point={point}
                                angle={targetCenter ? angleToward(border, targetCenter) : 0}
                                eligible={eligible && !orderPlacementDisabled}
                                onTarget={onTarget}
                            />;
                        });
                    }

                    const ownedSource = border.provinces.filter(id => game.provinces[id] === currentPlayerId);
                    const attackedProvinceId = ownedSource.length === 1
                        ? border.provinces.find(id => id !== ownedSource[0])!
                        : null;

                    const eligible = !!landTargets && !occupied && !!attackedProvinceId &&
                        !border.provinces.some(id => !!game.provinceSpecials[id]) &&
                        game.provinces[attackedProvinceId] !== currentPlayerId;

                    const angle = attackedProvinceId
                        ? angleToward(border, PROVINCE_CENTERS[attackedProvinceId])
                        : 0;

                    return [<TargetMarker key={border.id} kind="land-border" id={border.id}
                        provinceId={attackedProvinceId ?? undefined} point={border} angle={angle}
                        eligible={eligible && !orderPlacementDisabled} onTarget={onTarget} />];
                })}

                {SEA_BORDERS.map(border => {
                    const occupied = game.orders.some(order =>
                        order.target.kind === 'sea-border' && order.target.id === border.id
                    );

                    const angle = angleToward(border, PROVINCE_CENTERS[border.provinceId]);

                    return <TargetMarker key={border.id} kind="sea-border" id={border.id}
                        provinceId={border.provinceId} point={border} angle={angle}
                        eligible={!!seaTargets && !occupied && !game.provinceSpecials[border.provinceId] &&
                            game.provinces[border.provinceId] !== currentPlayerId &&
                            !orderPlacementDisabled} onTarget={onTarget} />;
                })}

                {game.orders.map(order => {
                    const placement = orderPlacement(order, game);

                    if (!placement)
                        return null;

                    const player = playersById[order.playerId];
                    const color = player?.clanId ? CLAN_COLORS[player.clanId] : '#8b7566';
                    const canBless = orderTargets && order.playerId === currentPlayerId &&
                        ['army', 'fleet', 'shinobi'].includes(order.type);
                    const protectedByBlessing = game.orders.some(candidate =>
                        candidate.type === 'blessing' &&
                        candidate.target.kind === 'order' &&
                        candidate.target.id === order.id
                    );
                    const canUseActionCard = !!selectedActionCard &&
                        order.playerId !== currentPlayerId &&
                        !protectedByBlessing &&
                        (selectedActionCard === 'scout'
                            ? !order.revealed && order.type !== 'blessing'
                            : true);
                    const canUseClanAction = selectedClanAction === 'scorpion-peek'
                        ? order.playerId !== currentPlayerId &&
                            !order.revealed &&
                            order.type !== 'blessing' &&
                            !protectedByBlessing
                        : selectedClanAction === 'unicorn-swap'
                            ? order.playerId === currentPlayerId &&
                                order.target.kind !== 'order' &&
                                !protectedByBlessing
                            : false;
                    const selectedForClanAction = selectedClanOrderIds.includes(order.id);
                    const isInteractive = ((canBless || canUseActionCard) && !orderPlacementDisabled) ||
                        canUseClanAction;

                    return <button key={order.id}
                        className={`placed-order placed-order-${order.type} ${order.isClanToken ? 'is-clan-token' : ''} ${hoveredPlayerId === order.playerId ? 'is-highlighted' : ''} ${canBless ? 'is-blessing-target' : ''} ${canUseActionCard ? 'is-card-target' : ''} ${canUseClanAction ? 'is-clan-action-target' : ''} ${selectedForClanAction ? 'is-clan-action-selected' : ''} ${game.phase === 'reveal' && order.revealed && !game.clanActionPending ? 'is-revealed' : ''}`}
                        style={markerStyle(placement.x, placement.y, color, placement.angle)}
                        disabled={!isInteractive}
                        onClick={() => canUseClanAction
                            ? onClanActionTarget(order.id)
                            : canUseActionCard
                                ? onActionCardTarget(order.id)
                                : onTarget({ kind: 'order', id: order.id })}
                        title={order.type === 'hidden' ? 'Скрытый приказ' : tokenLabel(order.type)}>
                        <span>{tokenSymbol(order.type)}</span>
                        {order.strength !== null && <b>{order.strength}</b>}
                        {order.isClanToken && <i>◆</i>}
                    </button>;
                })}
            </div>
        </div>

        {provinceTooltip && <div className="province-tooltip" role="tooltip"
            style={{ left: provinceTooltip.x, top: provinceTooltip.y }}>
            {provinceTooltip.text.split(' · ').map((part, index) =>
                <span key={`${part}-${index}`}>{part}</span>
            )}
        </div>}

        {selectedToken && <div className="target-legend">
            <b>{TOKEN_INFO[selectedToken.type].label}</b>
            <span>{TOKEN_INFO[selectedToken.type].hint}</span>
        </div>}

        {selectedActionCard && <div className="target-legend action-card-legend">
            <b>{selectedActionCard === 'scout' ? '👁 Разведка' : '✨ Сюгэндзя'}</b>
            <span>{selectedActionCard === 'scout'
                ? 'Выберите закрытый жетон соперника, чтобы тайно посмотреть его.'
                : 'Выберите жетон соперника, чтобы раскрыть и сбросить его.'}</span>
        </div>}

        {selectedClanAction && <div className="target-legend clan-action-legend">
            <b>{selectedClanAction === 'scorpion-peek' ? '🦂 Шёпот Скорпиона' : '🦄 Манёвр Единорога'}</b>
            <span>{selectedClanAction === 'scorpion-peek'
                ? 'Выберите закрытый и не защищённый благословением жетон соперника.'
                : `Выберите два своих жетона · ${selectedClanOrderIds.length}/2`}</span>
        </div>}

        {controlPlacementActive && <div className="target-legend setup-legend">
            <b>Жетон контроля</b>
            <span>Выберите свободную провинцию</span>
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

    const label = provinceId
        ? `Атаковать «${PROVINCE_NAMES[provinceId]}» через границу`
        : 'Выбрать границу';

    return <button className={`border-target ${kind} ${eligible ? 'is-active' : ''}`}
        style={markerStyle(point.x, point.y, undefined, angle)}
        disabled={!eligible}
        onClick={() => onTarget({ kind, id, provinceId })}
        aria-label={label}
        title={label}>
        <span>+</span>
    </button>;
}

function provinceIsEligible(token: BattleTokenView, provinceId: string, game: GameViewState, playerId: string): boolean {
    if (game.provinceSpecials[provinceId])
        return false;

    const isRonin = game.players.find(player => player.playerId === playerId)?.isRonin ?? false;

    if (token.type === 'blank' || token.type === 'shinobi')
        return true;

    if (token.type === 'army')
        return game.provinces[provinceId] === playerId;

    if (token.type === 'diplomacy')
        return !isRonin && game.provinces[provinceId] === playerId;

    if (token.type === 'fleet')
        return game.provinces[provinceId] === playerId && COASTAL_PROVINCES.has(provinceId);

    if (token.type === 'raid') {
        if (isRonin)
            return false;
        if (game.provinces[provinceId] === playerId)
            return false;
        return true;
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

function pointToward(from: MapPoint, to: MapPoint, distance: number): MapPoint {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    return {
        x: from.x + dx / length * distance,
        y: from.y + dy / length * distance
    };
}

function tokenSymbol(type: VisibleTokenType): string {
    return type === 'hidden' ? '?' : TOKEN_INFO[type].symbol;
}

function tokenLabel(type: VisibleTokenType): string {
    return type === 'hidden' ? 'Скрытый приказ' : TOKEN_INFO[type].label;
}
