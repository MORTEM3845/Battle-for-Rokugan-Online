import type { RoomFeatureProps } from '../room';
import { createLobbyActions } from './actions';
import { LobbyScreen } from './LobbyScreen';

export function LobbyRoom({ session, run, ...screen }: RoomFeatureProps) {
    const actions = createLobbyActions(session, run);
    return <LobbyScreen {...screen} actions={actions} />;
}
