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

export const PROVINCE_NAMES: Record<string, string> = {
    'province-01': 'Северный Предел',
    'province-02': 'Замок Тогаси',
    'province-03': 'Долина Огненных Птиц',
    'province-04': 'Кюдэн Исавы',
    'province-05': 'Побережье Рассвета',
    'province-06': 'Хребет Белых Облаков',
    'province-07': 'Изумрудная Чаща',
    'province-08': 'Янтарный Берег',
    'province-09': 'Озеро Хосуй',
    'province-10': 'Замок Сёдзю',
    'province-11': 'Великая Стена Кайю',
    'province-12': 'Равнина Приливов',
    'province-13': 'Лавандовые Холмы',
    'province-14': 'Перевал Семи Камней',
    'province-15': 'Священная Роща',
    'province-16': 'Остров Восходящей Луны',
    'province-17': 'Южные Врата',
    'province-18': 'Равнины Ки-Рин',
    'province-19': 'Багровая Долина',
    'province-20': 'Сады Додзи',
    'province-21': 'Крепость Акадо',
    'province-22': 'Остров Тихих Садов',
    'province-23': 'Долина Туманов',
    'province-24': 'Лес Бамбукового Ветра',
    'province-25': 'Речные Угодья',
    'province-26': 'Сумеречные Холмы',
    'province-27': 'Нефритовая Долина',
    'province-28': 'Южный Архипелаг',
    'province-29': 'Сердце Империи',
    'province-30': 'Великая Река'
};

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
