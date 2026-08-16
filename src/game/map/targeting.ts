import { COASTAL_PROVINCES } from '../../../shared/map';
import type { BattleTokenView, GameViewState } from '../../../shared/room';

export function provinceIsEligible(token: BattleTokenView, provinceId: string, game: GameViewState, playerId: string): boolean {
    if (game.provinceSpecials[provinceId])
        return false;
    const isRonin = game.players.find(player => player.playerId === playerId)?.isRonin ?? false;
    if (token.type === 'blank' || token.type === 'shinobi')
        return true;
    if (token.type === 'army')
        return game.provinces[provinceId] === playerId;
    if (token.type === 'diplomacy')
        return !isRonin && game.provinces[provinceId] === playerId;
    if (token.type === 'fleet')
        return game.provinces[provinceId] === playerId && COASTAL_PROVINCES.has(provinceId);
    if (token.type === 'raid')
        return !isRonin && game.provinces[provinceId] !== playerId;
    return false;
}
