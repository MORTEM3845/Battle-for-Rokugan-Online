import type { ReactNode } from 'react';
import type { RoomPlayer, RoomState } from '../../shared/room';
import { LobbyRules } from './LobbyRules';
import { ClanPicker } from './ClanPicker';
import { PlayerCard } from './PlayerCard';
import { clanName } from './clans';
import { useLanguage } from '../i18n';
import { navigate } from '../lib/navigation';
import type { LobbyActions } from './actions';
import { CopyRoomLinkButton } from '../components/CopyRoomLinkButton';

interface LobbyScreenProps {
    tools: ReactNode;
    room: RoomState;
    currentPlayer: RoomPlayer;
    busy: boolean;
    error: string;
    actions: LobbyActions;
}

export function LobbyScreen({ tools, room, currentPlayer, busy, error, actions }: LobbyScreenProps) {
    const { language, t } = useLanguage();
    const isHost = currentPlayer.isHost;
    const canStart = room.players.length >= 2 && room.players.every(player => player.clanId && player.isReady);
    const inviteUrl = `${location.origin}/room/${room.code}`;

    return <main className="page lobby-page">
        <header className="lobby-header">
            <div><p className="eyebrow">{t('room.private')}</p><h1>{room.code}</h1></div>
            <div className="header-actions">
                {tools}
                <CopyRoomLinkButton url={inviteUrl}>{t('room.copy')}</CopyRoomLinkButton>
                <button className="link-button" onClick={() => navigate('/')}>{t('room.home')}</button>
            </div>
        </header>

        <section className="panel">
            <div className="section-title">
                <div><h2>{t('room.players')}</h2><p>{room.players.length} / {room.maxPlayers}</p></div>
                {isHost && room.players.length < room.maxPlayers && <button disabled={busy}
                    onClick={() => void actions.addBot()}>{t('room.addBot')}</button>}
            </div>
            <div className="players-grid">
                {room.players.map(player => <PlayerCard key={player.id} player={player}
                    removable={isHost && !player.isHost} busy={busy}
                    onRemove={() => {
                        if (confirm(`${t('room.kickConfirm')} ${player.name}`))
                            void actions.kickPlayer(player.id);
                    }} />)}
            </div>
        </section>

        <ClanPicker players={room.players} currentPlayer={currentPlayer} busy={busy} onSelect={actions.selectClan} />

        <LobbyRules />

        <section className="panel action-panel">
            <div>
                <h2>{currentPlayer.isReady ? t('room.ready') : t('room.confirm')}</h2>
                <p>{currentPlayer.clanId
                    ? `${t('room.selectedClan')}: ${clanName(currentPlayer.clanId, language)}`
                    : t('room.chooseClan')}</p>
            </div>
            <div className="action-buttons">
                <button disabled={busy || !currentPlayer.clanId}
                    onClick={() => void actions.setReady(!currentPlayer.isReady)}>
                    {currentPlayer.isReady ? t('room.cancelReady') : t('room.ready')}
                </button>
                {isHost && <button className="primary" disabled={busy || !canStart}
                    onClick={() => void actions.start()}>{t('room.start')}</button>}
            </div>
        </section>
        {error && <p className="error floating-error">{error}</p>}
    </main>;
}
