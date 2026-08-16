import type { BattleTokenType, ClanId, GamePhase, RoomPlayer } from '../../shared/room';
import type { CSSProperties } from 'react';

export const CLAN_COLORS: Record<ClanId, string> = {
    crab: '#e8e5dc', crane: '#91d8ec', dragon: '#4b9b62', lion: '#d6a83d',
    phoenix: '#de7338', scorpion: '#be3f3c', unicorn: '#8e63bb'
};

export const CLAN_MON: Record<ClanId, string> = {
    crab: '蟹', crane: '鶴', dragon: '龍', lion: '獅', phoenix: '鳳', scorpion: '蠍', unicorn: '麒'
};

export const CLAN_MON_ASSET: Record<ClanId, string> = {
    crab: '/assets/clans/crab.png', crane: '/assets/clans/crane.png', dragon: '/assets/clans/dragon.png',
    lion: '/assets/clans/lion.png', phoenix: '/assets/clans/phoenix.png', scorpion: '/assets/clans/scorpion.png',
    unicorn: '/assets/clans/unicorn.png'
};

export const TOKEN_INFO: Record<BattleTokenType, { symbol: string; label: string; hint: string }> = {
    army: { symbol: '兵', label: 'Армия', hint: 'Своя провинция или сухопутная граница' },
    fleet: { symbol: '船', label: 'Флот', hint: 'Своя прибрежная провинция или морская граница' },
    shinobi: { symbol: '忍', label: 'Синоби', hint: 'Любая провинция' },
    blessing: { symbol: '祝', label: 'Благословение', hint: 'Усиливает свой боевой жетон и защищает его от эффектов' },
    diplomacy: { symbol: '和', label: 'Дипломатия', hint: 'Своя провинция' },
    raid: { symbol: '火', label: 'Погром', hint: 'Любая чужая или ничейная провинция; условие проверится при исполнении' },
    blank: { symbol: '空', label: 'Пустой', hint: 'Имитирует любой приказ, кроме благословения' }
};

export const PHASE_LABELS: Record<GamePhase, string> = {
    setup: 'Начальная расстановка', objectives: 'Выбор тайной цели', placement: 'Размещение приказов',
    reveal: 'Вскрытие приказов', resolution: 'Результаты раунда', finished: 'Игра завершена'
};

export function clanStyle(player: RoomPlayer): CSSProperties {
    return { '--clan-accent': player.clanId ? CLAN_COLORS[player.clanId] : '#8b7566' } as CSSProperties;
}
