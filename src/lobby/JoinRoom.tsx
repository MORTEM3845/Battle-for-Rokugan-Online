import type { RoomState } from '../../shared/room';
import { usePlayerName } from '../room';
import { JoinRoomScreen } from './JoinRoomScreen';

interface JoinRoomProps {
    room: RoomState;
    busy: boolean;
    error: string;
    onJoin: (name: string) => Promise<void>;
}

export function JoinRoom({ room, busy, error, onJoin }: JoinRoomProps) {
    const { name, setName } = usePlayerName();
    const full = room.players.length >= room.maxPlayers;
    return <JoinRoomScreen code={room.code} name={name} busy={busy} error={error}
        full={full} joinDisabled={full || room.status !== 'lobby'}
        onNameChange={setName} onJoin={() => onJoin(name)} />;
}
