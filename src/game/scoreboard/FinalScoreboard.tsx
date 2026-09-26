import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameResultView, RoomPlayer } from '../../../shared/room';

export function FinalScoreboard({ results, players }: { results: GameResultView[]; players: RoomPlayer[] }) {
    const [detail, setDetail] = useState<{ playerId: string; anchor: DOMRect } | null>(null);
    const tooltipId = useId();
    const openPlayerId = detail?.playerId;

    useEffect(() => {
        if (!openPlayerId)
            return;
        const dismiss = (event: Event) => {
            if (event.target instanceof Element && event.target.closest('.score-breakdown, .final-scoreboard article'))
                return;
            setDetail(null);
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                setDetail(null);
        };
        document.addEventListener('pointerdown', dismiss, true);
        document.addEventListener('scroll', dismiss, true);
        window.addEventListener('resize', dismiss);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('pointerdown', dismiss, true);
            document.removeEventListener('scroll', dismiss, true);
            window.removeEventListener('resize', dismiss);
            document.removeEventListener('keydown', handleKey);
        };
    }, [openPlayerId]);

    return <div className="final-scoreboard">
        {results.map(result => {
            const player = players.find(candidate => candidate.id === result.playerId);
            return <article key={result.playerId}
                className={`${result.isWinner ? 'is-winner' : ''} ${openPlayerId === result.playerId ? 'is-detail-open' : ''}`}
                tabIndex={0} aria-label={resultTooltip(result)}
                aria-describedby={openPlayerId === result.playerId ? tooltipId : undefined}
                onPointerEnter={event => {
                    if (event.pointerType === 'mouse')
                        setDetail({ playerId: result.playerId, anchor: event.currentTarget.getBoundingClientRect() });
                }}
                onPointerLeave={event => {
                    if (event.pointerType === 'mouse')
                        setDetail(null);
                }}
                onClick={event => setDetail(openPlayerId === result.playerId ? null
                    : { playerId: result.playerId, anchor: event.currentTarget.getBoundingClientRect() })}
                onFocus={event => {
                    if (event.currentTarget.matches(':focus-visible'))
                        setDetail({ playerId: result.playerId, anchor: event.currentTarget.getBoundingClientRect() });
                }}
                onBlur={event => {
                    if (!event.currentTarget.contains(event.relatedTarget))
                        setDetail(null);
                }}>
                <span>{result.isWinner ? '🏆' : `#${result.rank}`}</span>
                <div><b>{player?.name ?? 'Игрок'}</b>
                    <small>⭐ {result.provinceHonor} провинции · {result.controlHonor} контроль · {result.regionHonor} регионы</small>
                    {result.controlledRegions.length > 0 && <em>{result.controlledRegions.join(', ')}</em>}
                    {result.secretObjective && <em className={result.secretObjectiveAchieved ? 'objective-complete' : ''}>
                        🎴 {result.secretObjective.name}: {result.secretObjectiveAchieved ? `+${result.secretHonor}` : 'не выполнена'}
                    </em>}
                </div>
                <strong>{result.totalHonor}</strong>
                {detail?.playerId === result.playerId && <ScoreBreakdown id={tooltipId} anchor={detail.anchor}
                    text={resultTooltip(result)} />}
            </article>;
        })}
    </div>;
}

function ScoreBreakdown({ id, anchor, text }: { id: string; anchor: DOMRect; text: string }) {
    const popupRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ left: 12, top: 12 });

    useLayoutEffect(() => {
        const popup = popupRef.current;
        if (!popup)
            return;
        const { width, height } = popup.getBoundingClientRect();
        const below = window.innerHeight - anchor.bottom - 12;
        const above = anchor.top - 12;
        const top = height <= below || below >= above ? anchor.bottom : anchor.top - height;
        setPosition({
            left: Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12)),
            top: Math.max(12, Math.min(top, window.innerHeight - height - 12))
        });
    }, [anchor, text]);

    // Escape the side rail's scroll clipping and the phase card's backdrop-filter stacking context.
    return createPortal(<div ref={popupRef} id={id} className="score-breakdown" role="tooltip"
        style={position} onClick={event => event.stopPropagation()}>
        <pre>{text}</pre>
    </div>, document.body);
}

function resultTooltip(result: GameResultView): string {
    const lines = [
        `Итого: ${result.totalHonor} чести`,
        `Для ничьей: ${result.controlledRegions.length} регионов, ${result.provinceCount} провинций`, '',
        `Цветки в провинциях: ${result.provinceHonor}`
    ];
    appendSources(lines, result.provinceHonorSources, 'нет (Земли Теней не приносят честь)');
    lines.push('', `Открытые жетоны контроля: ${result.controlHonor}`);
    appendSources(lines, result.controlHonorSources, 'нет');
    lines.push('', `Регионы: ${result.regionHonor}`);
    appendSources(lines, result.regionHonorSources, 'нет полностью контролируемых регионов');
    lines.push('', `Тайная цель: ${result.secretHonor}`);
    if (result.secretObjective) {
        lines.push(`• ${result.secretObjective.name} — ${result.secretObjectiveAchieved ? 'выполнена' : 'не выполнена'}`);
        lines.push(`• ${result.secretObjective.condition}`);
    }
    return lines.join('\n');
}

function appendSources(lines: string[], sources: Array<{ name: string; honor: number }>, empty: string): void {
    if (sources.length === 0)
        lines.push(`• ${empty}`);
    else
        for (const source of sources)
            lines.push(`• ${source.name}: ⭐ ${source.honor}`);
}
