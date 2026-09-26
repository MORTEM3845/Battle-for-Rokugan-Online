import { GameRoom } from '../game';
import { AmbientPlayer } from '../components/AmbientPlayer';
import { RoomChat } from '../chat/RoomChat';
import { LanguageToggle, useLanguage } from '../i18n';
import { JoinRoom, LobbyRoom } from '../lobby';
import { useRoomSession } from '../room';

export function RoomPage({ code }: { code: string }) {
    const { language, t } = useLanguage();
    const state = useRoomSession(code, language);
    const { room, session, currentPlayer, busy, error, run } = state;

    if (!room)
        return <main className="page"><section className="panel"><h1>{language === 'ru' ? 'Комната' : 'Room'} {code}</h1><p>{error || t('room.loading')}</p></section></main>;

    if (!session || !currentPlayer)
        return <JoinRoom room={room} busy={busy} error={error} onJoin={state.join} />;

    const tools = <div className="room-tools"><AmbientPlayer /><LanguageToggle /></div>;
    const screen = { tools, room, currentPlayer, session, busy, error, run };
    return <>
        {room.status === 'playing' ? <GameRoom {...screen} /> : <LobbyRoom {...screen} />}
        <RoomChat session={session} currentPlayer={currentPlayer} mode={room.status === 'playing' ? 'game' : 'lobby'} />
    </>;
}
