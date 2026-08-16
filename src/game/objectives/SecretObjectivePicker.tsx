import type { SecretObjectiveId } from '../../../shared/objectives';
import type { GameViewState, RoomPlayer, RoomState } from '../../../shared/room';

interface SecretObjectivePickerProps {
    room: RoomState;
    game: GameViewState;
    currentPlayer: RoomPlayer;
    busy: boolean;
    error: string;
    onChoose: (objectiveId: SecretObjectiveId) => Promise<void>;
}

export function SecretObjectivePicker({ room, game, currentPlayer, busy, error, onChoose }: SecretObjectivePickerProps) {
    return <main className="game-screen objective-selection-screen">
        <section className="objective-selection">
            <span className="phase-kicker">Перед начальной расстановкой</span>
            <h1>Выберите тайную цель</h1>
            <p>В конце пятого раунда цель раскроется и принесёт указанную честь, если условие выполнено.</p>
            {game.secretObjectiveOptions.length > 0
                ? <div className="objective-options">
                    {game.secretObjectiveOptions.map(objective => <button key={objective.id} className="secret-objective-card"
                        disabled={busy} onClick={() => onChoose(objective.id)}>
                        <small>Тайная цель</small><strong>{objective.name}</strong><span>{objective.condition}</span><b>⭐ +{objective.honor}</b>
                    </button>)}
                </div>
                : <div className="objective-waiting"><b>Ваша цель выбрана и скрыта.</b><span>Ожидаем остальных игроков…</span></div>}
            <div className="objective-readiness">
                {room.players.map(player => {
                    const stats = game.players.find(candidate => candidate.playerId === player.id);
                    return <span key={player.id} className={stats?.hasSecretObjective ? 'is-ready' : ''}>
                        <b>{player.id === currentPlayer.id ? `${player.name} (вы)` : player.name}</b>
                        <em>{stats?.hasSecretObjective ? '✓ выбрана' : 'выбирает…'}</em>
                    </span>;
                })}
            </div>
            {error && <p className="game-error">{error}</p>}
        </section>
    </main>;
}
