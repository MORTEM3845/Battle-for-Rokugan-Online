import type { CSSProperties } from 'react';
import { LAND_BORDERS, PROVINCE_CENTERS, SEA_BORDERS, type MapPoint } from '../../../shared/map';
import type { GameViewState, PlacedOrderView } from '../../../shared/room';

// Face province orders into the available interior, away from control and honor.
// Angles are in the portrait SVG coordinate system, before the board rotation.
const PROVINCE_ORDER_ANGLES: Record<string, number> = {
    orangephoenix_province_2_06: 80,
    orangephoenix_capital_2_04: 55,
    purpleunicorn_capital_2_07: 240,
    yellowlion_province_2_12: 85,
    yellowlion_province_2_11: 60,
    lightbluecrane_province_2_17: 230,
    graycrab_province_3_21: 80,
    goldcoast_province_3_25: 85,
    redscorpion_province_3_14: 75,
    greendragon_province_3_03: 60,
    lavenderislands_province_1_27: 105,
    blackshadowlandssouth_province_1_30: 80,
    purpleunicorn_province_1_08: 125,
    goldcoast_province_2_24: 300,
    redscorpion_capital_2_13: 55,
    lavenderislands_province_2_26: 105,
    graycrab_capital_2_19: 60,
    lightbluecrane_capital_2_16: 80,
    goldcoast_province_3_23: 105,
    lavenderislands_province_1_28: 110,
    lightbluecrane_province_3_18: 125
};

export function orderPlacement(order: PlacedOrderView, game: GameViewState): { x: number; y: number; angle: number } | null {
    if (order.target.kind === 'order') {
        const base = game.orders.find(item => item.id === order.target.id);
        const placement = base ? orderPlacement(base, game) : null;
        return placement ? { x: placement.x + 9, y: placement.y - 9, angle: placement.angle } : null;
    }
    if (order.target.kind === 'province') {
        const center = PROVINCE_CENTERS[order.target.id];
        if (!center)
            return null;
        const provinceOrders = game.orders.filter(item => item.target.kind === 'province' && item.target.id === order.target.id);
        const index = provinceOrders.findIndex(item => item.id === order.id);
        const orbitAngle = (PROVINCE_ORDER_ANGLES[order.target.id] ?? 90) +
            (index - (provinceOrders.length - 1) / 2) * 34;
        const point = {
            x: center.x + Math.cos(orbitAngle * Math.PI / 180) * 52,
            y: center.y + Math.sin(orbitAngle * Math.PI / 180) * 52
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
    const point = order.target.kind === 'land-border' && targetCenter ? pointToward(border, targetCenter, 26) : border;
    return { x: point.x, y: point.y, angle: targetCenter ? angleToward(point, targetCenter) : 0 };
}

export function markerStyle(x: number, y: number, color?: string, angle = -90): CSSProperties {
    return {
        left: `${x / 1024 * 100}%`, top: `${y / 1536 * 100}%`, '--marker-color': color,
        '--token-angle': `${angle}deg`, '--token-counter-angle': `${-90 - angle}deg`
    } as CSSProperties;
}

export function angleToward(from: MapPoint, to: MapPoint): number {
    return Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI + 90;
}

export function pointToward(from: MapPoint, to: MapPoint, distance: number): MapPoint {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: from.x + dx / length * distance, y: from.y + dy / length * distance };
}
