import { useEffect, useState, type CSSProperties } from 'react';
import {
    CLANS,
    type BattleTokenType,
    type BattleTokenView,
    type ClanId,
    type OrderTarget,
    type RoomPlayer,
    type RoomState
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

const CLAN_MON: Record<ClanId, string> = {
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
    setup: 'Подготовка к игре',
    placement: 'Размещение приказов',
    resolution: 'Открытие и разрешение',
    finished: 'Игра завершена'
};

export function GameBoard(props: GameBoardProps) {
    const { room, currentPlayerId, busy, error, onAdvance, onPlaceOrder } = props;
    const game = room.game;
    const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
    const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);

    useEffect(() => {
        if (!game?.hand.some(token => token.id === selectedTokenId))
            setSelectedTokenId(null);
    }, [game?.hand, selectedTokenId]);

    if (!game)
        return null;

    const currentPlayer = room.players.find(player => player.id === currentPlayerId)!;
    const turnPlayer = room.players.find(player => player.id === game.turnPlayerId);
    const firstPlayer = room.players.find(player => player.id === game.firstPlayerId);
    const selectedToken = game.hand.find(token => token.id === selectedTokenId) ?? null;
    const isMyTurn = game.turnPlayerId === currentPlayerId && game.phase === 'placement';
    const isHost = currentPlayer.isHost;

    async function place(target: OrderTarget) {
        if (!selectedToken || !isMyTurn || busy)
            return;
        setSelectedTokenId(null);
        await onPlaceOrder(selectedToken.id, target);
    }

    return <main className="game-screen">
        <header className="game-hud">
            <div className="round-summary">
                <span className="game-mon">戦</span>
                <div>
                    <p>{game.stage === 'setup' ? 'Подготовка' : `Раунд ${game.round} / 5`}</p>
                    <strong>{PHASE_LABELS[game.phase]}</strong>
                </div>
                <div className="turn-summary">
                    <small>{turnPlayer ? 'Сейчас ходит' : 'Первый игрок'}</small>
                    <b>{turnPlayer?.name ?? firstPlayer?.name ?? '—'}</b>
                </div>
            </div>

            <div className="players-hud" aria-label="Игроки">
                {room.players.map(player => <HudPlayer key={player.id} player={player} room={room}
                    current={player.id === currentPlayerId} active={player.id === game.turnPlayerId}
                    first={player.id === game.firstPlayerId}
                    onHover={setHoveredPlayerId} />)}
            </div>

            <button className="copy-room-button" onClick={() => navigator.clipboard.writeText(`${location.origin}/room/${room.code}`)}>
                Комната {room.code}
            </button>
        </header>

        <section className="game-stage" aria-label="Игровой стол">
            <div className="map-frame">
                <ProvinceMap game={game} players={room.players} currentPlayerId={currentPlayerId}
                    hoveredPlayerId={hoveredPlayerId} selectedToken={selectedToken}
                    disabled={!isMyTurn || busy} onTarget={place} />
            </div>

            <aside className="phase-card">
                <span className="phase-kicker">{game.stage === 'setup' ? 'Перед первым раундом' : `Раунд ${game.round}`}</span>
                <h2>{PHASE_LABELS[game.phase]}</h2>
                {game.phase === 'setup' && <p>Первый игрок выбран случайно. Когда все готовы, хозяин начинает первый раунд.</p>}
                {game.phase === 'placement' && <p>{isMyTurn
                    ? 'Выберите жетон снизу, затем нажмите на подсвеченную провинцию или границу.'
                    : `Ожидаем ход игрока ${turnPlayer?.name ?? '—'}.`}</p>}
                {game.phase === 'resolution' && <p>Все приказы открыты. Использованные жетоны уйдут в сброс, пустые вернутся владельцам.</p>}
                {game.phase === 'finished' && <p>Пятый раунд завершён. Подсчёт очков станет следующим игровым этапом.</p>}

                {isHost && game.phase === 'setup' && <button className="primary phase-action" disabled={busy} onClick={onAdvance}>
                    Начать 1-й раунд
                </button>}
                {isHost && game.phase === 'resolution' && <button className="primary phase-action" disabled={busy} onClick={onAdvance}>
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
                    <small>{isMyTurn ? 'Ваш ход: выберите приказ' : phaseStatus(game.phase, turnPlayer?.name)}</small>
                </div>
            </div>

            <div className="token-hand">
                {game.hand.map(token => <OrderToken key={token.id} token={token}
                    selected={token.id === selectedTokenId}
                    disabled={!isMyTurn || busy}
                    onClick={() => setSelectedTokenId(token.id === selectedTokenId ? null : token.id)} />)}
                {game.phase === 'setup' && <div className="empty-hand">Жетоны будут выданы в начале раунда: 1 пустой + 5 из активного запаса.</div>}
                {game.phase === 'finished' && <div className="empty-hand">Матч завершён.</div>}
            </div>

            <div className="rack-note">
                <strong>{selectedToken ? TOKEN_INFO[selectedToken.type].label : `${game.hand.length} жетонов`}</strong>
                <span>{selectedToken ? TOKEN_INFO[selectedToken.type].hint : 'Пять размещаются, один остаётся за ширмой'}</span>
            </div>
        </section>

        {error && <p className="game-error">{error}</p>}
    </main>;
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
    const style = { '--clan-accent': player.clanId ? CLAN_COLORS[player.clanId] : '#8b7566' } as CSSProperties;
    return <article className={`hud-player ${current ? 'is-current' : ''} ${active ? 'is-active' : ''}`} style={style}
        onPointerEnter={() => onHover(player.id)} onPointerLeave={() => onHover(null)}>
        <ClanBadge player={player} />
        <div className="hud-player-copy">
            <span>{first ? 'Первый игрок' : current ? 'Вы' : player.kind === 'bot' ? 'Бот' : 'Игрок'}</span>
            <strong>{player.name}</strong>
            <small>{stats?.provinceCount ?? 0} пров. · {stats?.placedCount ?? 0} приказ.</small>
        </div>
        <div className="player-popover">
            <b>{player.name}</b>
            <span>Жетоны: {stats?.handCount ?? 0} в руке</span>
            <span>Запас: {stats?.stockCount ?? 0}</span>
            <span>Сброс: {stats?.discardCount ?? 0}</span>
            <span>Провинции: {stats?.provinceCount ?? 0}</span>
            <em>Провинции и приказы игрока подсвечены на карте</em>
        </div>
    </article>;
}

function ClanBadge({ player }: { player: RoomPlayer }) {
    const clan = CLANS.find(item => item.id === player.clanId);
    const style = { '--clan-accent': player.clanId ? CLAN_COLORS[player.clanId] : '#8b7566' } as CSSProperties;
    return <div className="clan-badge" style={style} title={clan ? `Клан ${clan.name}` : 'Клан'}>
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

function phaseStatus(phase: string, turnName?: string): string {
    if (phase === 'setup')
        return 'Ожидайте начала первого раунда';
    if (phase === 'resolution')
        return 'Приказы открыты';
    if (phase === 'finished')
        return 'Матч завершён';
    return `Ход игрока ${turnName ?? '—'}`;
}
