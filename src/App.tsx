import { useEffect, useState } from 'react';
import { AmbientPlayer } from './components/AmbientPlayer';
import { roomCodeFromPath } from './lib/navigation';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';

export default function App() {
    const [roomCode, setRoomCode] = useState(roomCodeFromPath());

    useEffect(() => {
        const handler = () => setRoomCode(roomCodeFromPath());
        addEventListener('popstate', handler);
        return () => removeEventListener('popstate', handler);
    }, []);

    return <>
        {roomCode ? <RoomPage code={roomCode} /> : <HomePage />}
        <AmbientPlayer />
    </>;
}
