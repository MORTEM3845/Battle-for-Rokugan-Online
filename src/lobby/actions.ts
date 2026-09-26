import type { ClanId, PlayerSession } from '../../shared/room';
import type { RunRoomAction } from '../room';
import { lobbyApi } from './api';

export interface LobbyActions {
    addBot: () => Promise<void>;
    kickPlayer: (playerId: string) => Promise<void>;
    selectClan: (clanId: ClanId) => Promise<void>;
    setReady: (isReady: boolean) => Promise<void>;
    start: () => Promise<void>;
}

export function createLobbyActions(session: PlayerSession, run: RunRoomAction): LobbyActions {
    return {
        addBot: () => run(() => lobbyApi.addBot(session)),
        kickPlayer: playerId => run(() => lobbyApi.kickPlayer(session, playerId)),
        selectClan: clanId => run(() => lobbyApi.selectClan(session, clanId)),
        setReady: isReady => run(() => lobbyApi.setReady(session, isReady)),
        start: () => run(() => lobbyApi.start(session))
    };
}
