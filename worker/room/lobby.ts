import type { ClanId, PlayerSession } from '../../shared/room';
import { randomItem } from './collections';
import { RoomRequestError } from './http';
import type { StoredPlayer, StoredRoom } from './types';

export const ROOM_SCHEMA_VERSION = 5;
const ALL_CLANS: ClanId[] = ['crab', 'crane', 'dragon', 'lion', 'phoenix', 'scorpion', 'unicorn'];

export function createLobby(code: string, playerName: string | undefined): { room: StoredRoom; player: StoredPlayer } {
    const player = createHuman(playerName, true);
    return {
        player,
        room: {
            schemaVersion: ROOM_SCHEMA_VERSION,
            code,
            status: 'lobby',
            maxPlayers: 5,
            players: [player],
            createdAt: new Date().toISOString(),
            game: null
        }
    };
}

export function joinLobby(room: StoredRoom, playerName: string | undefined): StoredPlayer {
    ensureLobby(room);
    if (room.players.length >= room.maxPlayers)
        throw new RoomRequestError(400, 'Комната заполнена');
    const player = createHuman(playerName, false);
    room.players.push(player);
    return player;
}

export function selectLobbyClan(room: StoredRoom, player: StoredPlayer, clanId: ClanId): void {
    ensureLobby(room);
    if (!ALL_CLANS.includes(clanId))
        throw new RoomRequestError(400, 'Неизвестный клан');
    if (room.players.some(item => item.id !== player.id && item.clanId === clanId))
        throw new RoomRequestError(400, 'Этот клан уже выбран');
    player.clanId = clanId;
    player.isReady = false;
}

export function setLobbyReady(room: StoredRoom, player: StoredPlayer, isReady: boolean): void {
    ensureLobby(room);
    if (isReady && !player.clanId)
        throw new RoomRequestError(400, 'Сначала выберите клан');
    player.isReady = isReady;
}

export function addLobbyBot(room: StoredRoom): void {
    ensureLobby(room);
    if (room.players.length >= room.maxPlayers)
        throw new RoomRequestError(400, 'Комната заполнена');
    const freeClans = ALL_CLANS.filter(clan => !room.players.some(player => player.clanId === clan));
    room.players.push({
        id: crypto.randomUUID(), token: crypto.randomUUID(),
        name: `Бот ${room.players.filter(player => player.kind === 'bot').length + 1}`,
        kind: 'bot', isHost: false, isReady: true, clanId: randomItem(freeClans)
    });
}

export function removeLobbyBot(room: StoredRoom, botId: string): void {
    ensureLobby(room);
    if (!room.players.some(player => player.id === botId && player.kind === 'bot'))
        throw new RoomRequestError(400, 'Бот не найден');
    room.players = room.players.filter(player => player.id !== botId);
}

export function removeLobbyPlayer(room: StoredRoom, host: StoredPlayer, playerId: string): void {
    if (room.status !== 'lobby')
        throw new RoomRequestError(400, 'Игроков можно исключать только до начала партии');
    const target = room.players.find(player => player.id === playerId);
    if (!target)
        throw new RoomRequestError(404, 'Игрок не найден');
    if (target.id === host.id || target.isHost)
        throw new RoomRequestError(400, 'Хозяин комнаты не может исключить себя');
    room.players = room.players.filter(player => player.id !== playerId);
}

export function assertLobbyCanStart(room: StoredRoom): void {
    ensureLobby(room);
    if (room.players.length < 2 || room.players.length > room.maxPlayers)
        throw new RoomRequestError(400, 'Для запуска нужны от 2 до 5 игроков');
    if (room.players.some(player => !player.clanId))
        throw new RoomRequestError(400, 'Все игроки должны выбрать клан');
    if (room.players.some(player => !player.isReady))
        throw new RoomRequestError(400, 'Все игроки должны быть готовы');
}

export function findPlayer(request: Request, room: StoredRoom): StoredPlayer | undefined {
    const token = request.headers.get('x-player-token');
    return room.players.find(player => player.token === token);
}

export function requirePlayer(request: Request, room: StoredRoom): StoredPlayer {
    const player = findPlayer(request, room);
    if (!player)
        throw new RoomRequestError(401, 'Сессия игрока не найдена');
    return player;
}

export function requireHost(request: Request, room: StoredRoom): StoredPlayer {
    const player = requirePlayer(request, room);
    if (!player.isHost)
        throw new RoomRequestError(403, 'Это действие доступно только хозяину комнаты');
    return player;
}

export function ensureLobby(room: StoredRoom): void {
    if (room.status !== 'lobby')
        throw new RoomRequestError(400, 'Игра уже запущена');
}

export function toPlayerSession(roomCode: string, player: StoredPlayer): PlayerSession {
    return { roomCode, playerId: player.id, playerToken: player.token };
}

function createHuman(name: string | undefined, isHost: boolean): StoredPlayer {
    const normalizedName = name?.trim().slice(0, 24);
    if (!normalizedName)
        throw new RoomRequestError(400, 'Введите имя игрока');
    return {
        id: crypto.randomUUID(), token: crypto.randomUUID(), name: normalizedName,
        kind: 'human', isHost, isReady: false, clanId: null
    };
}
