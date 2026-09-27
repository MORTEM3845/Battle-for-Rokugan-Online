import { CLAN_RULES, type RoomPlayer, type RoomState } from '../../../shared/room';
import { PHASE_LABELS, clanStyle } from '../presentation';
import { ClanBadge } from './PlayerIdentity';
import { CopyRoomLinkButton } from '../../components/CopyRoomLinkButton';

interface GameHudProps {
    room: RoomState;
    currentPlayerId: string;
    onPlayerHover: (id: string | null) => void;
}

export function GameHud({ room, currentPlayerId, onPlayerHover }: GameHudProps) {
    const game = room.game!;
    const firstPlayer = room.players.find(player => player.id === game.firstPlayerId);
    return <header className="game-hud">
        <div className="round-summary"><CopyRoomLinkButton className="copy-room-button room-code-button"
            url={`${location.origin}/room/${room.code}`}
            aria-label={`Скопировать ссылку на комнату ${room.code}`} title="Скопировать ссылку на комнату">
            {room.code}
        </CopyRoomLinkButton><div className="round-summary-copy">
            <p>{game.stage === 'setup' ? 'Подготовка к игре' : `Раунд ${game.round} / 5`}</p>
            <strong>{PHASE_LABELS[game.phase]}</strong>
        </div></div>
        <div className="first-player-banner"><small>Первый игрок</small><b>{firstPlayer?.name ?? '—'}</b></div>
        <div className="players-hud" aria-label="Игроки">
            {room.players.map(player => <HudPlayer key={player.id} player={player} room={room}
                current={player.id === currentPlayerId} active={player.id === game.turnPlayerId}
                onHover={onPlayerHover} />)}
        </div>
    </header>;
}

function HudPlayer({ player, room, current, active, onHover }: {
    player: RoomPlayer;
    room: RoomState;
    current: boolean;
    active: boolean;
    onHover: (id: string | null) => void;
}) {
    const stats = room.game?.players.find(item => item.playerId === player.id);
    const clanRule = player.clanId ? CLAN_RULES[player.clanId] : null;
    return <article className={`hud-player ${current ? 'is-current' : ''} ${active ? 'is-active' : ''}`} style={clanStyle(player)}
        tabIndex={0} onPointerEnter={() => onHover(player.id)} onPointerLeave={() => onHover(null)}>
        <ClanBadge player={player} />
        <div className="hud-player-copy">
            <strong title={player.name}>{player.name}</strong>
            <small>{stats?.provinceCount ?? 0} пров.</small>
        </div>
        <div className="player-popover">
            <b>{player.name}</b>
            {player.id === room.game?.firstPlayerId && <span>Первый игрок</span>}
            <span>Жетоны в активе: {stats?.handCount ?? 0}</span><span>Личный запас: {stats?.stockCount ?? 0}</span>
            <span>Сброс: {stats?.discardCount ?? 0}</span><span>Провинции: {stats?.provinceCount ?? 0}</span>
            <span>Размещено приказов: {stats?.placedCount ?? 0}/5</span>
            {stats?.isRonin && <span>Статус: ронин{stats.skipsPlacement ? ', пропускает размещение' : ''}</span>}
            <span>Контроль на подготовке: {stats?.setupRemaining ?? 0}</span>
            {clanRule && <div className="clan-rule-preview"><strong>{clanRule.name}</strong><span>{clanRule.ability}</span>
                <em>Особый жетон: {clanRule.uniqueToken.label}</em></div>}
            <em>Владения и полные регионы игрока подсвечены на карте</em>
        </div>
    </article>;
}
