import type { GameLogEntry } from '../../../shared/room';
import './log.css';

export function GameEventLog({ entries }: { entries: GameLogEntry[] }) {
    const visibleEntries = [...entries].reverse();
    return <aside className="game-log" aria-label="Журнал событий">
        <div className="game-log-title"><span>Что произошло</span><b>Журнал раунда</b></div>
        <div className="game-log-entries">
            {visibleEntries.length === 0
                ? <p>События появятся после вскрытия первых приказов.</p>
                : visibleEntries.map(entry => <article key={entry.id} className={`log-entry log-${entry.type}`}>
                    <i>{logSymbol(entry.type)}</i>
                    <div><small>Раунд {entry.round}</small><span>{entry.message}</span></div>
                </article>)}
        </div>
    </aside>;
}

function logSymbol(type: GameLogEntry['type']): string {
    const symbols: Partial<Record<GameLogEntry['type'], string>> = {
        raid: '🔥', diplomacy: '☮', battle: '⚔', defense: '🛡', control: '旗', reveal: '◉', card: '✦', score: '⭐'
    };
    return symbols[type] ?? '•';
}
