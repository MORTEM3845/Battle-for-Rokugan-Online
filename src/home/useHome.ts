import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n';
import { navigate } from '../lib/navigation';
import { roomApi, saveSession, usePlayerName } from '../room';

export function useHome() {
    const { t } = useLanguage();
    const { name, setName, rememberName } = usePlayerName();
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const creating = useRef(false);
    const active = useRef(true);

    useEffect(() => {
        active.current = true;
        return () => { active.current = false; };
    }, []);

    async function createRoom(): Promise<void> {
        if (creating.current || !name.trim())
            return;
        creating.current = true;
        setBusy(true);
        setError('');
        try {
            rememberName();
            const result = await roomApi.create(name);
            saveSession(result.session);
            if (active.current)
                navigate(`/room/${result.room.code}`);
        } catch (cause) {
            if (active.current)
                setError(cause instanceof Error ? cause.message : t('home.createError'));
        } finally {
            creating.current = false;
            if (active.current)
                setBusy(false);
        }
    }

    function openRoom(): void {
        if (creating.current)
            return;
        const normalized = code.trim().toUpperCase();
        if (!/^[A-Z2-9]{6}$/.test(normalized)) {
            setError(t('home.invalidCode'));
            return;
        }
        navigate(`/room/${normalized}`);
    }

    return { name, code, busy, error, onNameChange: setName, onCodeChange: setCode,
        onCreateRoom: createRoom, onOpenRoom: openRoom };
}
