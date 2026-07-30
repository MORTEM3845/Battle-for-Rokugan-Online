import type { PlayerSession } from '../../shared/room';

const sessionKey = (code: string) => `rokugan-session-${code}`;

export function saveSession(session: PlayerSession): void {
    localStorage.setItem(sessionKey(session.roomCode), JSON.stringify(session));
}

export function loadSession(code: string): PlayerSession | null {
    const value = localStorage.getItem(sessionKey(code));
    if (!value)
        return null;

    try {
        return JSON.parse(value) as PlayerSession;
    } catch {
        return null;
    }
}

export function roomCodeFromPath(): string | null {
    const match = location.pathname.match(/^\/room\/([A-Z2-9]{6})$/i);
    return match ? match[1].toUpperCase() : null;
}

export function navigate(path: string): void {
    history.pushState({}, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
}
