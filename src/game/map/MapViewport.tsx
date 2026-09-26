import { useRef, useState, type PointerEvent, type ReactNode } from 'react';

interface MapView {
    scale: number;
    x: number;
    y: number;
}

const overview: MapView = { scale: 1, x: 0, y: 0 };
const zoomSteps = [1, 1.5, 2, 2.5, 3];

function constrainView(view: MapView): MapView {
    return {
        scale: view.scale,
        x: Math.max(1 - view.scale, Math.min(0, view.x)),
        y: Math.max(1 - view.scale, Math.min(0, view.y))
    };
}

function zoomAt(view: MapView, scale: number, x = .5, y = .5): MapView {
    return constrainView({
        scale,
        x: x - (x - view.x) * scale / view.scale,
        y: y - (y - view.y) * scale / view.scale
    });
}

export function MapViewport({ children }: { children: ReactNode }) {
    const [view, setView] = useState(overview);
    const [panning, setPanning] = useState(false);
    const gesture = useRef<{
        pointerId: number;
        middle: boolean;
        x: number;
        y: number;
        view: MapView;
        moved: boolean;
    } | null>(null);
    const suppressClick = useRef(false);

    function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
        if (!gesture.current)
            suppressClick.current = false;
        if (gesture.current || (event.button !== 1 && (event.pointerType !== 'touch' || view.scale === 1)))
            return;
        if ((event.target as Element).closest('.map-zoom-controls'))
            return;

        gesture.current = {
            pointerId: event.pointerId,
            middle: event.button === 1,
            x: event.clientX,
            y: event.clientY,
            view,
            moved: false
        };
        if (event.button === 1) {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.focus({ preventScroll: true });
        }
    }

    function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
        const active = gesture.current;
        if (!active || active.pointerId !== event.pointerId || active.view.scale === 1)
            return;

        const dx = event.clientX - active.x;
        const dy = event.clientY - active.y;
        if (!active.moved && Math.hypot(dx, dy) < 5)
            return;

        active.moved = true;
        suppressClick.current = true;
        setPanning(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        const bounds = event.currentTarget.getBoundingClientRect();
        setView(constrainView({
            scale: active.view.scale,
            x: active.view.x + dx / bounds.width,
            y: active.view.y + dy / bounds.height
        }));
    }

    function finishGesture(event: PointerEvent<HTMLDivElement>, cancelled = false) {
        const active = gesture.current;
        if (!active || active.pointerId !== event.pointerId)
            return;

        gesture.current = null;
        setPanning(false);
        if (!cancelled && active.middle && !active.moved) {
            const bounds = event.currentTarget.getBoundingClientRect();
            setView(active.view.scale > 1 ? overview : zoomAt(active.view, 2.5,
                (event.clientX - bounds.left) / bounds.width,
                (event.clientY - bounds.top) / bounds.height));
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const zoomed = view.scale > 1;

    return <div className={`map-viewport ${zoomed ? 'is-zoomed' : ''} ${panning ? 'is-panning' : ''}`}
        tabIndex={0}
        role="group"
        aria-label="Карта: СКМ — приблизить или вернуть общий вид; удерживайте СКМ для перемещения"
        onPointerDownCapture={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={event => finishGesture(event)}
        onPointerCancel={event => finishGesture(event, true)}
        onLostPointerCapture={event => finishGesture(event, true)}
        onClickCapture={event => {
            if (suppressClick.current) {
                event.preventDefault();
                event.stopPropagation();
                suppressClick.current = false;
            }
        }}
        onAuxClick={event => {
            if (event.button === 1)
                event.preventDefault();
        }}
        onKeyDown={event => {
            if (event.key === 'Escape' && zoomed) {
                event.preventDefault();
                setView(overview);
            }
        }}>
        <div className="map-zoom-layer" style={{
            transform: `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.scale})`
        }}>
            {children}
        </div>
        <div className="map-zoom-controls" role="group" aria-label="Масштаб карты">
            <span className="map-zoom-hint" aria-hidden="true">{zoomed ? 'СКМ · назад / тянуть' : 'СКМ · приблизить'}</span>
            <button type="button" aria-label="Уменьшить карту" title="Уменьшить карту"
                disabled={!zoomed}
                onClick={() => setView(current => zoomAt(current,
                    [...zoomSteps].reverse().find(scale => scale < current.scale) ?? 1))}>−</button>
            <button type="button" className="map-zoom-reset" aria-label="Вернуть общий вид карты"
                title="Общий вид · Esc" disabled={!zoomed}
                onClick={() => setView(overview)}>{Math.round(view.scale * 100)}%</button>
            <button type="button" aria-label="Приблизить карту" title="Приблизить карту"
                disabled={view.scale === 3}
                onClick={() => setView(current => zoomAt(current,
                    zoomSteps.find(scale => scale > current.scale) ?? 3))}>+</button>
        </div>
    </div>;
}
