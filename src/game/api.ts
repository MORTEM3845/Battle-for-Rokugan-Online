import type { GamePhase, OrderTarget, PlayerSession, RoomState } from '../../shared/room';
import type { SecretObjectiveId } from '../../shared/objectives';
import { apiRequest } from '../api/request';

const gameRequest = (session: PlayerSession, path: string, body?: unknown) => apiRequest<RoomState>(
    `/api/rooms/${session.roomCode}/game${path}`,
    { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) },
    session.playerToken
);

export const gameApi = {
    advance: (session: PlayerSession, expectedPhase: GamePhase) => gameRequest(session, '/advance', { expectedPhase }),
    chooseSecretObjective: (session: PlayerSession, objectiveId: SecretObjectiveId) => gameRequest(session, '/objective', { objectiveId }),
    setResolutionReady: (session: PlayerSession, isReady: boolean) => gameRequest(session, '/ready', { isReady }),
    playScout: (session: PlayerSession, orderId: string) => gameRequest(session, '/cards/scout', { orderId }),
    playShugenja: (session: PlayerSession, orderId: string) => gameRequest(session, '/cards/shugenja', { orderId }),
    returnDragonToken: (session: PlayerSession, tokenId: string) => gameRequest(session, '/clan/dragon-return', { tokenId }),
    useScorpionPeek: (session: PlayerSession, orderId: string | null) => gameRequest(session, '/clan/scorpion-peek', { orderId }),
    swapUnicornOrders: (session: PlayerSession, orderIds: string[]) => gameRequest(session, '/clan/unicorn-swap', { orderIds }),
    placeOrder: (session: PlayerSession, tokenId: string, target: OrderTarget) => gameRequest(session, '/orders', { tokenId, target }),
    passPlacement: (session: PlayerSession) => gameRequest(session, '/pass'),
    placeControl: (session: PlayerSession, provinceId: string) => gameRequest(session, '/control', { provinceId }),
    playBotTurn: (session: PlayerSession) => gameRequest(session, '/bot-turn')
};
