import { useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import provinceSvg from '../assets/rokugan-provinces.svg?raw';

function findProvince(target: EventTarget | null): SVGPathElement | null {
    if (!(target instanceof Element))
        return null;
    return target.closest<SVGPathElement>('path[data-province-id]');
}

export function ProvinceMap() {
    const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

    function selectProvince(path: SVGPathElement, container: HTMLElement): void {
        container.querySelector('.province-shape.is-selected')?.classList.remove('is-selected');
        path.classList.add('is-selected');
        setSelectedProvince(path.dataset.provinceName ?? null);
    }

    function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
        setHoveredProvince(findProvince(event.target)?.dataset.provinceName ?? null);
    }

    function handleClick(event: MouseEvent<HTMLDivElement>): void {
        const province = findProvince(event.target);
        if (province)
            selectProvince(province, event.currentTarget);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
        if (event.key !== 'Enter' && event.key !== ' ')
            return;

        const province = findProvince(event.target);
        if (!province)
            return;

        event.preventDefault();
        selectProvince(province, event.currentTarget);
    }

    const activeProvince = hoveredProvince ?? selectedProvince;

    return <div className="province-map">
        <img className="rokugan-map-image" src="/assets/rokugan-map.webp" alt="Карта Рокугана" draggable={false} />
        <div className="province-layer" onPointerMove={handlePointerMove} onPointerLeave={() => setHoveredProvince(null)}
            onClick={handleClick} onKeyDown={handleKeyDown} dangerouslySetInnerHTML={{ __html: provinceSvg }} />
        <div className={`province-label ${activeProvince ? 'visible' : ''}`} aria-live="polite">
            <span>{hoveredProvince ? 'Наведение' : 'Выбрано'}</span>
            <strong>{activeProvince ?? 'Выберите провинцию'}</strong>
        </div>
    </div>;
}
