import { TurnBanner } from '../components/TurnBanner';
import type { RoomFeatureProps } from '../room';
import { gameApi } from './api';
import { GameBoard } from './GameBoard';

export function GameRoom({ room, session, currentPlayer, busy, error, tools, run }: RoomFeatureProps) {
    const game = room.game;
    if (!game)
        return null;
    return <>
        {tools}
        <TurnBanner room={room} currentPlayerId={currentPlayer.id} />
        <GameBoard room={room} currentPlayerId={currentPlayer.id} busy={busy} error={error}
            onRestart={() => run(() => gameApi.restart(session))}
            onAdvance={() => run(() => gameApi.advance(session, game.phase))}
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
    </>;
}
