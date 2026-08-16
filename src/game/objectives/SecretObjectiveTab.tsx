import type { GameViewState } from '../../../shared/room';

export function SecretObjectiveTab({ objective, achieved, finished }: {
    objective: GameViewState['secretObjective']; achieved: boolean; finished: boolean;
}) {
    if (!objective)
        return null;
    const status = achieved ? '✓ выполнена' : finished ? '✕ не выполнена' : '○ в процессе';
    return <aside className={`objective-tab ${achieved ? 'is-achieved' : ''} ${finished && !achieved ? 'is-failed' : ''}`} tabIndex={0}>
        <div className="objective-tab-handle"><span>🎴 Тайная цель</span><b>{status}</b></div>
        <div className="objective-tab-card">
            <small>Только для вас</small><strong>{objective.name}</strong><p>{objective.condition}</p>
            <div><b>⭐ +{objective.honor}</b><span>{achieved ? 'Условие выполнено' : finished
                ? 'Условие не выполнено к концу партии' : 'Условие пока не выполнено'}</span></div>
        </div>
    </aside>;
}
