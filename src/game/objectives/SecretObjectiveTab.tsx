import type { GameViewState } from '../../../shared/room';

export function SecretObjectiveTab({ objective, achieved, finished }: {
    objective: GameViewState['secretObjective']; achieved: boolean; finished: boolean;
}) {
    if (!objective)
        return null;
    const status = achieved ? '✓ выполнена' : finished ? '✕ не выполнена' : '○ в процессе';
    return <details className={`objective-tab ${achieved ? 'is-achieved' : ''} ${finished && !achieved ? 'is-failed' : ''}`}>
        <summary className="objective-tab-handle">
            <span className="objective-tab-heading">
                <span className="objective-tab-label">
                    <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5 7V5a3 3 0 0 1 6 0v2M8 10v2" /></svg>
                    Тайная цель
                </span>
                <b>{status}</b>
            </span>
            <span className="objective-tab-title"><strong>{objective.name}</strong><span className="objective-tab-chevron" aria-hidden="true">⌄</span></span>
            <span className="objective-tab-reward">+{objective.honor} чести</span>
        </summary>
        <div className="objective-tab-card">
            <small>Условие цели</small><p>{objective.condition}</p>
            <span>{achieved ? 'Условие выполнено' : finished
                ? 'Условие не выполнено к концу партии' : 'Проверяется в конце партии'}</span>
        </div>
    </details>;
}
