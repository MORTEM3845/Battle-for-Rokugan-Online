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
 * The middle number is the province's printed honor value. The final
 * two-digit number follows the map from top to bottom and left to right,
 * with the Dragon capital kept as the starting province (`..._01`).
 */
export const PROVINCES: ProvinceDefinition[] = [
    { id: 'greendragon_province_1_02', legacyId: 'province-01', name: 'Земли клана Дракона', x: 245, y: 145 },
    { id: 'greendragon_capital_2_01', legacyId: 'province-02', name: 'Столица клана Дракона', x: 520, y: 187 },
    { id: 'orangephoenix_province_2_06', legacyId: 'province-03', name: 'Земли клана Феникса', x: 649, y: 211 },
    { id: 'orangephoenix_capital_2_04', legacyId: 'province-04', name: 'Столица клана Феникса', x: 716, y: 124 },
    { id: 'orangephoenix_province_1_05', legacyId: 'province-05', name: 'Земли клана Феникса', x: 838, y: 121 },
    { id: 'purpleunicorn_capital_2_07', legacyId: 'province-06', name: 'Столица клана Единорога', x: 208, y: 295 },
    { id: 'yellowlion_province_2_12', legacyId: 'province-07', name: 'Земли клана Льва', x: 432, y: 373 },
    { id: 'yellowlion_province_2_11', legacyId: 'province-08', name: 'Земли клана Льва', x: 693, y: 487 },
    { id: 'lightbluecrane_province_2_17', legacyId: 'province-09', name: 'Земли клана Журавля', x: 638, y: 726 },
    { id: 'graycrab_province_3_21', legacyId: 'province-10', name: 'Земли клана Краба', x: 336, y: 764 },
    { id: 'blackshadowlandsnorth_province_1_29', legacyId: 'province-11', name: 'Северные Земли Теней', x: 88, y: 983 },
    { id: 'goldcoast_province_3_25', legacyId: 'province-12', name: 'Золотое побережье', x: 444, y: 1148 },
    { id: 'redscorpion_province_1_15', legacyId: 'province-13', name: 'Земли клана Скорпиона', x: 264, y: 576 },
    { id: 'redscorpion_province_3_14', legacyId: 'province-14', name: 'Земли клана Скорпиона', x: 419, y: 539 },
    { id: 'greendragon_province_3_03', legacyId: 'province-15', name: 'Земли клана Дракона', x: 601, y: 402 },
    { id: 'lavenderislands_province_1_27', legacyId: 'province-16', name: 'Лавандовые острова', x: 699, y: 1232 },
    { id: 'blackshadowlandssouth_province_1_30', legacyId: 'province-17', name: 'Южные Земли Теней', x: 175, y: 1295 },
    { id: 'purpleunicorn_province_1_08', legacyId: 'province-18', name: 'Земли клана Единорога', x: 170, y: 444 },
    { id: 'graycrab_province_2_22', legacyId: 'province-19', name: 'Земли клана Краба', x: 306, y: 954 },
    { id: 'goldcoast_province_2_24', legacyId: 'province-20', name: 'Золотое побережье', x: 587, y: 952 },
    { id: 'redscorpion_capital_2_13', legacyId: 'province-21', name: 'Столица клана Скорпиона', x: 485, y: 669 },
    { id: 'lavenderislands_province_2_26', legacyId: 'province-22', name: 'Лавандовые острова', x: 790, y: 1085 },
    { id: 'graycrab_capital_2_19', legacyId: 'province-23', name: 'Столица клана Краба', x: 328, y: 1142 },
    { id: 'purpleunicorn_province_3_09', legacyId: 'province-24', name: 'Земли клана Единорога', x: 332, y: 416 },
    { id: 'lightbluecrane_capital_2_16', legacyId: 'province-25', name: 'Столица клана Журавля', x: 669, y: 615 },
    { id: 'graycrab_province_1_20', legacyId: 'province-26', name: 'Земли клана Краба', x: 144, y: 702 },
    { id: 'goldcoast_province_3_23', legacyId: 'province-27', name: 'Золотое побережье', x: 442, y: 964 },
    { id: 'lavenderislands_province_1_28', legacyId: 'province-28', name: 'Лавандовые острова', x: 800, y: 1231 },
    { id: 'yellowlion_capital_2_10', legacyId: 'province-29', name: 'Столица клана Льва', x: 556, y: 524 },
    { id: 'lightbluecrane_province_3_18', legacyId: 'province-30', name: 'Земли клана Журавля', x: 485, y: 790 }
];

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV'];
const territoryId = (provinceId: string) => provinceId.replace(/_(?:capital|province)_\d+_\d+$/, '');
const territoryProvinceNumbers = new Map<string, string>();

for (const province of PROVINCES) {
    const siblings = PROVINCES
        .filter(candidate => territoryId(candidate.id) === territoryId(province.id))
        .sort((left, right) => {
            const leftCapital = left.id.includes('_capital_') ? 0 : 1;
            const rightCapital = right.id.includes('_capital_') ? 0 : 1;
            return leftCapital - rightCapital ||
                Number(left.id.slice(-2)) - Number(right.id.slice(-2));
        });
    territoryProvinceNumbers.set(
        province.id,
        ROMAN_NUMERALS[siblings.findIndex(candidate => candidate.id === province.id)] ??
            String(siblings.findIndex(candidate => candidate.id === province.id) + 1)
    );
}

export const PROVINCE_NAMES: Record<string, string> = Object.fromEntries(
    PROVINCES.map(province => [province.id, `${province.name} ${territoryProvinceNumbers.get(province.id)}`])
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

const provinceRegionId = (provinceId: string): RegionId => territoryId(provinceId) as RegionId;

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
    land(1, 2, 420, 98), land(1, 6, 190, 217), land(1, 7, 380, 286),
    land(2, 3, 591, 171), land(2, 7, 453, 308), land(2, 15, 574, 348),
    land(3, 4, 683, 164), land(3, 8, 679, 396), land(3, 15, 658, 343),
    land(4, 5, 762, 144), land(4, 8, 721, 363), land(6, 18, 145, 337),
    land(6, 24, 292, 326), land(7, 14, 438, 464), land(7, 15, 491, 376),
    land(7, 24, 370, 378), land(7, 29, 479, 434), land(8, 15, 662, 444),
    land(8, 25, 686, 542), land(8, 29, 615, 506), land(9, 21, 544, 676),
    land(9, 25, 649, 678), land(9, 29, 548, 624), land(9, 30, 540, 756),
    land(10, 13, 300, 646), land(10, 19, 320, 832), land(10, 21, 392, 696),
    land(10, 26, 289, 734), land(10, 27, 407, 862), land(10, 30, 379, 765),
    land(11, 17, 123, 1164), land(11, 19, 189, 924), land(11, 23, 210, 1010),
    land(11, 26, 121, 839), land(12, 19, 418, 1092), land(12, 20, 526, 999),
    land(12, 23, 386, 1161), land(12, 27, 455, 1030), land(13, 14, 351, 563),
    land(13, 18, 215, 512), land(13, 21, 349, 625), land(13, 24, 316, 516),
    land(13, 26, 192, 612), land(14, 21, 446, 622), land(14, 24, 363, 467),
    land(14, 29, 492, 513), land(15, 29, 562, 451), land(16, 22, 729, 1156),
    land(16, 28, 750, 1236), land(17, 23, 272, 1190), land(18, 24, 292, 452),
    land(18, 26, 76, 520), land(19, 23, 289, 1084), land(19, 26, 271, 813),
    land(19, 27, 390, 977), land(20, 27, 552, 896), land(20, 30, 598, 860),
    land(21, 29, 521, 590), land(21, 30, 477, 726), land(22, 28, 810, 1158),
    land(25, 29, 586, 585), land(27, 30, 492, 853)
];

const sea = (provinceNumber: number, x: number, y: number): SeaBorder => {
    const provinceId = provinceIdByLegacyNumber(provinceNumber);
    return { id: `sea-${provinceId}`, provinceId, x, y };
};

export const SEA_BORDERS: SeaBorder[] = [
    sea(5, 891, 225),
    sea(8, 777, 444),
    sea(25, 783, 633),
    sea(9, 717, 714),
    sea(30, 706, 843),
    sea(20, 686, 935),
    sea(12, 510, 1189),
    sea(23, 340, 1314),
    sea(17, 284, 1383),
    sea(16, 723, 1331),
    sea(22, 795, 975),
    sea(28, 896, 1240)
];

export const COASTAL_PROVINCES = new Set(SEA_BORDERS.map(border => border.provinceId));

export function adjacentProvinceIds(provinceId: string): string[] {
    return LAND_BORDERS
        .filter(border => border.provinces.includes(provinceId))
        .map(border => border.provinces[0] === provinceId ? border.provinces[1] : border.provinces[0]);
}
