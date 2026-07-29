import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
    CLANS,
    type BattleTokenType,
    type BattleTokenView,
    type ClanId,
    type OrderTarget,
    type RoomPlayer,
    type RoomState,
    type TokenPoolCountView
} from '../../shared/room';
import { ProvinceMap } from './ProvinceMap';
import './game.css';

interface GameBoardProps {
    room: RoomState;
    currentPlayerId: string;
    busy: boolean;
    error: string;
    onAdvance: () => Promise<void>;
    onPlaceOrder: (tokenId: string, target: OrderTarget) => Promise<void>;
    onPlaceControl: (provinceId: string) => Promise<void>;
    onBotTurn: () => Promise<void>;
}

export const CLAN_COLORS: Record<ClanId, string> = {
    crab: '#47759d',
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
    raid: { symbol: '火', label: 'Погром', hint: 'Чужая соседняя провинция' },
    blank: { symbol: '空', label: 'Пустой', hint: 'Имитирует любой приказ, кроме благословения' }
};

const PHASE_LABELS = {
    setup: 'Начальная расстановка',
    placement: 'Размещение приказов',
    resolution: 'Открытие и разрешение',
    finished: 'Игра завершена'
};

export function GameBoard(props: GameBoardProps) {
    const { room, currentPlayerId, busy, error, onAdvance, onPlaceOrder, onPlaceControl, onBotTurn } = props;
    const game = room.game;
    const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
    const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);
    const handledBotTurn = useRef('');

    useEffect(() => {
        if (!game?.hand.some(token => token.id === selectedTokenId))
            setSelectedTokenId(null);
    }, [game?.hand, selectedTokenId]);

    const turnPlayer = room.players.find(player => player.id === game?.turnPlayerId);
    const turnProgress = game?.phase === 'setup'
        ? game.players.map(player => player.setupRemaining).join('-')
        : game?.players.map(player => player.placedCount).join('-');
    const botTurnKey = game && turnPlayer?.kind === 'bot'
        ? `${game.phase}:${game.round}:${turnPlayer.id}:${turnProgress}`
        : '';

    useEffect(() => {
        const currentPlayer = room.players.find(player => player.id === currentPlayerId);
        if (!botTurnKey || !currentPlayer?.isHost || busy || handledBotTurn.current === botTurnKey)
            return;

        handledBotTurn.current = botTurnKey;
        const timer = window.setTimeout(() => void onBotTurn(), 700);
        return () => clearTimeout(timer);
    }, [botTurnKey, busy, currentPlayerId, onBotTurn, room.players]);

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

    async function placeOrder(target: OrderTarget) {
        if (!selectedToken || !canPlaceOrder || busy)
            return;
        setSelectedTokenId(null);
        await onPlaceOrder(selectedToken.id, target);
    }

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

        <div className={`turn-banner ${isMyTurn ? 'is-yours' : ''}`}>
            <span>{isMyTurn ? 'Ваш ход' : `Ходит ${turnPlayer?.name ?? '—'}`}</span>
            <b>{game.phase === 'setup'
                ? `Разместить жетон контроля · осталось ${currentStats.setupRemaining}`
                : game.phase === 'placement'
                    ? `Приказ ${currentStats.placedCount + 1} из 5`
                    : PHASE_LABELS[game.phase]}</b>
        </div>

        <section className="game-stage" aria-label="Игровой стол">
            <TokenLedger rows={game.tokenPool} />

            <div className="map-frame">
                <ProvinceMap game={game} players={room.players} currentPlayerId={currentPlayerId}
                    hoveredPlayerId={hoveredPlayerId} selectedToken={selectedToken}
                    orderPlacementDisabled={!canPlaceOrder || busy}
                    controlPlacementActive={canPlaceControl && !busy}
                    onTarget={placeOrder} onPlaceControl={onPlaceControl} />
            </div>

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
                    ? 'Выберите один жетон снизу, затем нажмите на подсвеченную провинцию или границу.'
                    : `Ожидаем единственный приказ игрока ${turnPlayer?.name ?? '—'}.`}</p>}
                {game.phase === 'resolution' && <p>Все приказы открыты. Использованные жетоны уйдут в сброс, пустой вернётся владельцу.</p>}
                {game.phase === 'finished' && <p>Пятый раунд завершён. Разрешение боёв и итоговый подсчёт будут следующим этапом.</p>}

                {currentPlayer.isHost && game.phase === 'setup' && <button className="primary phase-action"
                    disabled={busy || !setupComplete} onClick={onAdvance}>
                    {setupComplete ? 'Начать 1-й раунд' : 'Сначала закончите расстановку'}
                </button>}
                {currentPlayer.isHost && game.phase === 'resolution' && <button className="primary phase-action" disabled={busy} onClick={onAdvance}>
                    {game.round === 5 ? 'Завершить игру' : `Перейти к раунду ${game.round + 1}`}
                </button>}
            </aside>
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
                {game.phase !== 'setup' && game.hand.map(token => <OrderToken key={token.id} token={token}
                    selected={token.id === selectedTokenId} disabled={!canPlaceOrder || busy}
                    onClick={() => setSelectedTokenId(token.id === selectedTokenId ? null : token.id)} />)}
                {game.phase === 'finished' && <div className="empty-hand">Матч завершён.</div>}
            </div>

            <div className="rack-note">
                <strong>{selectedToken ? TOKEN_INFO[selectedToken.type].label : game.phase === 'setup'
                    ? 'Начальные владения' : `${game.hand.length} жетонов в активе`}</strong>
                <span>{selectedToken ? TOKEN_INFO[selectedToken.type].hint : game.phase === 'setup'
                    ? 'Квадратный жетон с гербом означает контроль провинции'
                    : 'Пять размещаются по очереди, один остаётся за ширмой'}</span>
            </div>
        </section>

        {error && <p className="game-error">{error}</p>}
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
                <span><i>{TOKEN_INFO[row.type].symbol}</i>{TOKEN_INFO[row.type].label}{row.strength !== null ? ` ${row.strength}` : ''}
                    {row.specialTotal > 0 && <em title="Клановый жетон">+{row.specialTotal} особ.</em>}</span>
                <b>{row.stock}</b><b>{row.hand}</b><b>{row.discard}</b><b>{row.placed}</b>
            </div>)}
        </div>
        <div className="ledger-total"><span>Всего</span><b>{totals.stock}</b><b>{totals.hand}</b><b>{totals.discard}</b><b>{totals.placed}</b></div>
        <p>Обычный набор одинаков у всех. Клановый жетон отмечен отдельно.</p>
    </aside>;
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
                `${stats?.provinceCount ?? 0} пров. · ${stats?.placedCount ?? 0}/5`}</small>
        </div>
        <div className="player-popover">
            <b>{player.name}</b>
            <span>Жетоны в активе: {stats?.handCount ?? 0}</span>
            <span>Личный запас: {stats?.stockCount ?? 0}</span>
            <span>Сброс: {stats?.discardCount ?? 0}</span>
            <span>Провинции: {stats?.provinceCount ?? 0}</span>
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
        {token.isClanSpecial && <em>Клановый</em>}
    </button>;
}

function clanStyle(player: RoomPlayer): CSSProperties {
    return { '--clan-accent': player.clanId ? CLAN_COLORS[player.clanId] : '#8b7566' } as CSSProperties;
}

function phaseStatus(phase: string, turnName?: string): string {
    if (phase === 'setup')
        return `Расставляет ${turnName ?? '—'}`;
    if (phase === 'resolution')
        return 'Приказы открыты';
    if (phase === 'finished')
        return 'Матч завершён';
    return `Ход игрока ${turnName ?? '—'}`;
}
