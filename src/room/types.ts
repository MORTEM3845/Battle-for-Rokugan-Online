import type { ReactNode } from 'react';
import type { PlayerSession, RoomPlayer, RoomState } from '../../shared/room';

export type RoomAction = () => Promise<RoomState>;
export type RunRoomAction = (action: RoomAction) => Promise<void>;

export interface RoomFeatureProps {
    room: RoomState;
    session: PlayerSession;
    currentPlayer: RoomPlayer;
    busy: boolean;
    error: string;
    tools: ReactNode;
    run: RunRoomAction;
}
