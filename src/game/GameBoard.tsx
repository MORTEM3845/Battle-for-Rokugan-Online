import { useEffect, useState, type CSSProperties } from 'react';
import {
    CLANS,
    type ActionCardType,
    type ActionCardHandView,
    type BattleTokenType,
    type BattleTokenView,
    type ClanId,
    type GameLogEntry,
    type GamePhase,
    type GameResultView,
    type GameViewState,
    type OrderTarget,
    type RoomPlayer,
    type RoomState,
    type TokenPoolCountView
} from '../../shared/room';
import type { SecretObjectiveId } from '../../shared/objectives';
import { ProvinceMap } from './ProvinceMap';
import './game.css';

interface GameBoardProps {
    room: RoomState;
    currentPlayerId: string;
    busy: boolean;
    error: string;
    onAdvance: () => Promise<void>;
    onChooseSecretObjective: (objectiveId: SecretObjectiveId) => Promise<void>;
    onSetResolutionReady: (isReady: boolean) => Promise<void>;
    onPlayScout: (orderId: string) => Promise<void>;
    onPlayShugenja: (orderId: string) => Promise<void>;
    onPassPlacement: () => Promise<void>;
    onPlaceOrder: (tokenId: string, target: OrderTarget) => Promise<void>;
    onPlaceControl: (provinceId: string) => Promise<void>;
}

export const CLAN_COLORS: Record<ClanId, string> = {
    crab: '#e8e5dc',
    crane: '#91d8ec',
    dragon: '#4b9b62',
    lion: '#d6a83d',
    phoenix: '#de7338',
    scorpion: '#be3f3c',
    unicorn: '#8e63bb'
};

export const CLAN_MON: Record<ClanId, string> = {
    crab: '蟹',
    crane: '鶴',
    dragon: '龍',
    lion: '獅',
    phoenix: '鳳',
    scorpion: '蠍',
    unicorn: '麒'
};

export const TOKEN_INFO: Record<BattleTokenType, { symbol: string; label: string; hint: string }> = {
    army: { symbol: '兵', label: 'Армия', hint: 'Своя провинция или сухопутная граница' },
    fleet: { symbol: '船', label: 'Флот', hint: 'Своя прибрежная провинция или морская граница' },
    shinobi: { symbol: '忍', label: 'Синоби', hint: 'Любая провинция' },
    blessing: { symbol: '祝', label: 'Благословение', hint: 'Поверх своего боевого жетона' },
    diplomacy: { symbol: '和', label: 'Дипломатия', hint: 'Своя провинция' },
    raid: { symbol: '火', label: 'Погром', hint: 'Любая чужая или ничейная провинция; условие проверится при исполнении' },
    blank: { symbol: '空', label: 'Пустой', hint: 'Имитирует любой приказ, кроме благословения' }
};

const PHASE_LABELS: Record<GamePhase, string> = {
    setup: 'Начальная расстановка',
    objectives: 'Выбор тайной цели',
    placement: 'Размещение приказов',
    reveal: 'Вскрытие приказов',
    resolution: 'Результаты раунда',
    finished: 'Игра завершена'
};

export function GameBoard(props: GameBoardProps) {
    const {
        room,
        currentPlayerId,
        busy,
        error,
        onAdvance,
        onChooseSecretObjective,
        onSetResolutionReady,
        onPlayScout,
        onPlayShugenja,
        onPassPlacement,
        onPlaceOrder,
        onPlaceControl
    } = props;
    const game = room.game;
    const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
    const [selectedActionCard, setSelectedActionCard] = useState<ActionCardType | null>(null);
    const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);

    useEffect(() => {
        if (!game?.hand.some(token => token.id === selectedTokenId))
            setSelectedTokenId(null);
    }, [game?.hand, selectedTokenId]);

    useEffect(() => {
        if (game?.phase !== 'placement' || game.turnPlayerId !== currentPlayerId)
            setSelectedActionCard(null);
    }, [currentPlayerId, game?.phase, game?.turnPlayerId]);

    const turnPlayer = room.players.find(player => player.id === game?.turnPlayerId);

    if (!game)
        return null;

    const currentPlayer = room.players.find(player => player.id === currentPlayerId)!;
    const currentStats = game.players.find(player => player.playerId === currentPlayerId)!;
    const firstPlayer = room.players.find(player => player.id === game.firstPlayerId);
    const selectedToken = game.hand.find(token => token.id === selectedTokenId) ?? null;
    const isMyTurn = game.turnPlayerId === currentPlayerId;
    const canPlaceOrder = isMyTurn && game.phase === 'placement';
    const canPlaceControl = isMyTurn && game.phase === 'setup' && currentStats.setupRemaining > 0;
    const setupComplete = game.players.every(player => player.setupRemaining === 0);
    const isRevealReady = game.readyPlayerIds.includes(currentPlayerId);

    async function placeOrder(target: OrderTarget) {
        if (!selectedToken || !canPlaceOrder || busy)
            return;
        setSelectedTokenId(null);
        await onPlaceOrder(selectedToken.id, target);
    }

    async function playActionCard(orderId: string) {
        if (!selectedActionCard || !canPlaceOrder || busy)
            return;
        const card = selectedActionCard;
        setSelectedActionCard(null);
        if (card === 'scout')
            await onPlayScout(orderId);
        else
            await onPlayShugenja(orderId);
    }

    if (game.phase === 'objectives')
        return <SecretObjectivePicker room={room} game={game} busy={busy} error={error}
            currentPlayer={currentPlayer} onChoose={onChooseSecretObjective} />;

    return <main className="game-screen">
        <header className="game-hud">
            <div className="round-summary">
                <span className="game-mon">戦</span>
                <div>
                    <p>{game.stage === 'setup' ? 'Подготовка к игре' : `Раунд ${game.round} / 5`}</p>
                    <strong>{PHASE_LABELS[game.phase]}</strong>
                </div>
            </div>

            <div className="first-player-banner">
                <small>Первый игрок</small>
                <b>{firstPlayer?.name ?? '—'}</b>
            </div>

            <div className="players-hud" aria-label="Игроки">
                {room.players.map(player => <HudPlayer key={player.id} player={player} room={room}
                    current={player.id === currentPlayerId} active={player.id === game.turnPlayerId}
                    first={player.id === game.firstPlayerId} onHover={setHoveredPlayerId} />)}
            </div>

            <button className="copy-room-button" onClick={() => navigator.clipboard.writeText(`${location.origin}/room/${room.code}`)}>
                Комната {room.code}
            </button>
        </header>

        <div className={`turn-banner ${isMyTurn ? 'is-yours' : ''} ${game.phase === 'reveal' ? 'is-reveal' : ''}`}>
            <span>{game.phase === 'reveal'
                ? 'Все приказы открыты'
                : game.phase === 'resolution'
                    ? 'Раунд рассчитан'
                    : isMyTurn ? 'Ваш ход' : `Ходит ${turnPlayer?.name ?? '—'}`}</span>
            <b>{game.phase === 'setup'
                ? `Разместить жетон контроля · осталось ${currentStats.setupRemaining}`
                : game.phase === 'placement'
                    ? currentStats.skipsPlacement
                        ? 'Вы пропускаете оставшиеся ходы размещения'
                        : `Приказ ${currentStats.placedCount + 1} из 5`
                    : game.phase === 'reveal'
                        ? 'Посмотрите жетоны и подтвердите готовность'
                    : PHASE_LABELS[game.phase]}</b>
        </div>

        <section className="game-stage" aria-label="Игровой стол">
            <TokenLedger rows={game.tokenPool} />

            <div className="map-frame">
                <ProvinceMap game={game} players={room.players} currentPlayerId={currentPlayerId}
                    hoveredPlayerId={hoveredPlayerId} selectedToken={selectedActionCard ? null : selectedToken}
                    selectedActionCard={selectedActionCard}
                    orderPlacementDisabled={!canPlaceOrder || busy}
                    controlPlacementActive={canPlaceControl && !busy}
                    onTarget={placeOrder} onActionCardTarget={playActionCard}
                    onPlaceControl={onPlaceControl} />
            </div>

            <div className="game-side-rail">
                <aside className="phase-card">
                    <span className="phase-kicker">{game.stage === 'setup' ? 'Перед первым раундом' : `Раунд ${game.round}`}</span>
                    <h2>{PHASE_LABELS[game.phase]}</h2>
                    {game.phase === 'setup' && <>
                        <p>Начиная с первого игрока, каждый ставит по одному жетону контроля в свободную провинцию.</p>
                        <div className="setup-progress">
                            {room.players.map(player => {
                                const stats = game.players.find(item => item.playerId === player.id)!;
                                return <span key={player.id}><b>{player.name}</b><em>{stats.setupRemaining} осталось</em></span>;
                            })}
                        </div>
                    </>}
                    {game.phase === 'placement' && <p>{canPlaceOrder
                        ? game.canPassPlacement
                            ? 'Прямых целей для жетонов нет. Можно сыграть карту действия или пропустить оставшиеся ходы.'
                            : currentStats.isRonin
                            ? 'Вы ронин: армию можно поставить на любую сухопутную границу. Погром и дипломатия недоступны.'
                            : 'Выберите один жетон снизу, затем нажмите на подсвеченную провинцию или границу.'
                        : `Ожидаем единственный приказ игрока ${turnPlayer?.name ?? '—'}.`}</p>}
                    {game.phase === 'placement' && canPlaceOrder && game.canPassPlacement &&
                        <button className="phase-action force-resolution" disabled={busy} onClick={onPassPlacement}>
                            Пропустить оставшиеся ходы
                        </button>}
                    {game.phase === 'reveal' && <>
                        <p>Все жетоны перевёрнуты. Изучите приказы соперников: исполнение начнётся, когда подтвердят все игроки.</p>
                        <div className="reveal-readiness">
                            {room.players.map(player => {
                                const ready = game.readyPlayerIds.includes(player.id);
                                return <span key={player.id} className={ready ? 'is-ready' : ''}>
                                    <b>{player.name}</b><em>{ready ? '✓ готов' : 'смотрит…'}</em>
                                </span>;
                            })}
                        </div>
                        <div className="resolution-actions">
                            {currentPlayer.kind !== 'bot' && <button className="primary phase-action" disabled={busy}
                                onClick={() => onSetResolutionReady(!isRevealReady)}>
                                {isRevealReady ? 'Отменить готовность' : 'Готов к исполнению'}
                            </button>}
                            {currentPlayer.isHost && <button className="phase-action force-resolution" disabled={busy}
                                onClick={onAdvance}>Продолжить без готовности всех</button>}
                        </div>
                    </>}
                    {game.phase === 'resolution' && <p>Погромы, дипломатия и битвы рассчитаны. Изменения отмечены на карте, подробности — в журнале.</p>}
                    {game.phase === 'finished' && <>
                        <p>Пятый раунд завершён. Победитель определяется по чести, затем по регионам и числу провинций.</p>
                        {game.results && <FinalScoreboard results={game.results} players={room.players} />}
                    </>}

                    {currentPlayer.isHost && game.phase === 'setup' && <button className="primary phase-action"
                        disabled={busy || !setupComplete} onClick={onAdvance}>
                        {setupComplete ? 'Начать 1-й раунд' : 'Сначала закончите расстановку'}
                    </button>}
                    {currentPlayer.isHost && game.phase === 'resolution' && <button className="primary phase-action" disabled={busy} onClick={onAdvance}>
                        {game.round === 5 ? 'Завершить игру' : `Перейти к раунду ${game.round + 1}`}
                    </button>}
                </aside>
                <GameEventLog entries={game.log} />
            </div>
        </section>

        <section className="private-rack" aria-label="Ваша область">
            <div className="rack-player">
                <ClanBadge player={currentPlayer} />
                <div>
                    <span>Ваша область · скрыта от соперников</span>
                    <strong>{currentPlayer.name}</strong>
                    <small>{isMyTurn ? 'Ваш ход' : phaseStatus(game.phase, turnPlayer?.name)}</small>
                </div>
            </div>

            <div className="token-hand">
                {game.phase === 'setup' && <div className="setup-control-prompt">
                    <span className="control-token-sample" style={clanStyle(currentPlayer)}>{currentPlayer.clanId ? CLAN_MON[currentPlayer.clanId] : '?'}</span>
                    <div><b>{currentStats.setupRemaining} жетонов контроля</b><small>{canPlaceControl
                        ? 'Нажмите на любую свободную провинцию'
                        : setupComplete ? 'Вся начальная армия размещена' : `Ожидайте ход игрока ${turnPlayer?.name ?? '—'}`}</small></div>
                </div>}
                {game.phase === 'placement' && <ActionCardHand
                    cards={game.actionCards}
                    selected={selectedActionCard}
                    disabled={!canPlaceOrder || busy}
                    onSelect={card => {
                        setSelectedTokenId(null);
                        setSelectedActionCard(selectedActionCard === card ? null : card);
                    }} />}
                {game.phase !== 'setup' && game.phase !== 'finished' && game.hand.map(token => <OrderToken key={token.id} token={token}
                    selected={token.id === selectedTokenId}
                    disabled={!canPlaceOrder || busy ||
                        (currentStats.isRonin && (token.type === 'raid' || token.type === 'diplomacy'))}
                    onClick={() => {
                        setSelectedActionCard(null);
                        setSelectedTokenId(token.id === selectedTokenId ? null : token.id);
                    }} />)}
                {game.phase === 'finished' && <div className="empty-hand">Матч завершён.</div>}
            </div>

            <div className="rack-note">
                <strong>{selectedActionCard
                    ? selectedActionCard === 'scout' ? 'Разведка' : 'Сюгэндзя'
                    : selectedToken ? TOKEN_INFO[selectedToken.type].label : game.phase === 'setup'
                    ? 'Начальные владения' : `${game.hand.length} жетонов в активе`}</strong>
                <span>{selectedActionCard
                    ? selectedActionCard === 'scout'
                        ? 'Тайно посмотрите один закрытый жетон соперника.'
                        : 'Раскройте и сбросьте один не защищённый благословением жетон соперника.'
                    : selectedToken ? TOKEN_INFO[selectedToken.type].hint : game.phase === 'setup'
                    ? 'Квадратный жетон с гербом означает контроль провинции'
                    : currentStats.skipsPlacement
                        ? 'В этом раунде у вас не осталось законных размещений'
                        : currentStats.isRonin
                        ? 'Статус ронина проверяется в начале раунда; невозможные оставшиеся ходы пропускаются автоматически'
                        : 'Пять размещаются по очереди, один остаётся за ширмой'}</span>
            </div>
        </section>

        {error && <p className="game-error">{error}</p>}
    </main>;
}

function SecretObjectivePicker(props: {
    room: RoomState;
    game: GameViewState;
    currentPlayer: RoomPlayer;
    busy: boolean;
    error: string;
    onChoose: (objectiveId: SecretObjectiveId) => Promise<void>;
}) {
    const { room, game, currentPlayer, busy, error, onChoose } = props;
    const options = game.secretObjectiveOptions;

    return <main className="game-screen objective-selection-screen">
        <section className="objective-selection">
            <span className="phase-kicker">Перед начальной расстановкой</span>
            <h1>Выберите тайную цель</h1>
            <p>В конце пятого раунда цель раскроется и принесёт указанную честь, если условие выполнено.</p>

            {options.length > 0
                ? <div className="objective-options">
                    {options.map(objective => <button key={objective.id} className="secret-objective-card"
                        disabled={busy} onClick={() => onChoose(objective.id)}>
                        <small>Тайная цель</small>
                        <strong>{objective.name}</strong>
                        <span>{objective.condition}</span>
                        <b>⭐ +{objective.honor}</b>
                    </button>)}
                </div>
                : <div className="objective-waiting">
                    <b>Ваша цель выбрана и скрыта.</b>
                    <span>Ожидаем остальных игроков…</span>
                </div>}

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

function TokenLedger({ rows }: { rows: TokenPoolCountView[] }) {
    const totals = rows.reduce((result, row) => ({
        stock: result.stock + row.stock,
        hand: result.hand + row.hand,
        discard: result.discard + row.discard,
        placed: result.placed + row.placed
    }), { stock: 0, hand: 0, discard: 0, placed: 0 });

    return <aside className="token-ledger">
        <div className="ledger-title"><span>Открытая информация</span><h3>Ваши жетоны</h3></div>
        <div className="ledger-head"><span>Тип</span><b>Запас</b><b>Актив</b><b>Сброс</b><b>Поле</b></div>
        <div className="ledger-rows">
            {rows.map((row, index) => <div className="ledger-row" key={`${row.type}-${row.strength}-${index}`}>
                <span><i>{TOKEN_INFO[row.type].symbol}</i>{TOKEN_INFO[row.type].label}{row.strength !== null ? ` ${row.strength}` : ''}</span>
                <b>{row.stock}</b><b>{row.hand}</b><b>{row.discard}</b><b>{row.placed}</b>
            </div>)}
        </div>
        <div className="ledger-total"><span>Всего</span><b>{totals.stock}</b><b>{totals.hand}</b><b>{totals.discard}</b><b>{totals.placed}</b></div>
        <p>Набор жетонов одинаков у всех игроков.</p>
    </aside>;
}

function GameEventLog({ entries }: { entries: GameLogEntry[] }) {
    const visibleEntries = [...entries].reverse();

    return <aside className="game-log" aria-label="Журнал событий">
        <div className="game-log-title">
            <span>Что произошло</span>
            <b>Журнал раунда</b>
        </div>
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
    if (type === 'raid')
        return '🔥';
    if (type === 'diplomacy')
        return '☮';
    if (type === 'battle')
        return '⚔';
    if (type === 'defense')
        return '🛡';
    if (type === 'control')
        return '旗';
    if (type === 'reveal')
        return '◉';
    if (type === 'card')
        return '✦';
    if (type === 'score')
        return '⭐';
    return '•';
}

function HudPlayer(props: {
    player: RoomPlayer;
    room: RoomState;
    current: boolean;
    active: boolean;
    first: boolean;
    onHover: (id: string | null) => void;
}) {
    const { player, room, current, active, first, onHover } = props;
    const stats = room.game?.players.find(item => item.playerId === player.id);
    return <article className={`hud-player ${current ? 'is-current' : ''} ${active ? 'is-active' : ''}`} style={clanStyle(player)}
        onPointerEnter={() => onHover(player.id)} onPointerLeave={() => onHover(null)}>
        <ClanBadge player={player} />
        <div className="hud-player-copy">
            <span>{first ? 'Первый игрок' : current ? 'Вы' : player.kind === 'bot' ? 'Бот' : 'Игрок'}</span>
            <strong>{player.name}</strong>
            <small>{room.game?.phase === 'setup' ? `${stats?.setupRemaining ?? 0} контр.` :
                `${stats?.provinceCount ?? 0} пров. · ${stats?.placedCount ?? 0}/5` +
                `${stats?.isRonin ? ' · ронин' : ''}${stats?.skipsPlacement ? ' · пас' : ''}`}</small>
        </div>
        <div className="player-popover">
            <b>{player.name}</b>
            <span>Жетоны в активе: {stats?.handCount ?? 0}</span>
            <span>Личный запас: {stats?.stockCount ?? 0}</span>
            <span>Сброс: {stats?.discardCount ?? 0}</span>
            <span>Провинции: {stats?.provinceCount ?? 0}</span>
            {stats?.isRonin && <span>Статус: ронин{stats.skipsPlacement ? ', пропускает размещение' : ''}</span>}
            <span>Контроль на подготовке: {stats?.setupRemaining ?? 0}</span>
            <em>Владения и приказы игрока увеличены на карте</em>
        </div>
    </article>;
}

function ClanBadge({ player }: { player: RoomPlayer }) {
    const clan = CLANS.find(item => item.id === player.clanId);
    return <div className="clan-badge" style={clanStyle(player)} title={clan ? `Клан ${clan.name}` : 'Клан'}>
        {player.clanId ? CLAN_MON[player.clanId] : '?'}
    </div>;
}

function OrderToken(props: { token: BattleTokenView; selected: boolean; disabled: boolean; onClick: () => void }) {
    const { token, selected, disabled, onClick } = props;
    const info = TOKEN_INFO[token.type];
    return <button className={`battle-token battle-token-${token.type} ${selected ? 'is-selected' : ''}`}
        type="button" disabled={disabled} onClick={onClick} title={info.hint}>
        <span>{info.symbol}</span>
        {token.strength !== null && <b>{token.strength}</b>}
        <small>{info.label}</small>
    </button>;
}

function ActionCardHand(props: {
    cards: ActionCardHandView;
    selected: ActionCardType | null;
    disabled: boolean;
    onSelect: (card: ActionCardType) => void;
}) {
    const { cards, selected, disabled, onSelect } = props;
    return <div className="action-card-hand" aria-label="Карты действий">
        <button className={`action-card scout-card ${selected === 'scout' ? 'is-selected' : ''}`}
            disabled={disabled || cards.scout <= 0} onClick={() => onSelect('scout')}
            title="Тайно посмотреть один закрытый жетон соперника">
            <span>👁</span><b>Разведка</b><em>×{cards.scout}</em>
        </button>
        <button className={`action-card shugenja-card ${selected === 'shugenja' ? 'is-selected' : ''}`}
            disabled={disabled || cards.shugenja <= 0} onClick={() => onSelect('shugenja')}
            title="Раскрыть и сбросить один жетон соперника">
            <span>✨</span><b>Сюгэндзя</b><em>×{cards.shugenja}</em>
        </button>
    </div>;
}

function FinalScoreboard({ results, players }: { results: GameResultView[]; players: RoomPlayer[] }) {
    return <div className="final-scoreboard">
        {results.map(result => {
            const player = players.find(candidate => candidate.id === result.playerId);
            return <article key={result.playerId} className={result.isWinner ? 'is-winner' : ''}
                tabIndex={0} aria-label={resultTooltip(result)}>
                <span>{result.isWinner ? '🏆' : `#${result.rank}`}</span>
                <div>
                    <b>{player?.name ?? 'Игрок'}</b>
                    <small>
                        ⭐ {result.provinceHonor} провинции · {result.controlHonor} контроль · {result.regionHonor} регионы
                    </small>
                    {result.controlledRegions.length > 0 &&
                        <em>{result.controlledRegions.join(', ')}</em>}
                    {result.secretObjective && <em className={result.secretObjectiveAchieved ? 'objective-complete' : ''}>
                        🎴 {result.secretObjective.name}: {result.secretObjectiveAchieved ? `+${result.secretHonor}` : 'не выполнена'}
                    </em>}
                </div>
                <strong>{result.totalHonor}</strong>
                <div className="score-breakdown" role="tooltip">
                    <pre>{resultTooltip(result)}</pre>
                </div>
            </article>;
        })}
    </div>;
}

function resultTooltip(result: GameResultView): string {
    const lines = [
        `Итого: ${result.totalHonor} чести`,
        `Для ничьей: ${result.controlledRegions.length} регионов, ${result.provinceCount} провинций`,
        '',
        `Цветки в провинциях: ${result.provinceHonor}`
    ];
    if (result.provinceHonorSources.length === 0)
        lines.push('• нет (Земли Теней не приносят честь)');
    else
        for (const source of result.provinceHonorSources)
            lines.push(`• ${source.name}: ⭐ ${source.honor}`);

    lines.push('', `Открытые жетоны контроля: ${result.controlHonor}`);
    if (result.controlHonorSources.length === 0)
        lines.push('• нет');
    else
        for (const source of result.controlHonorSources)
            lines.push(`• ${source.name}: ⭐ ${source.honor}`);

    lines.push('', `Регионы: ${result.regionHonor}`);
    if (result.regionHonorSources.length === 0)
        lines.push('• нет полностью контролируемых регионов');
    else
        for (const source of result.regionHonorSources)
            lines.push(`• ${source.name}: ⭐ ${source.honor}`);

    lines.push('', `Тайная цель: ${result.secretHonor}`);
    if (result.secretObjective) {
        lines.push(`• ${result.secretObjective.name} — ${result.secretObjectiveAchieved ? 'выполнена' : 'не выполнена'}`);
        lines.push(`• ${result.secretObjective.condition}`);
    }
    return lines.join('\n');
}

function clanStyle(player: RoomPlayer): CSSProperties {
    return { '--clan-accent': player.clanId ? CLAN_COLORS[player.clanId] : '#8b7566' } as CSSProperties;
}

function phaseStatus(phase: string, turnName?: string): string {
    if (phase === 'setup')
        return `Расставляет ${turnName ?? '—'}`;
    if (phase === 'reveal')
        return 'Приказы открыты · ждём готовности';
    if (phase === 'resolution')
        return 'Результаты рассчитаны';
    if (phase === 'finished')
        return 'Матч завершён';
    return `Ход игрока ${turnName ?? '—'}`;
}
