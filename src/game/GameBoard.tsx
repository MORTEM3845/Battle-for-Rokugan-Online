import type { CSSProperties } from 'react';
import { CLANS, type ClanId, type RoomPlayer, type RoomState } from '../../shared/room';
import { ProvinceMap } from './ProvinceMap';
import './game.css';

interface GameBoardProps {
    room: RoomState;
    currentPlayerId: string;
}

const clanColors: Record<ClanId, string> = {
    crab: '#47759d',
    crane: '#91d8ec',
    dragon: '#4b9b62',
    lion: '#d6a83d',
    phoenix: '#de7338',
    scorpion: '#be3f3c',
    unicorn: '#8e63bb'
};

export function GameBoard({ room, currentPlayerId }: GameBoardProps) {
    const currentPlayer = room.players.find(player => player.id === currentPlayerId) ?? room.players[0];
    const opponents = room.players.filter(player => player.id !== currentPlayer?.id);
    const inviteUrl = `${location.origin}/room/${room.code}`;

    return <main className="game-screen">
        <header className="game-toolbar">
            <div className="game-title">
                <span className="game-mon">戦</span>
                <div><p>Битва за Рокуган</p><strong>Комната {room.code}</strong></div>
            </div>
            <div className="game-phase">
                <span>Раунд</span>
                <strong>1 <small>/ 5</small></strong>
                <em>Подготовка карты</em>
            </div>
            <button className="copy-room-button" onClick={() => navigator.clipboard.writeText(inviteUrl)}>Скопировать код</button>
        </header>

        <section className="game-table" aria-label="Игровой стол">
            <div className="seat seat-top"><PlayerSeat player={opponents[0]} /></div>
            <div className="seat seat-left"><PlayerSeat player={opponents[1]} compact /></div>
            <div className="map-place">
                <div className="map-frame">
                    <ProvinceMap />
                </div>
                <p className="map-hint">Наведите на область, чтобы подсветить её. Щёлкните, чтобы оставить выбранной.</p>
            </div>
            <div className="seat seat-right"><PlayerSeat player={opponents[2]} compact /></div>
            <div className="seat seat-bottom"><PlayerSeat player={currentPlayer} current /></div>
        </section>

        <section className="order-rack" aria-label="Жетоны приказов">
            <div className="rack-caption"><span>Ваши приказы</span><small>Игровая логика жетонов будет подключена следующим этапом</small></div>
            <div className="order-tokens">
                <OrderToken symbol="攻" label="Армия" tone="red" />
                <OrderToken symbol="援" label="Поддержка" tone="gold" />
                <OrderToken symbol="海" label="Флот" tone="blue" />
                <OrderToken symbol="忍" label="Синоби" tone="violet" />
                <OrderToken symbol="空" label="Пустой" tone="ash" />
            </div>
        </section>
    </main>;
}

function PlayerSeat({ player, current, compact }: { player?: RoomPlayer; current?: boolean; compact?: boolean }) {
    if (!player)
        return <div className={`table-player empty ${compact ? 'compact' : ''}`}><span className="empty-seat-mark">空</span><small>Свободное место</small></div>;

    const clan = CLANS.find(item => item.id === player.clanId);
    const accent = player.clanId ? clanColors[player.clanId] : '#8b7566';
    const style = { '--clan-accent': accent } as CSSProperties;

    return <article className={`table-player ${current ? 'current' : ''} ${compact ? 'compact' : ''}`} style={style}>
        <div className="table-avatar">{player.kind === 'bot' ? 'AI' : player.name.slice(0, 1).toUpperCase()}</div>
        <div className="table-player-copy">
            <span>{current ? 'Ваш ход' : player.kind === 'bot' ? 'Соперник · Бот' : 'Соперник'}</span>
            <strong>{player.name}</strong>
            <small>{clan ? `Клан ${clan.name}` : 'Без клана'}</small>
        </div>
        <div className="honor-counter"><span>Честь</span><strong>0</strong></div>
    </article>;
}

function OrderToken({ symbol, label, tone }: { symbol: string; label: string; tone: string }) {
    return <button className={`order-token token-${tone}`} type="button" aria-label={label} title={label}>
        <span>{symbol}</span><small>{label}</small>
    </button>;
}
