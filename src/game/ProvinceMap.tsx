import {
    forwardRef,
    memo,
    useEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
    type PointerEvent as ReactPointerEvent
} from 'react';
import {
    LAND_BORDERS,
    PROVINCE_BASE_DEFENSE,
    PROVINCE_CENTERS,
    PROVINCE_HONOR,
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
import { ClanMon } from './ClanMon';
import { angleToward, markerStyle, orderPlacement, pointToward } from './map/geometry';
import { ControlMarkers, DefenseMarkers, SpecialMarkers } from './map/ProvinceMarkers';
import { provinceIsEligible } from './map/targeting';
import { CLAN_COLORS, TOKEN_INFO } from './presentation';
import type { SelectedClanAction } from './types';

// Keep the artwork and the hit areas in one SVG coordinate system.  Rendering
// the PNG as a separate transformed element allows rounding differences to
// shift it away from the province paths at some viewport sizes.
const combinedMapSvg = provinceSvg
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, '')
    .replace(
        /<svg\b([^>]*)>/,
        '<svg$1><image class="map-artwork" href="/assets/rokugan-map.png" x="-256" y="256" width="1536" height="1024" transform="rotate(-90 512 768)" preserveAspectRatio="none" />'
    );

interface ProvinceMapProps {
    game: GameViewState;
    players: RoomPlayer[];
    currentPlayerId: string;
    hoveredPlayerId: string | null;
    selectedToken: BattleTokenView | null;
    selectedActionCard: ActionCardType | null;
    selectedClanAction: SelectedClanAction | null;
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
        dangerouslySetInnerHTML={{ __html: combinedMapSvg }} />;
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
    const resolutionStep = game.resolution?.currentStep;

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

            path.classList.toggle('is-owned', !!owner);
            path.classList.toggle('is-player-highlight', !!ownerId && ownerId === hoveredPlayerId);
            path.classList.toggle('is-valid-target', validControlTarget || (!orderPlacementDisabled && validOrderTarget));
            path.classList.toggle('is-resolving', resolutionStep?.provinceId === id);

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
    const blessingsByOrderId = useMemo(() => {
        const blessings = new Map<string, PlacedOrderView[]>();

        for (const order of game.orders) {
            if (order.type !== 'blessing' || order.target.kind !== 'order')
                continue;

            const attached = blessings.get(order.target.id) ?? [];
            attached.push(order);
            blessings.set(order.target.id, attached);
        }

        return blessings;
    }, [game.orders]);

    return <div className={`province-map landscape-map phase-${game.phase}`}
        onPointerMove={handleProvincePointerMove}
        onPointerLeave={() => setProvinceTooltip(null)}>
        <div className="rotated-map" onClick={handleMapClick}>
            <ProvinceShapes ref={layerRef} />

            <div className="map-markers">
                <ControlMarkers game={game} playersById={playersById} hoveredPlayerId={hoveredPlayerId} />
                <DefenseMarkers game={game} playersById={playersById} />
                <SpecialMarkers game={game} />

                {resolutionStep?.provinceId && PROVINCE_CENTERS[resolutionStep.provinceId] &&
                    <span key={resolutionStep.id}
                        className={`resolution-map-effect resolution-map-effect-${resolutionStep.kind}`}
                        style={markerStyle(
                            PROVINCE_CENTERS[resolutionStep.provinceId].x,
                            PROVINCE_CENTERS[resolutionStep.provinceId].y
                        )}
                        aria-hidden="true">
                        <i>{resolutionStep.kind === 'raid' ? '🔥' : resolutionStep.kind === 'diplomacy' ? '☮' : '⚔'}</i>
                    </span>}

                {LAND_BORDERS.flatMap(border => {
                    if (currentPlayerIsRonin) {
                        return border.provinces.map(attackedProvinceId => {
                            const targetCenter = PROVINCE_CENTERS[attackedProvinceId];
                            const point = targetCenter
                                ? pointToward(border, targetCenter, 14)
                                : border;
                            const occupiedInDirection = game.orders.some(order =>
                                order.target.kind === 'land-border' &&
                                order.target.id === border.id &&
                                order.target.provinceId === attackedProvinceId
                            );
                            const eligible = !!landTargets && !occupiedInDirection &&
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

                    const occupiedInDirection = !!attackedProvinceId && game.orders.some(order =>
                        order.target.kind === 'land-border' &&
                        order.target.id === border.id &&
                        order.target.provinceId === attackedProvinceId
                    );
                    const eligible = !!landTargets && !occupiedInDirection && !!attackedProvinceId &&
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
                    // An attached blessing is represented by the seal on its combat token,
                    // rather than a second full-size marker covering that token.
                    if (order.type === 'blessing' && order.target.kind === 'order')
                        return null;

                    const placement = orderPlacement(order, game);

                    if (!placement)
                        return null;

                    const player = playersById[order.playerId];
                    const color = player?.clanId ? CLAN_COLORS[player.clanId] : '#8b7566';
                    const attachedBlessings = blessingsByOrderId.get(order.id) ?? [];
                    const blessingStrength = attachedBlessings.reduce(
                        (total, blessing) => total + (blessing.strength ?? 0),
                        0
                    );
                    const canBless = orderTargets && order.playerId === currentPlayerId &&
                        ['army', 'fleet', 'shinobi'].includes(order.type);
                    const protectedByBlessing = attachedBlessings.length > 0;
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
                    const resolvingHere = !!resolutionStep?.provinceId &&
                        (order.target.kind === 'province'
                            ? order.target.id === resolutionStep.provinceId
                            : order.target.provinceId === resolutionStep.provinceId);
                    const isInteractive = ((canBless || canUseActionCard) && !orderPlacementDisabled) ||
                        canUseClanAction;

                    return <button key={order.id}
                        className={`placed-order placed-order-${order.type} ${protectedByBlessing ? 'is-blessed' : ''} ${order.isClanToken ? 'is-clan-token' : ''} ${hoveredPlayerId === order.playerId ? 'is-highlighted' : ''} ${canBless ? 'is-blessing-target' : ''} ${canUseActionCard ? 'is-card-target' : ''} ${canUseClanAction ? 'is-clan-action-target' : ''} ${selectedForClanAction ? 'is-clan-action-selected' : ''} ${resolvingHere ? 'is-resolving-order' : ''} ${game.phase === 'reveal' && order.revealed && !game.clanActionPending ? 'is-revealed' : ''}`}
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
                        {protectedByBlessing && <span className="blessing-seal"
                            title={`Благословение: +${blessingStrength} к силе и защита от эффектов`}>
                            <span aria-hidden="true">祝</span>
                            <strong>+{blessingStrength}</strong>
                        </span>}
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
            <b><ClanMon clanId={selectedClanAction === 'scorpion-peek' ? 'scorpion' : 'unicorn'}
                className="clan-action-legend-mon" />
                {selectedClanAction === 'scorpion-peek' ? 'Шёпот Скорпиона' : 'Манёвр Единорога'}</b>
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

function tokenSymbol(type: VisibleTokenType): string {
    return type === 'hidden' ? '?' : TOKEN_INFO[type].symbol;
}

function tokenLabel(type: VisibleTokenType): string {
    return type === 'hidden' ? 'Скрытый приказ' : TOKEN_INFO[type].label;
}
