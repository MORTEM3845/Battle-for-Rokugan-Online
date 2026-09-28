import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { PROVINCE_IDS } from '../../../shared/map';
import { getSecretObjectiveProgress } from '../../../shared/objectiveProgress';
import type { GameViewState } from '../../../shared/room';

export function SecretObjectiveTab({ game, currentPlayerId }: {
    game: GameViewState; currentPlayerId: string;
}) {
    const [open, setOpen] = useState(false);
    const openedByHover = useRef(false);
    const tabRef = useRef<HTMLElement>(null);
    const cardId = useId();
    useEffect(() => {
        if (!open) return;
        const closeOutside = (event: PointerEvent) => {
            if (event.target instanceof Node && !tabRef.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('pointerdown', closeOutside);
        return () => document.removeEventListener('pointerdown', closeOutside);
    }, [open]);
    const objective = game.secretObjective;
    const progress = useMemo(() => {
        if (!objective) return null;
        const controlled = PROVINCE_IDS.filter(id => game.provinces[id] === currentPlayerId);
        const fewest = Math.min(...game.players.map(player =>
            PROVINCE_IDS.filter(id => game.provinces[id] === player.playerId).length));
        return { ...getSecretObjectiveProgress(objective.id, controlled, controlled.length === fewest),
            provinceCount: controlled.length, fewest };
    }, [objective, game.provinces, game.players, currentPlayerId]);
    if (!objective || !progress)
        return null;
    const finished = game.phase === 'finished';
    const achieved = game.secretObjectiveAchieved;
    const status = achieved ? finished ? '✓ Выполнена' : '✓ Условие выполнено'
        : finished ? '✕ Не выполнена' : 'В процессе';
    const humanity = objective.id === 'path_of_humanity';
    const counter = humanity ? `${progress.provinceCount} / ${progress.fewest}` : `${progress.current} / ${progress.target}`;
    return <aside ref={tabRef} className={`objective-tab ${open ? 'is-open' : ''} ${achieved ? 'is-achieved' : ''} ${finished && !achieved ? 'is-failed' : ''}`} aria-label="Ваша тайная цель"
        onPointerEnter={event => { if (event.pointerType === 'mouse') { openedByHover.current = true; setOpen(true); } }}
        onPointerLeave={event => { if (event.pointerType === 'mouse') { openedByHover.current = false; setOpen(false); } }}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
        onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); tabRef.current?.querySelector('button')?.focus(); } }}>
        <button className="objective-tab-handle" type="button" aria-expanded={open} aria-controls={cardId}
            onClick={() => { const fromHover = openedByHover.current; openedByHover.current = false; setOpen(value => fromHover || !value); }}>
            <span className="objective-tab-label">
                <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5 7V5a3 3 0 0 1 6 0v2M8 10v2" /></svg>
                Тайная цель
            </span>
            <b className="objective-tab-counter" aria-label={`${progress.label}: ${counter}`}>{counter}</b>
            <span className="objective-tab-chevron" aria-hidden="true">⌃</span>
        </button>
        <div id={cardId} className="objective-tab-card" aria-hidden={!open} inert={!open}>
            <div className="objective-tab-heading"><span className="objective-tab-label">Только для вас</span>
                <b className="objective-tab-reward">+{objective.honor} чести</b>
                <button className="objective-tab-close" type="button" aria-label="Скрыть тайную цель" onClick={() => setOpen(false)}>×</button>
            </div>
            <h3>{objective.name}</h3>
            <p className="objective-tab-condition">{objective.condition}</p>
            <div className="objective-progress-heading">
                <span>{humanity ? 'Ваши провинции / минимум' : progress.label}</span><strong>{counter}</strong>
            </div>
            {!humanity && <progress className="objective-progress-bar" value={achieved ? progress.target : Math.min(progress.current, progress.target)}
                max={progress.target} aria-label={progress.label} />}
            {progress.secondary && <div className="objective-progress-secondary"><span>{progress.secondary.label}</span>
                <b>{progress.secondary.current} / {progress.secondary.target}</b></div>}
            <div className="objective-tab-status"><b>{status}</b>{!finished && <span>Итог — в конце партии</span>}</div>
            <p className="objective-progress-detail">{progress.detail}</p>
            {progress.items.length > 0 && <div className="objective-progress-list">
                <b className="objective-progress-list-title">{objective.id === 'web_of_influence'
                    ? 'Какие территории засчитаны' : 'Какие провинции засчитаны'}</b>
                <ul>{progress.items.map(item => <li key={item.id} className={item.controlled ? 'is-controlled' : ''}>
                        <span className="objective-progress-check" aria-label={item.controlled ? 'Под вашим контролем' : 'Нет контроля'}>{item.controlled ? '✓' : '—'}</span>
                        <span>{item.name}</span>
                        {item.count !== undefined && <b title="Провинций под вашим контролем">{item.count}</b>}
                </li>)}</ul>
            </div>}
        </div>
    </aside>;
}
