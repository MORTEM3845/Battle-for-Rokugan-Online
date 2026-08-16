import type { StoredGame } from '../room/types';

export function hasAttachedBlessing(game: StoredGame, orderId: string): boolean {
    return game.orders.some(order =>
        order.token.type === 'blessing' && order.target.kind === 'order' && order.target.id === orderId
    );
}

export function hasLandOrderInDirection(game: StoredGame, borderId: string, provinceId?: string): boolean {
    return game.orders.some(order => order.target.kind === 'land-border' &&
        order.target.id === borderId && order.target.provinceId === provinceId);
}

export function hasSeaBorderOrder(game: StoredGame, borderId: string): boolean {
    return game.orders.some(order => order.target.kind === 'sea-border' && order.target.id === borderId);
}
