import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerSession, RoomState } from '../../shared/room';
import { roomApi } from './api';
import { RoomConnection } from './RoomConnection';
import { loadSession, savePlayerName, saveSession } from './sessionStorage';
import type { RunRoomAction } from './types';

export function useRoomSession(code: string, language: 'ru' | 'en') {
    const [session, setSession] = useState<PlayerSession | null>(() => loadSession(code));
    const [room, setRoom] = useState<RoomState | null>(null);
    const [busy, setBusy] = useState(false);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [actionError, setActionError] = useState<unknown>(null);
    const connectionRef = useRef<RoomConnection | null>(null);

    useEffect(() => {
        const connection = new RoomConnection({
            load: () => roomApi.get(code, session),
            onRoom: state => setRoom(current =>
                current && JSON.stringify(current) === JSON.stringify(state) ? current : state),
            onLoadError: cause => setLoadError(() => cause),
            onActionError: cause => setActionError(() => cause),
            onBusy: setBusy,
            pollDelay: () => document.hidden ? 15_000 : 2_000,
            schedule: (task, delay) => {
                const timer = window.setTimeout(task, delay);
                return () => window.clearTimeout(timer);
            }
        });
        connectionRef.current = connection;
        setBusy(false);
        connection.start();
        return () => {
            connection.stop();
            connectionRef.current = null;
        };
    }, [code, session]);

    const run = useCallback<RunRoomAction>(action =>
        connectionRef.current?.run(action) ?? Promise.resolve(), []);

    const join = useCallback((name: string) => run(async () => {
        savePlayerName(name);
        const result = await roomApi.join(code, name);
        saveSession(result.session);
        setSession(result.session);
        return result.room;
    }), [code, run]);

    const currentPlayer = room?.players.find(player => player.id === session?.playerId) ?? null;
    const error = actionError !== null
        ? errorMessage(actionError, language, 'Не удалось выполнить действие', 'The action failed')
        : loadError !== null
            ? errorMessage(loadError, language, 'Не удалось загрузить комнату', 'Could not load the room')
            : '';
    return { session, room, currentPlayer, busy, error, run, join };
}

function errorMessage(cause: unknown, language: 'ru' | 'en', ru: string, en: string): string {
    return cause instanceof Error ? cause.message : language === 'ru' ? ru : en;
}
