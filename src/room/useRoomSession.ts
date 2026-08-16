import { useEffect, useMemo, useState } from 'react';
import type { PlayerSession, RoomState } from '../../shared/room';
import { lobbyApi } from '../lobby/api';
import { loadSession, saveSession } from '../lib/navigation';

export function useRoomSession(code: string, language: 'ru' | 'en') {
    const [session, setSession] = useState<PlayerSession | null>(() => loadSession(code));
    const [room, setRoom] = useState<RoomState | null>(null);
    const [name, setName] = useState(localStorage.getItem('rokugan-player-name') ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const currentPlayer = useMemo(
        () => room?.players.find(player => player.id === session?.playerId) ?? null,
        [room, session]
    );

    useEffect(() => {
        let active = true;
        let timer = 0;
        const refresh = async () => {
            try {
                const state = await lobbyApi.get(code, session);
                if (active) {
                    setRoom(current => current && JSON.stringify(current) === JSON.stringify(state) ? current : state);
                    setError('');
                }
            } catch (cause) {
                if (active)
                    setError(errorMessage(cause, language, 'Не удалось загрузить комнату', 'Could not load the room'));
            } finally {
                if (active)
                    timer = window.setTimeout(refresh, document.hidden ? 15_000 : 2_000);
            }
        };
        void refresh();
        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [code, language, session]);

    async function run(action: () => Promise<RoomState>): Promise<void> {
        try {
            setBusy(true);
            setError('');
            setRoom(await action());
        } catch (cause) {
            setError(errorMessage(cause, language, 'Не удалось выполнить действие', 'The action failed'));
        } finally {
            setBusy(false);
        }
    }

    async function join(): Promise<void> {
        try {
            setBusy(true);
            setError('');
            localStorage.setItem('rokugan-player-name', name.trim());
            const result = await lobbyApi.join(code, name);
            saveSession(result.session);
            setSession(result.session);
            setRoom(result.room);
        } catch (cause) {
            setError(errorMessage(cause, language, 'Не удалось войти в комнату', 'Could not join the room'));
        } finally {
            setBusy(false);
        }
    }

    return { session, room, currentPlayer, name, setName, busy, error, run, join };
}

function errorMessage(cause: unknown, language: 'ru' | 'en', ru: string, en: string): string {
    return cause instanceof Error ? cause.message : language === 'ru' ? ru : en;
}
