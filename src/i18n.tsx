import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Language = 'ru' | 'en';

type TranslationKey =
    | 'language'
    | 'home.eyebrow' | 'home.title' | 'home.lead' | 'home.playerName' | 'home.playerPlaceholder'
    | 'home.create' | 'home.joinDivider' | 'home.roomCode' | 'home.join' | 'home.feedback'
    | 'home.mapKicker' | 'home.mapCaption' | 'home.invalidCode' | 'home.createError'
    | 'room.private' | 'room.copy' | 'room.home' | 'room.players' | 'room.addBot' | 'room.clans'
    | 'room.clansHint' | 'room.free' | 'room.ready' | 'room.notReady' | 'room.confirm' | 'room.cancelReady'
    | 'room.start' | 'room.selectedClan' | 'room.chooseClan' | 'room.kick' | 'room.kickConfirm'
    | 'room.joinTitle' | 'room.join' | 'room.full' | 'room.loading'
    | 'turn.waiting' | 'turn.waitingText' | 'turn.decision' | 'turn.chooseObjective' | 'turn.waitPlayers'
    | 'turn.yours' | 'turn.current' | 'turn.placeControl' | 'turn.placeOrder' | 'turn.actionRequired'
    | 'turn.reveal' | 'turn.finishClan' | 'turn.waitConfirmations' | 'turn.inspectOrders' | 'turn.close'
    | 'feedback.kicker' | 'feedback.title' | 'feedback.name' | 'feedback.namePlaceholder' | 'feedback.message'
    | 'feedback.messagePlaceholder' | 'feedback.note' | 'feedback.copy' | 'feedback.copied' | 'feedback.openGmail'
    | 'feedback.popupBlocked' | 'feedback.close'
    | 'music.play' | 'music.pause' | 'music.volume' | 'music.missing'
    | 'clan.ability' | 'clan.uniqueToken' | 'clan.chosenBy';

const translations: Record<Language, Record<TranslationKey, string>> = {
    ru: {
        language: 'EN',
        'home.eyebrow': 'Браузерная настольная стратегия',
        'home.title': 'Битва за Рокуган',
        'home.lead': 'Создай приватную комнату, пригласи друзей или добавь ботов и сразись за контроль над провинциями империи.',
        'home.playerName': 'Имя игрока',
        'home.playerPlaceholder': 'Например, Александр',
        'home.create': 'Создать комнату',
        'home.joinDivider': 'или войти в существующую',
        'home.roomCode': 'Код комнаты',
        'home.join': 'Войти',
        'home.feedback': 'Написать автору',
        'home.mapKicker': 'Империя ждёт',
        'home.mapCaption': 'Семь Великих кланов. Пять раундов. Один победитель.',
        'home.invalidCode': 'Код комнаты должен состоять из 6 символов',
        'home.createError': 'Не удалось создать комнату',
        'room.private': 'Приватная комната',
        'room.copy': 'Скопировать ссылку',
        'room.home': 'На главную',
        'room.players': 'Игроки',
        'room.addBot': 'Добавить случайного бота',
        'room.clans': 'Выбор клана',
        'room.clansHint': 'Кланы не могут повторяться. Нажмите карточку, чтобы выбрать даймё.',
        'room.free': 'Свободен',
        'room.ready': 'Готов',
        'room.notReady': 'Не готов',
        'room.confirm': 'Подтвердить выбор',
        'room.cancelReady': 'Отменить готовность',
        'room.start': 'Начать игру',
        'room.selectedClan': 'Выбран клан',
        'room.chooseClan': 'Сначала выберите клан',
        'room.kick': 'Исключить',
        'room.kickConfirm': 'Исключить игрока из комнаты?',
        'room.joinTitle': 'Войти в лобби',
        'room.join': 'Войти',
        'room.full': 'Комната заполнена',
        'room.loading': 'Загрузка…',
        'turn.waiting': 'ОЖИДАНИЕ',
        'turn.waitingText': 'Другие игроки завершают действие',
        'turn.decision': 'ВАШЕ РЕШЕНИЕ',
        'turn.chooseObjective': 'Выберите тайную цель',
        'turn.waitPlayers': 'ОЖИДАЕМ ИГРОКОВ',
        'turn.yours': 'ВАШ ХОД',
        'turn.current': 'СЕЙЧАС ХОДИТ',
        'turn.placeControl': 'Разместите жетон контроля на свободной провинции',
        'turn.placeOrder': 'Выберите приказ и цель на карте',
        'turn.actionRequired': 'ТРЕБУЕТСЯ ВАШЕ ДЕЙСТВИЕ',
        'turn.reveal': 'ВСКРЫТИЕ ПРИКАЗОВ',
        'turn.finishClan': 'Завершите способность клана перед вскрытием',
        'turn.waitConfirmations': 'Ожидаем подтверждения остальных игроков',
        'turn.inspectOrders': 'Изучите приказы и подтвердите готовность',
        'turn.close': 'Скрыть уведомление до следующего действия',
        'feedback.kicker': 'Связь с автором',
        'feedback.title': 'Сообщить о проблеме или идее',
        'feedback.name': 'Ваше имя',
        'feedback.namePlaceholder': 'Как к вам обращаться',
        'feedback.message': 'Сообщение',
        'feedback.messagePlaceholder': 'Опишите баг, пожелание или вопрос',
        'feedback.note': 'Кнопка откроет Gmail в новой вкладке. Письмо отправится только после того, как вы нажмёте «Отправить» в Gmail.',
        'feedback.copy': 'Скопировать текст',
        'feedback.copied': 'Скопировано',
        'feedback.openGmail': 'Открыть Gmail',
        'feedback.popupBlocked': 'Браузер заблокировал вкладку. Текст сообщения скопирован в буфер обмена.',
        'feedback.close': 'Закрыть',
        'music.play': 'Включить музыку',
        'music.pause': 'Пауза',
        'music.volume': 'Громкость',
        'music.missing': 'Добавьте public/audio/rokugan-ambient.mp3 или выберите свой аудиофайл',
        'clan.ability': 'Способность',
        'clan.uniqueToken': 'Особый жетон',
        'clan.chosenBy': 'Выбрал'
    },
    en: {
        language: 'RU',
        'home.eyebrow': 'Online board strategy game',
        'home.title': 'Battle for Rokugan',
        'home.lead': 'Create a private room, invite friends or add bots, and fight for control of the Emerald Empire.',
        'home.playerName': 'Player name',
        'home.playerPlaceholder': 'For example, Alexander',
        'home.create': 'Create room',
        'home.joinDivider': 'or join an existing room',
        'home.roomCode': 'Room code',
        'home.join': 'Join',
        'home.feedback': 'Contact the author',
        'home.mapKicker': 'The Empire awaits',
        'home.mapCaption': 'Seven Great Clans. Five rounds. One victor.',
        'home.invalidCode': 'The room code must contain 6 characters',
        'home.createError': 'Could not create the room',
        'room.private': 'Private room',
        'room.copy': 'Copy invite link',
        'room.home': 'Home',
        'room.players': 'Players',
        'room.addBot': 'Add random bot',
        'room.clans': 'Choose a clan',
        'room.clansHint': 'Clans cannot repeat. Select a card to choose your daimyō.',
        'room.free': 'Available',
        'room.ready': 'Ready',
        'room.notReady': 'Not ready',
        'room.confirm': 'Confirm choice',
        'room.cancelReady': 'Cancel ready',
        'room.start': 'Start game',
        'room.selectedClan': 'Selected clan',
        'room.chooseClan': 'Choose a clan first',
        'room.kick': 'Kick',
        'room.kickConfirm': 'Remove this player from the room?',
        'room.joinTitle': 'Join lobby',
        'room.join': 'Join',
        'room.full': 'Room is full',
        'room.loading': 'Loading…',
        'turn.waiting': 'WAITING',
        'turn.waitingText': 'Other players are finishing an action',
        'turn.decision': 'YOUR DECISION',
        'turn.chooseObjective': 'Choose your secret objective',
        'turn.waitPlayers': 'WAITING FOR PLAYERS',
        'turn.yours': 'YOUR TURN',
        'turn.current': 'CURRENT TURN',
        'turn.placeControl': 'Place a control token in an empty province',
        'turn.placeOrder': 'Choose an order and a target on the map',
        'turn.actionRequired': 'YOUR ACTION IS REQUIRED',
        'turn.reveal': 'REVEALING ORDERS',
        'turn.finishClan': 'Resolve your clan ability before the reveal',
        'turn.waitConfirmations': 'Waiting for the other players to confirm',
        'turn.inspectOrders': 'Inspect the orders and confirm when ready',
        'turn.close': 'Hide until the next action',
        'feedback.kicker': 'Contact the author',
        'feedback.title': 'Report a problem or share an idea',
        'feedback.name': 'Your name',
        'feedback.namePlaceholder': 'How should the author address you?',
        'feedback.message': 'Message',
        'feedback.messagePlaceholder': 'Describe the bug, suggestion, or question',
        'feedback.note': 'The button opens Gmail in a new tab. The email is only sent after you press Send in Gmail.',
        'feedback.copy': 'Copy message',
        'feedback.copied': 'Copied',
        'feedback.openGmail': 'Open Gmail',
        'feedback.popupBlocked': 'The browser blocked the tab. The message was copied to the clipboard.',
        'feedback.close': 'Close',
        'music.play': 'Play music',
        'music.pause': 'Pause',
        'music.volume': 'Volume',
        'music.missing': 'Add public/audio/rokugan-ambient.mp3 or choose your own audio file',
        'clan.ability': 'Ability',
        'clan.uniqueToken': 'Unique token',
        'clan.chosenBy': 'Chosen by'
    }
};

interface LanguageContextValue {
    language: Language;
    setLanguage: (language: Language) => void;
    t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>(() => localStorage.getItem('rokugan-language') === 'en' ? 'en' : 'ru');
    const value = useMemo<LanguageContextValue>(() => ({
        language,
        setLanguage: next => {
            localStorage.setItem('rokugan-language', next);
            document.documentElement.lang = next;
            setLanguageState(next);
        },
        t: key => translations[language][key]
    }), [language]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
    const context = useContext(LanguageContext);
    if (!context)
        throw new Error('useLanguage must be used inside LanguageProvider');
    return context;
}

export function LanguageToggle({ className = '' }: { className?: string }) {
    const { language, setLanguage, t } = useLanguage();
    return <button className={`language-toggle ${className}`.trim()} onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
        title={language === 'ru' ? 'Switch to English' : 'Переключить на русский'}>{t('language')}</button>;
}
