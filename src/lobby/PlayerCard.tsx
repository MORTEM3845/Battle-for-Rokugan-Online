import type { RoomPlayer } from '../../shared/room';
import { ClanMon } from '../components/ClanMon';
import { useLanguage } from '../i18n';
import { clanName } from './clans';

interface PlayerCardProps {
    player: RoomPlayer;
    removable: boolean;
    busy: boolean;
    onRemove: () => void;
}

export function PlayerCard({ player, removable, busy, onRemove }: PlayerCardProps) {
    const { language, t } = useLanguage();
    return <article className="player-card">
        {player.clanId
            ? <ClanMon clanId={player.clanId} className="player-avatar player-clan-avatar" />
            : <div className="player-avatar">{player.kind === 'bot' ? 'AI' : player.name.slice(0, 1).toUpperCase()}</div>}
        <div className="player-info">
            <strong>{player.name}</strong>
            <span>{player.isHost ? language === 'ru' ? 'Хозяин · ' : 'Host · ' : ''}{player.kind === 'bot' ? language === 'ru' ? 'Бот' : 'Bot' : language === 'ru' ? 'Игрок' : 'Player'}</span>
            <span>{player.clanId ? `${language === 'ru' ? 'Клан' : 'Clan'} ${clanName(player.clanId, language)}` : t('room.chooseClan')}</span>
        </div>
        <span className={`status ${player.isReady ? 'ready' : ''}`}>{player.isReady ? t('room.ready') : t('room.notReady')}</span>
        {removable && <button className="danger small" disabled={busy} onClick={onRemove}>{t('room.kick')}</button>}
    </article>;
}
