import { CLAN_RULES, type RoomPlayer, type RoomState } from '../../../shared/room';
import { PHASE_LABELS, clanStyle } from '../presentation';
import { ClanBadge } from './PlayerIdentity';

interface GameHudProps {
    room: RoomState;
    currentPlayerId: string;
    onPlayerHover: (id: string | null) => void;
}

export function GameHud({ room, currentPlayerId, onPlayerHover }: GameHudProps) {
    const game = room.game!;
    const firstPlayer = room.players.find(player => player.id === game.firstPlayerId);
    return <header className="game-hud">
        <div className="round-summary"><button className="copy-room-button room-code-button"
            onClick={() => navigator.clipboard.writeText(`${location.origin}/room/${room.code}`)}
            aria-label={`Скопировать ссылку на комнату ${room.code}`} title="Скопировать ссылку на комнату">
            {room.code}
        </button><div>
            <p>{game.stage === 'setup' ? 'Подготовка к игре' : `Раунд ${game.round} / 5`}</p>
            <strong>{PHASE_LABELS[game.phase]}</strong>
        </div></div>
        <div className="first-player-banner"><small>Первый игрок</small><b>{firstPlayer?.name ?? '—'}</b></div>
        <div className="players-hud" aria-label="Игроки">
            {room.players.map(player => <HudPlayer key={player.id} player={player} room={room}
                current={player.id === currentPlayerId} active={player.id === game.turnPlayerId}
                first={player.id === game.firstPlayerId} onHover={onPlayerHover} />)}
        </div>
    </header>;
}

function HudPlayer({ player, room, current, active, first, onHover }: {
    player: RoomPlayer;
    room: RoomState;
    current: boolean;
    active: boolean;
    first: boolean;
    onHover: (id: string | null) => void;
}) {
    const stats = room.game?.players.find(item => item.playerId === player.id);
    const clanRule = player.clanId ? CLAN_RULES[player.clanId] : null;
    return <article className={`hud-player ${current ? 'is-current' : ''} ${active ? 'is-active' : ''}`} style={clanStyle(player)}
        tabIndex={0} onPointerEnter={() => onHover(player.id)} onPointerLeave={() => onHover(null)}>
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
            <span>Жетоны в активе: {stats?.handCount ?? 0}</span><span>Личный запас: {stats?.stockCount ?? 0}</span>
            <span>Сброс: {stats?.discardCount ?? 0}</span><span>Провинции: {stats?.provinceCount ?? 0}</span>
            {stats?.isRonin && <span>Статус: ронин{stats.skipsPlacement ? ', пропускает размещение' : ''}</span>}
            <span>Контроль на подготовке: {stats?.setupRemaining ?? 0}</span>
            {clanRule && <div className="clan-rule-preview"><strong>{clanRule.name}</strong><span>{clanRule.ability}</span>
                <em>Особый жетон: {clanRule.uniqueToken.label}</em></div>}
            <em>Владения и приказы игрока увеличены на карте</em>
        </div>
    </article>;
}
