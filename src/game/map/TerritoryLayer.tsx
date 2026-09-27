import { memo, useId, type CSSProperties } from 'react';
import { PROVINCE_CENTERS, PROVINCE_IDS, PROVINCE_NAMES } from '../../../shared/map';
import provinceSvg from '../../assets/rokugan-provinces.svg?raw';
import { markerStyle } from './geometry';
import type { TerritoryState } from './territoryState';

// Reuse the authoritative hit geometry, without the legacy inline styles,
// titles or imperative DOM mutations. Artwork and overlays share one viewBox.
const shapes = Object.fromEntries([...provinceSvg.matchAll(/<path\b([^>]+)>/g)].map(([, attributes]) => [
    attributes.match(/\bdata-province-id="([^"]+)"/)?.[1],
    attributes.match(/\bd="([^"]+)"/)?.[1]
]));

export const TerritoryLayer = memo(function TerritoryLayer({ state, hoveredPlayerId }: {
    state: TerritoryState;
    hoveredPlayerId: string | null;
}) {
    const prefix = useId().replace(/:/g, '');
    const shapeId = (id: string) => `${prefix}-${id}`;
    return <div className="province-layer">
        <svg viewBox="0 0 1024 1536" aria-label="Карта провинций Рокугана">
            <defs>
                {PROVINCE_IDS.map(id => <path key={id} id={shapeId(id)} d={shapes[id]} />)}
                {/* Close tiny seams before outlining the union, so a region
                    has one perimeter instead of a border around every province. */}
                <filter id={`${prefix}-region-rim`} x="-10%" y="-10%" width="120%" height="120%"
                    colorInterpolationFilters="sRGB">
                    <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="expanded" />
                    <feMorphology in="expanded" operator="erode" radius="2" result="region" />
                    <feMorphology in="region" operator="dilate" radius="5" result="outer" />
                    <feComposite in="outer" in2="region" operator="out" result="outerRing" />
                    <feFlood floodColor="#352716" floodOpacity=".8" />
                    <feComposite in2="outerRing" operator="in" result="shadow" />
                    <feMorphology in="region" operator="dilate" radius="3" result="rim" />
                    <feComposite in="rim" in2="region" operator="out" result="ring" />
                    <feFlood floodColor="#f3ce7f" />
                    <feComposite in2="ring" operator="in" result="gold" />
                    <feMerge><feMergeNode in="shadow" /><feMergeNode in="gold" /></feMerge>
                </filter>
            </defs>
            <image className="map-artwork" href="/assets/rokugan-map-muted-uniform.png"
                x="-256" y="256" width="1536" height="1024" transform="rotate(-90 512 768)"
                preserveAspectRatio="none" />
            <g className="territory-ownership" aria-hidden="true">
                {state.provinces.filter(province => province.highlighted).map(province =>
                    <g key={province.id} className={`territory-owner ${province.completed ? 'is-complete' : ''} ${province.highlighted ? 'is-highlighted' : ''}`}
                        style={{ '--territory-color': province.color } as CSSProperties}>
                        <use href={`#${shapeId(province.id)}`} className="territory-fill" />
                        {!province.completed && <use href={`#${shapeId(province.id)}`} className="territory-edge-underlay" />}
                        {!province.completed && <use href={`#${shapeId(province.id)}`} className="territory-edge" />}
                    </g>
                )}
            </g>
            <g className="territory-regions" aria-hidden="true">
                {state.completedRegions.filter(region => region.owner.id === hoveredPlayerId).map(region => <g key={region.id} data-region-id={region.id}
                    className={`territory-region ${hoveredPlayerId === region.owner.id ? 'is-highlighted' : ''}`}
                    filter={`url(#${prefix}-region-rim)`}>
                    {region.provinceIds.map(id => <use key={id} href={`#${shapeId(id)}`} fill="white" />)}
                </g>)}
            </g>
            <g className="territory-actions" aria-hidden="true">
                {state.provinces.filter(province => province.eligible).map(province =>
                    <use key={province.id} href={`#${shapeId(province.id)}`} className="territory-target" />)}
                {state.provinces.filter(province => province.resolving).map(province =>
                    <use key={province.id} href={`#${shapeId(province.id)}`} className="territory-resolution" />)}
            </g>
            <g className="territory-hit-areas">
                {state.provinces.map(province => <path key={province.id} d={shapes[province.id]}
                    data-province-id={province.id} data-province-name={PROVINCE_NAMES[province.id]}
                    className={`territory-hit ${province.eligible ? 'is-eligible' : ''}`}
                    role="button" tabIndex={0} aria-label={province.description} aria-disabled={!province.eligible} />)}
            </g>
        </svg>
    </div>;
});

export function RegionControlMarkers({ regions, hoveredPlayerId }: {
    regions: TerritoryState['completedRegions'];
    hoveredPlayerId: string | null;
}) {
    return <>{regions.filter(region => region.owner.id === hoveredPlayerId).map(region => {
        const anchor = region.provinceIds.find(id => id.includes('_capital_')) ?? region.provinceIds[0];
        const point = PROVINCE_CENTERS[anchor];
        return <span key={region.id} className={`region-control-marker ${hoveredPlayerId === region.owner.id ? 'is-highlighted' : ''}`}
            style={markerStyle(point.x, point.y, region.color)}
            title={`${region.name} · Полный контроль: ${region.owner.name} · +5 чести`}
            aria-label={`${region.name}: полный контроль, ${region.owner.name}, +5 чести`}>
            <svg viewBox="0 0 20 16" aria-hidden="true"><path d="M2 4 5 7 10 1 15 7 18 4 16 12H4Z M4 15H16" /></svg>
            <b>+5</b>
        </span>;
    })}</>;
}
