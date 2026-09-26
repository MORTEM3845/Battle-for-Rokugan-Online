import type { PlayerSession, RoomSessionResponse, RoomState } from '../../shared/room';
import { apiRequest } from '../api/request';

export const roomApi = {
    create: (playerName: string) => apiRequest<RoomSessionResponse>('/api/rooms', {
        method: 'POST', body: JSON.stringify({ playerName })
    }),
    join: (code: string, playerName: string) => apiRequest<RoomSessionResponse>(`/api/rooms/${code}/join`, {
        method: 'POST', body: JSON.stringify({ playerName })
    }),
    get: (code: string, session?: PlayerSession | null) => apiRequest<RoomState>(
        `/api/rooms/${code}`, undefined, session?.playerToken
    )
};
