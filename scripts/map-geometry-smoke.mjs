import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', logLevel: 'error' });
try {
    const { PROVINCE_IDS, PROVINCE_CENTERS, LAND_BORDERS, SEA_BORDERS } = await vite.ssrLoadModule('/shared/map.ts');
    const { orderPlacement } = await vite.ssrLoadModule('/src/game/map/geometry.ts');
    const svg = fs.readFileSync('src/assets/rokugan-provinces.svg', 'utf8');
    const shapes = Object.fromEntries([...svg.matchAll(/<path\b([^>]+)>/g)].map(([, attrs]) => {
        const id = attrs.match(/data-province-id="([^"]+)"/)[1];
        const d = attrs.match(/\bd="([^"]+)"/)[1];
        assert.match(d, /^M [\d., L]+ Z$/, `${id}: expected calibrated polygon`);
        return [id, [...d.matchAll(/([\d.]+),([\d.]+)/g)].map(([, x, y]) => ({ x: +x, y: +y }))];
    }));
    function inside(p, polygon) {
        let result = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const a = polygon[i], b = polygon[j];
            if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)
                result = !result;
        }
        return result;
    }
    function edgeDistance(p, polygon) {
        return Math.min(...polygon.map((a, i) => {
            const b = polygon[(i + 1) % polygon.length], dx = b.x - a.x, dy = b.y - a.y;
            const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
            return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
        }));
    }
    assert.deepEqual(Object.keys(shapes).sort(), [...PROVINCE_IDS].sort());
    for (const id of PROVINCE_IDS) {
        const center = PROVINCE_CENTERS[id];
        assert(inside(center, shapes[id]), `${id}: control outside province`);
        assert(edgeDistance(center, shapes[id]) >= 38, `${id}: control/honor/defense too close to edge`);
        const order = { id: 'test', target: { kind: 'province', id } };
        const placed = orderPlacement(order, { orders: [order] });
        assert(inside(placed, shapes[id]), `${id}: province order outside province`);
        assert(Math.hypot(placed.x - center.x, placed.y - center.y) >= 48, `${id}: order covers control`);
    }
    for (const border of LAND_BORDERS) {
        for (const provinceId of border.provinces) {
            assert(edgeDistance(border, shapes[provinceId]) <= 6, `${border.id}: target off shared border`);
            const placed = orderPlacement({ target: { kind: 'land-border', id: border.id, provinceId } }, { orders: [] });
            assert(inside(placed, shapes[provinceId]), `${border.id}: attack on wrong side (${provinceId})`);
        }
    }
    for (const border of SEA_BORDERS) {
        assert(PROVINCE_IDS.includes(border.provinceId));
        assert(PROVINCE_IDS.every(id => !inside(border, shapes[id])), `${border.id}: sea target on land`);
    }
    console.log(`Map geometry passed: ${PROVINCE_IDS.length} provinces, ${LAND_BORDERS.length} land borders (both directions), ${SEA_BORDERS.length} sea targets.`);
} finally {
    await vite.close();
}
