import type { RoomPlayer } from '../../shared/room';
import { ClanMon } from '../components/ClanMon';
import { useLanguage } from '../i18n';
import { clanName } from './clans';

interface PlayerCardProps {
    player: RoomPlayer;
    current: boolean;
    removable: boolean;
    busy: boolean;
    onRemove: () => void;
}

export function PlayerCard({ player, current, removable, busy, onRemove }: PlayerCardProps) {
    const { language, t } = useLanguage();
    return <article className={`player-card${player.clanId ? ` clan-theme-${player.clanId}` : ''}`} role="listitem">
        {player.clanId
            ? <ClanMon clanId={player.clanId} className="player-avatar player-clan-avatar" />
            : <div className="player-avatar" aria-hidden="true">{player.name.slice(0, 1).toUpperCase()}</div>}
        <div className="player-info">
            <div className="player-name"><strong>{player.name}</strong>
                {current && <span className="player-you">{language === 'ru' ? 'Вы' : 'You'}</span>}</div>
            <span>{player.isHost ? language === 'ru' ? 'Хозяин · ' : 'Host · ' : ''}{player.kind === 'bot' ? language === 'ru' ? 'Бот' : 'Bot' : language === 'ru' ? 'Игрок' : 'Player'}</span>
        </div>
        <div className={`player-clan${player.clanId ? '' : ' is-unselected'}`}>
            {player.clanId && <span>{language === 'ru' ? 'Клан' : 'Clan'}</span>}
            <strong>{player.clanId ? clanName(player.clanId, language) : t('room.chooseClan')}</strong>
        </div>
        <span className={`status ${player.isReady ? 'ready' : ''}`}>
            <span className="player-status-mark" aria-hidden="true">{player.isReady ? '✓' : ''}</span>
            {player.isReady ? t('room.ready') : t('room.notReady')}
        </span>
        <div className="player-actions">{removable && <button className="player-remove" disabled={busy} onClick={onRemove}
            aria-label={`${t('room.kick')}: ${player.name}`} title={`${t('room.kick')}: ${player.name}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="m8 8 8 8M16 8l-8 8" />
            </svg>
        </button>}</div>
    </article>;
}
