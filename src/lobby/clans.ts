import { CLANS, type ClanId } from '../../shared/room';
import type { Language } from '../i18n';

export const CLAN_EN: Record<ClanId, { name: string; rule: string; ability: string; unique: string }> = {
    crab: { name: 'Crab', rule: 'Crab Resilience', ability: 'Each faceup control token grants +3 defense instead of +1.', unique: 'Fleet 3' },
    crane: { name: 'Crane', rule: 'Perfect Honor', ability: 'The Crane wins tied battles in which it has the highest tied strength.', unique: 'Extra Diplomacy' },
    dragon: { name: 'Dragon', rule: 'Dragon Foresight', ability: 'Draw one extra token, then return one non-bluff token to your reserve.', unique: 'Blessing 3' },
    lion: { name: 'Lion', rule: 'Unbreakable Lion', ability: 'The Lion bluff has defense 2 when used to defend a province.', unique: 'Army 6' },
    phoenix: { name: 'Phoenix', rule: 'Phoenix Fire', ability: 'When attacking a capital, ignore only its printed defense bonus.', unique: 'Blessing 3' },
    scorpion: { name: 'Scorpion', rule: 'Scorpion Whispers', ability: 'Once per round after placing an order, secretly inspect an enemy order.', unique: 'Shinobi 3' },
    unicorn: { name: 'Unicorn', rule: 'Unicorn Maneuver', ability: 'Before orders are revealed, swap two of your unblessed combat orders.', unique: 'Extra Raid' }
};

export function clanName(clanId: ClanId, language: Language): string {
    return language === 'ru' ? CLANS.find(clan => clan.id === clanId)!.name : CLAN_EN[clanId].name;
}
