import type { ClanId } from './room';

export interface MapPoint {
    x: number;
    y: number;
}

export interface LandBorder extends MapPoint {
    id: string;
    provinces: [string, string];
}

export interface SeaBorder extends MapPoint {
    id: string;
    provinceId: string;
}

interface ProvinceDefinition extends MapPoint {
    id: string;
    legacyId: string;
    name: string;
}

/*
 * Province IDs have the form:
 *   <territory>_<position inside territory>_<position on map>
 *
 * A clan capital is always position 1 inside its territory. The final
 * two-digit number follows the map from top to bottom and left to right,
 * with the Dragon capital kept as the starting province (`..._01`).
 */
export const PROVINCES: ProvinceDefinition[] = [
    { id: 'greendragon_province_1_02', legacyId: 'province-01', name: 'Земли клана Дракона', x: 237, y: 143 },
    { id: 'greendragon_capital_2_01', legacyId: 'province-02', name: 'Столица клана Дракона', x: 526, y: 175 },
    { id: 'orangephoenix_province_2_06', legacyId: 'province-03', name: 'Земли клана Феникса', x: 645, y: 203 },
    { id: 'orangephoenix_capital_2_04', legacyId: 'province-04', name: 'Столица клана Феникса', x: 750, y: 180 },
    { id: 'orangephoenix_province_1_05', legacyId: 'province-05', name: 'Земли клана Феникса', x: 822, y: 161 },
    { id: 'purpleunicorn_capital_2_07', legacyId: 'province-06', name: 'Столица клана Единорога', x: 169, y: 264 },
    { id: 'yellowlion_province_2_12', legacyId: 'province-07', name: 'Земли клана Льва', x: 420, y: 361 },
    { id: 'yellowlion_province_2_11', legacyId: 'province-08', name: 'Земли клана Льва', x: 689, y: 463 },
    { id: 'lightbluecrane_province_2_17', legacyId: 'province-09', name: 'Земли клана Журавля', x: 654, y: 722 },
    { id: 'graycrab_province_3_21', legacyId: 'province-10', name: 'Земли клана Краба', x: 340, y: 776 },
    { id: 'blackshadowlandsnorth_province_1_29', legacyId: 'province-11', name: 'Северные Земли Теней', x: 72, y: 983 },
    { id: 'goldcoast_province_3_25', legacyId: 'province-12', name: 'Золотое побережье', x: 428, y: 1184 },
    { id: 'redscorpion_province_1_15', legacyId: 'province-13', name: 'Земли клана Скорпиона', x: 240, y: 584 },
    { id: 'redscorpion_province_3_14', legacyId: 'province-14', name: 'Земли клана Скорпиона', x: 411, y: 539 },
    { id: 'greendragon_province_3_03', legacyId: 'province-15', name: 'Земли клана Дракона', x: 583, y: 388 },
    { id: 'lavenderislands_province_1_27', legacyId: 'province-16', name: 'Лавандовые острова', x: 683, y: 1248 },
    { id: 'blackshadowlandssouth_province_1_30', legacyId: 'province-17', name: 'Южные Земли Теней', x: 169, y: 1301 },
    { id: 'purpleunicorn_province_1_08', legacyId: 'province-18', name: 'Земли клана Единорога', x: 148, y: 395 },
    { id: 'graycrab_province_2_22', legacyId: 'province-19', name: 'Земли клана Краба', x: 300, y: 948 },
    { id: 'goldcoast_province_2_24', legacyId: 'province-20', name: 'Золотое побережье', x: 575, y: 952 },
    { id: 'redscorpion_capital_2_13', legacyId: 'province-21', name: 'Столица клана Скорпиона', x: 481, y: 685 },
    { id: 'lavenderislands_province_2_26', legacyId: 'province-22', name: 'Лавандовые острова', x: 802, y: 1093 },
    { id: 'graycrab_capital_2_19', legacyId: 'province-23', name: 'Столица клана Краба', x: 330, y: 1148 },
    { id: 'purpleunicorn_province_3_09', legacyId: 'province-24', name: 'Земли клана Единорога', x: 320, y: 414 },
    { id: 'lightbluecrane_capital_2_16', legacyId: 'province-25', name: 'Столица клана Журавля', x: 669, y: 615 },
    { id: 'graycrab_province_1_20', legacyId: 'province-26', name: 'Земли клана Краба', x: 144, y: 702 },
    { id: 'goldcoast_province_3_23', legacyId: 'province-27', name: 'Золотое побережье', x: 450, y: 964 },
    { id: 'lavenderislands_province_1_28', legacyId: 'province-28', name: 'Лавандовые острова', x: 808, y: 1231 },
    { id: 'yellowlion_capital_2_10', legacyId: 'province-29', name: 'Столица клана Льва', x: 548, y: 516 },
    { id: 'lightbluecrane_province_3_18', legacyId: 'province-30', name: 'Земли клана Журавля', x: 489, y: 812 }
];

export const PROVINCE_NAMES: Record<string, string> = Object.fromEntries(
    PROVINCES.map(province => [province.id, province.name])
);

export type RegionId =
    | 'greendragon'
    | 'orangephoenix'
    | 'purpleunicorn'
    | 'yellowlion'
    | 'redscorpion'
    | 'lightbluecrane'
    | 'graycrab'
    | 'goldcoast'
    | 'lavenderislands'
    | 'blackshadowlandsnorth'
    | 'blackshadowlandssouth';

export interface RegionDefinition {
    id: RegionId;
    name: string;
    provinceIds: string[];
    awardsHonor: boolean;
}

const REGION_NAMES: Record<RegionId, string> = {
    greendragon: 'Регион клана Дракона',
    orangephoenix: 'Регион клана Феникса',
    purpleunicorn: 'Регион клана Единорога',
    yellowlion: 'Регион клана Льва',
    redscorpion: 'Регион клана Скорпиона',
    lightbluecrane: 'Регион клана Журавля',
    graycrab: 'Регион клана Краба',
    goldcoast: 'Золотое побережье',
    lavenderislands: 'Лавандовые острова',
    blackshadowlandsnorth: 'Северные Земли Теней',
    blackshadowlandssouth: 'Южные Земли Теней'
};

const provinceRegionId = (provinceId: string): RegionId =>
    provinceId.replace(/_(?:capital|province)_\d+_\d+$/, '') as RegionId;

export const PROVINCE_REGIONS: Record<string, RegionId> = Object.fromEntries(
    PROVINCES.map(province => [province.id, provinceRegionId(province.id)])
);

export const REGIONS: RegionDefinition[] = (Object.keys(REGION_NAMES) as RegionId[]).map(id => ({
    id,
    name: REGION_NAMES[id],
    provinceIds: PROVINCES.filter(province => provinceRegionId(province.id) === id).map(province => province.id),
    awardsHonor: !id.startsWith('blackshadowlands')
}));

/*
 * Напечатанная на поле честь. Значения сверены с картой; у Земель Теней
 * звёзды остаются видимыми в подсказке, но в итоговый счёт не входят.
 */
export const PROVINCE_HONOR: Record<string, number> = Object.fromEntries(
    PROVINCES.map(province => [province.id, Number(province.id.match(/_(?:capital|province)_(\d)_/)?.[1] ?? 1)])
);

export const CLAN_CAPITALS: Record<ClanId, string> = {
    crab: 'graycrab_capital_2_19',
    crane: 'lightbluecrane_capital_2_16',
    dragon: 'greendragon_capital_2_01',
    lion: 'yellowlion_capital_2_10',
    phoenix: 'orangephoenix_capital_2_04',
    scorpion: 'redscorpion_capital_2_13',
    unicorn: 'purpleunicorn_capital_2_07'
};

export const PROVINCE_BASE_DEFENSE: Record<string, number> = Object.fromEntries(
    PROVINCES.map(province => [province.id,
        Object.values(CLAN_CAPITALS).includes(province.id)
            ? 2
            : province.id.startsWith('blackshadowlands') ? 1 : 0
    ])
);

export const SHADOWLANDS_PROVINCES = new Set(
    PROVINCES.filter(province => provinceRegionId(province.id).startsWith('blackshadowlands'))
        .map(province => province.id)
);

export const PROVINCE_CENTERS: Record<string, MapPoint> = Object.fromEntries(
    PROVINCES.map(({ id, x, y }) => [id, { x, y }])
);

export const PROVINCE_IDS = PROVINCES.map(province => province.id);

export const LEGACY_PROVINCE_ID_MAP: Record<string, string> = Object.fromEntries(
    PROVINCES.map(province => [province.legacyId, province.id])
);

export const RENAMED_PROVINCE_ID_MAP: Record<string, string> = {
    orangephoenix_1_03: 'orangephoenix_3_05',
    orangephoenix_2_04: 'orangephoenix_1_03',
    orangephoenix_3_05: 'orangephoenix_2_04',
    orangephoenix_4_11: 'yellowlion_2_07',
    yellowlion_2_07: 'yellowlion_3_08',
    yellowlion_3_08: 'greendragon_3_08',
    orangephoenix_2_03: 'orangephoenix_1_03',
    orangephoenix_1_04: 'orangephoenix_2_04',
    purpleunicorn_2_06: 'purpleunicorn_1_06',
    purpleunicorn_1_09: 'purpleunicorn_2_09',
    lightbluecrane_2_15: 'lightbluecrane_1_15',
    lightbluecrane_1_18: 'lightbluecrane_2_18'
};

const provinceIdByLegacyNumber = (number: number): string => {
    const legacyId = `province-${String(number).padStart(2, '0')}`;
    const provinceId = LEGACY_PROVINCE_ID_MAP[legacyId];
    if (!provinceId)
        throw new Error(`Unknown legacy province number: ${number}`);
    return provinceId;
};

const land = (a: number, b: number, x: number, y: number): LandBorder => {
    const left = provinceIdByLegacyNumber(a);
    const right = provinceIdByLegacyNumber(b);
    return { id: `land-${left}-${right}`, provinces: [left, right], x, y };
};

export const LAND_BORDERS: LandBorder[] = [
    land(1, 2, 413, 114), land(1, 6, 195, 203), land(1, 7, 379, 284),
    land(2, 3, 603, 88), land(2, 7, 451, 303), land(2, 15, 575, 338),
    land(3, 4, 640, 75), land(3, 8, 686, 379), land(3, 15, 660, 342),
    land(4, 5, 791, 189), land(4, 8, 726, 355), land(6, 18, 136, 312),
    land(6, 24, 277, 330), land(7, 14, 439, 456), land(7, 15, 491, 379),
    land(7, 24, 363, 371), land(7, 29, 494, 412), land(8, 15, 665, 447),
    land(8, 25, 673, 537), land(8, 29, 618, 502), land(9, 21, 540, 686),
    land(9, 25, 623, 671), land(9, 29, 561, 626), land(9, 30, 597, 783),
    land(10, 13, 294, 654), land(10, 19, 298, 807), land(10, 21, 370, 698),
    land(10, 26, 274, 726), land(10, 27, 392, 892), land(10, 30, 370, 807),
    land(11, 17, 116, 1172), land(11, 19, 186, 926), land(11, 23, 189, 991),
    land(11, 26, 83, 853), land(12, 19, 413, 1112), land(12, 20, 507, 1018),
    land(12, 23, 403, 1231), land(12, 27, 450, 1046), land(13, 14, 353, 572),
    land(13, 18, 170, 518), land(13, 21, 345, 632), land(13, 24, 313, 516),
    land(13, 26, 181, 619), land(14, 21, 433, 624), land(14, 24, 355, 497),
    land(14, 29, 494, 530), land(15, 29, 548, 447), land(16, 22, 719, 1152),
    land(16, 28, 751, 1258), land(17, 23, 234, 1178), land(18, 24, 254, 425),
    land(18, 26, 56, 531), land(19, 23, 221, 996), land(19, 26, 267, 796),
    land(19, 27, 387, 1053), land(20, 27, 538, 935), land(20, 30, 638, 860),
    land(21, 29, 524, 598), land(21, 30, 468, 733), land(22, 28, 831, 1139),
    land(25, 29, 591, 576), land(27, 30, 487, 867)
];

const sea = (provinceNumber: number, x: number, y: number): SeaBorder => {
    const provinceId = provinceIdByLegacyNumber(provinceNumber);
    return { id: `sea-${provinceId}`, provinceId, x, y };
};

export const SEA_BORDERS: SeaBorder[] = [
    sea(5, 925, 250),
    sea(8, 775, 445),
    sea(25, 760, 610),
    sea(9, 700, 715),
    sea(30, 680, 820),
    sea(20, 675, 930),
    sea(12, 520, 1190),
    sea(23, 395, 1270),
    sea(17, 300, 1390),
    sea(16, 730, 1320),
    sea(22, 900, 1080),
    sea(28, 900, 1250)
];

export const COASTAL_PROVINCES = new Set(SEA_BORDERS.map(border => border.provinceId));

export function adjacentProvinceIds(provinceId: string): string[] {
    return LAND_BORDERS
        .filter(border => border.provinces.includes(provinceId))
        .map(border => border.provinces[0] === provinceId ? border.provinces[1] : border.provinces[0]);
}
