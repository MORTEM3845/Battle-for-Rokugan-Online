export type SecretObjectiveId =
    | 'five_winds_court'
    | 'great_northern_wall'
    | 'lair_of_secrets'
    | 'emerald_of_the_empire'
    | 'path_of_the_sail'
    | 'reclaiming_lost_lands'
    | 'path_of_humanity'
    | 'last_line'
    | 'fields_of_battle'
    | 'great_library'
    | 'web_of_influence'
    | 'rice_of_the_empire';

export interface SecretObjectiveDefinition {
    id: SecretObjectiveId;
    name: string;
    condition: string;
    honor: number;
}

export const SECRET_OBJECTIVES: SecretObjectiveDefinition[] = [
    {
        id: 'five_winds_court',
        name: 'Суд пяти ветров',
        condition: 'Контролировать столицу Единорога или минимум 2 провинции региона Единорога.',
        honor: 6
    },
    {
        id: 'great_northern_wall',
        name: 'Великая Стена Севера',
        condition: 'Контролировать столицу Дракона или минимум 2 провинции региона Дракона.',
        honor: 6
    },
    {
        id: 'lair_of_secrets',
        name: 'Логово Тайн',
        condition: 'Контролировать столицу Скорпиона или минимум 2 провинции региона Скорпиона.',
        honor: 7
    },
    {
        id: 'emerald_of_the_empire',
        name: 'Изумруд Империи',
        condition: 'Контролировать 6 связанных соседством провинций, расположенных в 3 территориях.',
        honor: 10
    },
    {
        id: 'path_of_the_sail',
        name: 'Путь Паруса',
        condition: 'Контролировать минимум 6 прибрежных провинций.',
        honor: 10
    },
    {
        id: 'reclaiming_lost_lands',
        name: 'Обретение потерянных земель',
        condition: 'Контролировать обе провинции Земель Теней.',
        honor: 3
    },
    {
        id: 'path_of_humanity',
        name: 'Путь человечности',
        condition: 'Контролировать наименьшее количество провинций среди игроков.',
        honor: 10
    },
    {
        id: 'last_line',
        name: 'Последний рубеж',
        condition: 'Контролировать столицу Краба или минимум 2 провинции региона Краба.',
        honor: 5
    },
    {
        id: 'fields_of_battle',
        name: 'Поля сражений',
        condition: 'Контролировать столицу Льва или минимум 2 провинции региона Льва.',
        honor: 7
    },
    {
        id: 'great_library',
        name: 'Великая Библиотека',
        condition: 'Контролировать столицу Феникса или минимум 2 провинции региона Феникса.',
        honor: 7
    },
    {
        id: 'web_of_influence',
        name: 'Сеть влияния',
        condition: 'Контролировать минимум по 1 провинции в 7 разных территориях.',
        honor: 10
    },
    {
        id: 'rice_of_the_empire',
        name: 'Рис Империи',
        condition: 'Контролировать столицу Журавля или минимум 2 провинции региона Журавля.',
        honor: 6
    }
];

export const SECRET_OBJECTIVES_BY_ID: Record<SecretObjectiveId, SecretObjectiveDefinition> =
    Object.fromEntries(SECRET_OBJECTIVES.map(objective => [objective.id, objective])) as
        Record<SecretObjectiveId, SecretObjectiveDefinition>;
