import type { GamePlayerView, GameViewState, RoomPlayer } from '../../../shared/room';
import { GameEventLog } from '../log/GameEventLog';
import { PHASE_LABELS } from '../presentation';
import { FinalScoreboard } from '../scoreboard/FinalScoreboard';

interface GamePhasePanelProps {
    game: GameViewState;
    players: RoomPlayer[];
    currentPlayer: RoomPlayer;
    currentStats: GamePlayerView;
    turnPlayer?: RoomPlayer;
    busy: boolean;
    canPlaceOrder: boolean;
    setupComplete: boolean;
    isRevealReady: boolean;
    scorpionActionPending: boolean;
    unicornActionPending: boolean;
    unicornSelectionCount: number;
    onPassPlacement: () => Promise<void>;
    onSetResolutionReady: (isReady: boolean) => Promise<void>;
    onAdvance: () => Promise<void>;
    onSkipScorpion: () => void;
    onSkipUnicorn: () => void;
}

export function GamePhasePanel(props: GamePhasePanelProps) {
    const { game, players, currentPlayer, currentStats, turnPlayer, busy, canPlaceOrder, setupComplete,
        isRevealReady, scorpionActionPending, unicornActionPending, unicornSelectionCount,
        onPassPlacement, onSetResolutionReady, onAdvance, onSkipScorpion, onSkipUnicorn } = props;
    return <div className="game-side-rail">
        <aside className="phase-card">
            <span className="phase-kicker">{game.stage === 'setup' ? 'Перед первым раундом' : `Раунд ${game.round}`}</span>
            <h2>{PHASE_LABELS[game.phase]}</h2>
            {game.phase === 'setup' && <>
                <p>Начиная с первого игрока, каждый ставит по одному жетону контроля в свободную провинцию.</p>
                <div className="setup-progress">{players.map(player => {
                    const stats = game.players.find(item => item.playerId === player.id)!;
                    return <span key={player.id}><b>{player.name}</b><em>{stats.setupRemaining} осталось</em></span>;
                })}</div>
            </>}
            {game.phase === 'placement' && <p>{canPlaceOrder
                ? game.canPassPlacement
                    ? 'Прямых целей для жетонов нет. Можно сыграть карту действия или пропустить оставшиеся ходы.'
                    : currentStats.isRonin
                        ? 'Вы ронин: армию можно поставить на любую сухопутную границу. Погром и дипломатия недоступны.'
                        : 'Выберите один жетон снизу, затем нажмите на подсвеченную провинцию или границу.'
                : `Ожидаем единственный приказ игрока ${turnPlayer?.name ?? '—'}.`}</p>}
            {game.phase === 'placement' && canPlaceOrder && game.canPassPlacement &&
                <button className="phase-action force-resolution" disabled={busy} onClick={onPassPlacement}>Пропустить оставшиеся ходы</button>}
            {game.phase === 'reveal' && <>
                <p>{game.clanActionPending === 'scorpion-peek'
                    ? 'Приказы пока закрыты: клан Скорпиона завершает тайный осмотр перед вскрытием.'
                    : game.clanActionPending === 'unicorn-swap'
                        ? 'Приказы пока закрыты: клан Единорога завершает манёвр перед вскрытием.'
                        : 'Все жетоны перевёрнуты. Изучите приказы соперников: исполнение начнётся, когда подтвердят все игроки.'}</p>
                {scorpionActionPending && <ClanActionPanel icon="🦂" title="Шёпот Скорпиона"
                    description="Выберите один закрытый жетон соперника на карте или пропустите способность."
                    button="Не подглядывать в этом раунде" busy={busy} onSkip={onSkipScorpion} />}
                {unicornActionPending && <ClanActionPanel icon="🦄" title="Манёвр Единорога"
                    description={unicornSelectionCount === 0 ? 'Выберите первый свой жетон на карте' : 'Теперь выберите второй жетон — они поменяются местами'}
                    button="Оставить жетоны на местах" busy={busy} onSkip={onSkipUnicorn} />}
                <div className="reveal-readiness">{players.map(player => {
                    const ready = game.readyPlayerIds.includes(player.id);
                    return <span key={player.id} className={ready ? 'is-ready' : ''}><b>{player.name}</b><em>{ready ? '✓ готов' : 'смотрит…'}</em></span>;
                })}</div>
                <div className="resolution-actions">
                    {currentPlayer.kind !== 'bot' && <button className="primary phase-action" disabled={busy || !!game.clanActionPending}
                        onClick={() => onSetResolutionReady(!isRevealReady)}>{isRevealReady ? 'Отменить готовность' : 'Готов к исполнению'}</button>}
                    {currentPlayer.isHost && <button className="phase-action force-resolution" disabled={busy}
                        onClick={onAdvance}>Продолжить без готовности всех</button>}
                </div>
            </>}
            {game.phase === 'resolution' && <p>Погромы, дипломатия и битвы рассчитаны. Изменения отмечены на карте, подробности — в журнале.</p>}
            {game.phase === 'finished' && <><p>Пятый раунд завершён. Победитель определяется по чести, затем по регионам и числу провинций.</p>
                {game.results && <FinalScoreboard results={game.results} players={players} />}</>}
            {currentPlayer.isHost && game.phase === 'setup' && <button className="primary phase-action"
                disabled={busy || !setupComplete} onClick={onAdvance}>{setupComplete ? 'Начать 1-й раунд' : 'Сначала закончите расстановку'}</button>}
            {currentPlayer.isHost && game.phase === 'resolution' && <button className="primary phase-action" disabled={busy} onClick={onAdvance}>
                {game.round === 5 ? 'Завершить игру' : `Перейти к раунду ${game.round + 1}`}
            </button>}
        </aside>
        <GameEventLog entries={game.log} />
    </div>;
}

function ClanActionPanel({ icon, title, description, button, busy, onSkip }: {
    icon: string; title: string; description: string; button: string; busy: boolean; onSkip: () => void;
}) {
    return <div className="clan-action-panel"><b>{icon} {title}</b><span>{description}</span>
        <button className="phase-action force-resolution" disabled={busy} onClick={onSkip}>{button}</button>
    </div>;
}
