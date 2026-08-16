import { CLANS, CLAN_RULES, type ClanId, type PlayerSession, type RoomPlayer, type RoomState } from '../../shared/room';
import { LobbyRules } from './LobbyRules';
import { CLAN_MON } from '../game/presentation';
import { useLanguage } from '../i18n';
import { navigate } from '../lib/navigation';
import { lobbyApi } from './api';

const CLAN_EN: Record<ClanId, { name: string; rule: string; ability: string; unique: string }> = {
    crab: { name: 'Crab', rule: 'Crab Resilience', ability: 'Each faceup control token grants +3 defense instead of +1.', unique: 'Fleet 3' },
    crane: { name: 'Crane', rule: 'Perfect Honor', ability: 'The Crane wins tied battles in which it has the highest tied strength.', unique: 'Extra Diplomacy' },
    dragon: { name: 'Dragon', rule: 'Dragon Foresight', ability: 'Draw one extra token, then return one non-bluff token to your reserve.', unique: 'Blessing 3' },
    lion: { name: 'Lion', rule: 'Unbreakable Lion', ability: 'The Lion bluff has defense 2 when used to defend a province.', unique: 'Army 6' },
    phoenix: { name: 'Phoenix', rule: 'Phoenix Fire', ability: 'When attacking a capital, ignore only its printed defense bonus.', unique: 'Blessing 3' },
    scorpion: { name: 'Scorpion', rule: 'Scorpion Whispers', ability: 'Once per round after placing an order, secretly inspect an enemy order.', unique: 'Shinobi 3' },
    unicorn: { name: 'Unicorn', rule: 'Unicorn Maneuver', ability: 'Before orders are revealed, swap two of your unblessed combat orders.', unique: 'Extra Raid' }
};

interface LobbyScreenProps {
    room: RoomState;
    currentPlayer: RoomPlayer;
    session: PlayerSession;
    busy: boolean;
    error: string;
    run: (action: () => Promise<RoomState>) => Promise<void>;
}

export function LobbyScreen({ room, currentPlayer, session, busy, error, run }: LobbyScreenProps) {
    const { language, t } = useLanguage();
    const isHost = currentPlayer.isHost;
    const canStart = room.players.length >= 2 && room.players.every(player => player.clanId && player.isReady);
    const inviteUrl = `${location.origin}/room/${room.code}`;

    return <main className="page lobby-page">
        <header className="lobby-header">
            <div><p className="eyebrow">{t('room.private')}</p><h1>{room.code}</h1></div>
            <div className="header-actions">
                <button onClick={() => void navigator.clipboard.writeText(inviteUrl)}>{t('room.copy')}</button>
                <button className="link-button" onClick={() => navigate('/')}>{t('room.home')}</button>
            </div>
        </header>

        <section className="panel">
            <div className="section-title">
                <div><h2>{t('room.players')}</h2><p>{room.players.length} / {room.maxPlayers}</p></div>
                {isHost && room.players.length < room.maxPlayers && <button disabled={busy}
                    onClick={() => void run(() => lobbyApi.addBot(session))}>{t('room.addBot')}</button>}
            </div>
            <div className="players-grid">
                {room.players.map(player => <PlayerCard key={player.id} player={player}
                    removable={isHost && !player.isHost} removeText={t('room.kick')}
                    onRemove={() => {
                        if (confirm(`${t('room.kickConfirm')} ${player.name}`))
                            void run(() => lobbyApi.kickPlayer(session, player.id));
                    }} />)}
            </div>
        </section>

        <section className="panel clan-selection-panel">
            <div className="section-title"><div><h2>{t('room.clans')}</h2><p>{t('room.clansHint')}</p></div></div>
            <div className="clan-grid detailed-clan-grid">
                {CLANS.map(clan => {
                    const owner = room.players.find(player => player.clanId === clan.id);
                    const selected = currentPlayer.clanId === clan.id;
                    const disabled = busy || (!!owner && owner.id !== currentPlayer.id) || currentPlayer.isReady;
                    const rule = CLAN_RULES[clan.id];
                    const en = CLAN_EN[clan.id];
                    return <button key={clan.id} className={`clan-card detailed-clan-card clan-${clan.id} ${selected ? 'selected' : ''}`}
                        disabled={disabled} onClick={() => void run(() => lobbyApi.selectClan(session, clan.id))}>
                        <span className="clan-card-mon" aria-hidden="true">{CLAN_MON[clan.id]}</span>
                        <span className="clan-card-heading"><strong>{language === 'ru' ? clan.name : en.name}</strong>
                            <em>{owner ? `${t('clan.chosenBy')}: ${owner.name}` : t('room.free')}</em></span>
                        <span className="clan-card-rule"><b>{language === 'ru' ? rule.name : en.rule}</b>
                            <small>{language === 'ru' ? rule.ability : en.ability}</small></span>
                        <span className="clan-card-token"><i>{t('clan.uniqueToken')}</i><b>{language === 'ru' ? rule.uniqueToken.label : en.unique}</b></span>
                    </button>;
                })}
            </div>
        </section>

        <LobbyRules />

        <section className="panel action-panel">
            <div>
                <h2>{currentPlayer.isReady ? t('room.ready') : t('room.confirm')}</h2>
                <p>{currentPlayer.clanId
                    ? `${t('room.selectedClan')}: ${language === 'ru' ? CLANS.find(clan => clan.id === currentPlayer.clanId)?.name : CLAN_EN[currentPlayer.clanId].name}`
                    : t('room.chooseClan')}</p>
            </div>
            <div className="action-buttons">
                <button disabled={busy || !currentPlayer.clanId}
                    onClick={() => void run(() => lobbyApi.setReady(session, !currentPlayer.isReady))}>
                    {currentPlayer.isReady ? t('room.cancelReady') : t('room.ready')}
                </button>
                {isHost && <button className="primary" disabled={busy || !canStart}
                    onClick={() => void run(() => lobbyApi.start(session))}>{t('room.start')}</button>}
            </div>
        </section>
        {error && <p className="error floating-error">{error}</p>}
    </main>;
}

function PlayerCard({ player, removable, removeText, onRemove }: {
    player: RoomPlayer;
    removable?: boolean;
    removeText: string;
    onRemove?: () => void;
}) {
    const { language, t } = useLanguage();
    const clan = CLANS.find(item => item.id === player.clanId);
    return <article className="player-card">
        <div className="player-avatar">{player.kind === 'bot' ? 'AI' : player.name.slice(0, 1).toUpperCase()}</div>
        <div className="player-info">
            <strong>{player.name}</strong>
            <span>{player.isHost ? language === 'ru' ? 'Хозяин · ' : 'Host · ' : ''}{player.kind === 'bot' ? language === 'ru' ? 'Бот' : 'Bot' : language === 'ru' ? 'Игрок' : 'Player'}</span>
            <span>{clan ? `${language === 'ru' ? 'Клан' : 'Clan'} ${language === 'ru' ? clan.name : CLAN_EN[clan.id].name}` : t('room.chooseClan')}</span>
        </div>
        <span className={`status ${player.isReady ? 'ready' : ''}`}>{player.isReady ? t('room.ready') : t('room.notReady')}</span>
        {removable && <button className="danger small" onClick={onRemove}>{removeText}</button>}
    </article>;
}
