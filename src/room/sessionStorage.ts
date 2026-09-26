import type { PlayerSession } from '../../shared/room';

const sessionKey = (code: string) => `rokugan-session-${code}`;
const playerNameKey = 'rokugan-player-name';

export function saveSession(session: PlayerSession): void {
    localStorage.setItem(sessionKey(session.roomCode), JSON.stringify(session));
}

export function loadSession(code: string): PlayerSession | null {
    try {
        const value = localStorage.getItem(sessionKey(code));
        if (!value)
            return null;
        const session: unknown = JSON.parse(value);
        if (typeof session !== 'object' || session === null ||
            !('roomCode' in session) || session.roomCode !== code ||
            !('playerId' in session) || typeof session.playerId !== 'string' || !session.playerId ||
            !('playerToken' in session) || typeof session.playerToken !== 'string' || !session.playerToken)
            return null;
        return { roomCode: code, playerId: session.playerId, playerToken: session.playerToken };
    } catch {
        return null;
    }
}

export function loadPlayerName(): string {
    try {
        return localStorage.getItem(playerNameKey) ?? '';
    } catch {
        return '';
    }
}

export function savePlayerName(name: string): void {
    localStorage.setItem(playerNameKey, name.trim());
}
