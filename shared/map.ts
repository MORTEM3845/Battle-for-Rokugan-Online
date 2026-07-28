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

export const PROVINCE_CENTERS: Record<string, MapPoint> = {
    'province-01': { x: 237, y: 143 },
    'province-02': { x: 526, y: 175 },
    'province-03': { x: 645, y: 203 },
    'province-04': { x: 713, y: 186 },
    'province-05': { x: 855, y: 197 },
    'province-06': { x: 169, y: 264 },
    'province-07': { x: 420, y: 361 },
    'province-08': { x: 689, y: 463 },
    'province-09': { x: 615, y: 705 },
    'province-10': { x: 340, y: 776 },
    'province-11': { x: 108, y: 1039 },
    'province-12': { x: 428, y: 1184 },
    'province-13': { x: 240, y: 584 },
    'province-14': { x: 411, y: 539 },
    'province-15': { x: 583, y: 388 },
    'province-16': { x: 683, y: 1248 },
    'province-17': { x: 169, y: 1301 },
    'province-18': { x: 148, y: 395 },
    'province-19': { x: 300, y: 948 },
    'province-20': { x: 575, y: 952 },
    'province-21': { x: 442, y: 663 },
    'province-22': { x: 802, y: 1093 },
    'province-23': { x: 295, y: 1139 },
    'province-24': { x: 320, y: 414 },
    'province-25': { x: 669, y: 615 },
    'province-26': { x: 144, y: 702 },
    'province-27': { x: 471, y: 967 },
    'province-28': { x: 808, y: 1231 },
    'province-29': { x: 548, y: 516 },
    'province-30': { x: 528, y: 806 }
};

const land = (a: number, b: number, x: number, y: number): LandBorder => {
    const left = `province-${String(a).padStart(2, '0')}`;
    const right = `province-${String(b).padStart(2, '0')}`;
    return { id: `land-${left}-${right}`, provinces: [left, right], x, y };
};

export const LAND_BORDERS: LandBorder[] = [
    land(1, 2, 428, 121), land(1, 6, 181, 210), land(1, 7, 378, 281),
    land(2, 3, 600, 163), land(2, 7, 455, 302), land(2, 15, 570, 330),
    land(3, 4, 684, 162), land(3, 8, 684, 378), land(3, 15, 662, 359),
    land(4, 5, 769, 187), land(4, 8, 724, 358), land(6, 18, 117, 303),
    land(6, 24, 286, 327), land(7, 14, 439, 456), land(7, 15, 494, 377),
    land(7, 24, 380, 375), land(7, 29, 480, 426), land(8, 15, 662, 440),
    land(8, 25, 689, 550), land(8, 29, 622, 503), land(9, 21, 540, 683),
    land(9, 25, 626, 668), land(9, 29, 558, 626), land(9, 30, 599, 779),
    land(10, 13, 294, 661), land(10, 19, 324, 842), land(10, 21, 370, 696),
    land(10, 26, 274, 722), land(10, 27, 404, 875), land(10, 30, 392, 794),
    land(11, 17, 99, 1165), land(11, 19, 192, 919), land(11, 23, 190, 1015),
    land(11, 26, 108, 860), land(12, 19, 413, 1111), land(12, 20, 507, 1018),
    land(12, 23, 374, 1232), land(12, 27, 451, 1046), land(13, 14, 348, 567),
    land(13, 18, 207, 507), land(13, 21, 346, 632), land(13, 24, 313, 516),
    land(13, 26, 174, 609), land(14, 21, 430, 611), land(14, 24, 367, 482),
    land(14, 29, 482, 514), land(15, 29, 563, 443), land(16, 22, 730, 1167),
    land(16, 28, 743, 1257), land(17, 23, 272, 1214), land(18, 24, 258, 422),
    land(18, 26, 58, 526), land(19, 23, 278, 1063), land(19, 26, 253, 810),
    land(19, 27, 393, 999), land(20, 27, 520, 942), land(20, 30, 616, 866),
    land(21, 29, 522, 599), land(21, 30, 467, 737), land(22, 28, 833, 1140),
    land(25, 29, 599, 585), land(27, 30, 485, 867)
];

export const SEA_BORDERS: SeaBorder[] = [
    { id: 'sea-province-05', provinceId: 'province-05', x: 925, y: 250 },
    { id: 'sea-province-08', provinceId: 'province-08', x: 775, y: 445 },
    { id: 'sea-province-25', provinceId: 'province-25', x: 760, y: 610 },
    { id: 'sea-province-09', provinceId: 'province-09', x: 700, y: 715 },
    { id: 'sea-province-30', provinceId: 'province-30', x: 680, y: 820 },
    { id: 'sea-province-20', provinceId: 'province-20', x: 675, y: 930 },
    { id: 'sea-province-12', provinceId: 'province-12', x: 520, y: 1190 },
    { id: 'sea-province-23', provinceId: 'province-23', x: 395, y: 1270 },
    { id: 'sea-province-17', provinceId: 'province-17', x: 300, y: 1390 },
    { id: 'sea-province-16', provinceId: 'province-16', x: 730, y: 1320 },
    { id: 'sea-province-22', provinceId: 'province-22', x: 900, y: 1080 },
    { id: 'sea-province-28', provinceId: 'province-28', x: 900, y: 1250 }
];

export const PROVINCE_IDS = Object.keys(PROVINCE_CENTERS);
export const COASTAL_PROVINCES = new Set(SEA_BORDERS.map(border => border.provinceId));

export function adjacentProvinceIds(provinceId: string): string[] {
    return LAND_BORDERS
        .filter(border => border.provinces.includes(provinceId))
        .map(border => border.provinces[0] === provinceId ? border.provinces[1] : border.provinces[0]);
}
