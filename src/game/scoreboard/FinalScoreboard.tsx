import type { GameResultView, RoomPlayer } from '../../../shared/room';

export function FinalScoreboard({ results, players }: { results: GameResultView[]; players: RoomPlayer[] }) {
    return <div className="final-scoreboard">
        {results.map(result => {
            const player = players.find(candidate => candidate.id === result.playerId);
            return <article key={result.playerId} className={result.isWinner ? 'is-winner' : ''}
                tabIndex={0} aria-label={resultTooltip(result)}>
                <span>{result.isWinner ? '🏆' : `#${result.rank}`}</span>
                <div><b>{player?.name ?? 'Игрок'}</b>
                    <small>⭐ {result.provinceHonor} провинции · {result.controlHonor} контроль · {result.regionHonor} регионы</small>
                    {result.controlledRegions.length > 0 && <em>{result.controlledRegions.join(', ')}</em>}
                    {result.secretObjective && <em className={result.secretObjectiveAchieved ? 'objective-complete' : ''}>
                        🎴 {result.secretObjective.name}: {result.secretObjectiveAchieved ? `+${result.secretHonor}` : 'не выполнена'}
                    </em>}
                </div>
                <strong>{result.totalHonor}</strong>
                <div className="score-breakdown" role="tooltip"><pre>{resultTooltip(result)}</pre></div>
            </article>;
        })}
    </div>;
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
