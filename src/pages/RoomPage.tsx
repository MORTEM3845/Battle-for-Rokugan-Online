import { gameApi } from '../game/api';
import { GameBoard } from '../game/GameBoard';
import { AmbientPlayer } from '../components/AmbientPlayer';
import { RoomChat } from '../chat/RoomChat';
import { TurnBanner } from '../components/TurnBanner';
import { LanguageToggle, useLanguage } from '../i18n';
import { JoinRoomScreen } from '../lobby/JoinRoomScreen';
import { LobbyScreen } from '../lobby/LobbyScreen';
import { useRoomSession } from '../room/useRoomSession';

export function RoomPage({ code }: { code: string }) {
    const { language, t } = useLanguage();
    const state = useRoomSession(code, language);
    const { room, session, currentPlayer, busy, error, run } = state;

    if (!room)
        return <main className="page"><section className="panel"><h1>{language === 'ru' ? 'Комната' : 'Room'} {code}</h1><p>{error || t('room.loading')}</p></section></main>;

    if (!session || !currentPlayer)
        return <JoinRoomScreen code={code} name={state.name} busy={busy} error={error}
            full={room.players.length >= room.maxPlayers}
            joinDisabled={room.players.length >= room.maxPlayers || room.status !== 'lobby'}
            onNameChange={state.setName} onJoin={state.join} />;

    const tools = <div className="room-tools"><AmbientPlayer /><LanguageToggle /></div>;
    if (room.status === 'playing') {
        return <>
            {tools}
            <TurnBanner room={room} currentPlayerId={currentPlayer.id} />
            <GameBoard room={room} currentPlayerId={currentPlayer.id} busy={busy} error={error}
                onAdvance={() => run(() => gameApi.advance(session, room.game!.phase))}
                onChooseSecretObjective={objectiveId => run(() => gameApi.chooseSecretObjective(session, objectiveId))}
                onSetResolutionReady={isReady => run(() => gameApi.setResolutionReady(session, isReady))}
                onPlayScout={orderId => run(() => gameApi.playScout(session, orderId))}
                onPlayShugenja={orderId => run(() => gameApi.playShugenja(session, orderId))}
                onReturnDragonToken={tokenId => run(() => gameApi.returnDragonToken(session, tokenId))}
                onUseScorpionPeek={orderId => run(() => gameApi.useScorpionPeek(session, orderId))}
                onSwapUnicornOrders={orderIds => run(() => gameApi.swapUnicornOrders(session, orderIds))}
                onPassPlacement={() => run(() => gameApi.passPlacement(session))}
                onPlaceOrder={(tokenId, target) => run(() => gameApi.placeOrder(session, tokenId, target))}
                onPlaceControl={provinceId => run(() => gameApi.placeControl(session, provinceId))} />
            <RoomChat session={session} currentPlayer={currentPlayer} mode="game" />
        </>;
    }

    return <>
        {tools}
        <LobbyScreen room={room} currentPlayer={currentPlayer} session={session} busy={busy} error={error} run={run} />
        <RoomChat session={session} currentPlayer={currentPlayer} mode="lobby" />
    </>;
}
