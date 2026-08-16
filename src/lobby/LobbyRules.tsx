import { useLanguage } from '../i18n';

type RuleToken = { symbol: string; name: string; value: string; text: string };

const RULE_TOKENS_RU: RuleToken[] = [
    { symbol: 'A', name: 'Армия', value: '1–5', text: 'Сражается за сухопутную границу или свою провинцию.' },
    { symbol: 'F', name: 'Флот', value: '1–2', text: 'Сражается за морскую границу или прибрежную провинцию.' },
    { symbol: 'S', name: 'Синоби', value: '1–2', text: 'Может вступить в бой за любую провинцию.' },
    { symbol: '+', name: 'Благословение', value: '+1 / +2', text: 'Усиливает свой боевой жетон и защищает его от эффектов.' },
    { symbol: 'D', name: 'Дипломатия', value: '—', text: 'Укрепляет вашу провинцию: добавляет жетон контроля.' },
    { symbol: 'R', name: 'Погром', value: '—', text: 'Выжигает чужую или ничейную провинцию, если рядом есть ваше владение или синоби.' },
    { symbol: '?', name: 'Пустой', value: 'блеф', text: 'Создаёт ложный приказ и возвращается в руку после вскрытия.' }
];

const RULE_TOKENS_EN: RuleToken[] = [
    { symbol: 'A', name: 'Army', value: '1–5', text: 'Fights across a land border or in one of your provinces.' },
    { symbol: 'F', name: 'Fleet', value: '1–2', text: 'Fights across a sea border or in a coastal province.' },
    { symbol: 'S', name: 'Shinobi', value: '1–2', text: 'Can join a battle for any province.' },
    { symbol: '+', name: 'Blessing', value: '+1 / +2', text: 'Strengthens your combat order and protects it from effects.' },
    { symbol: 'D', name: 'Diplomacy', value: '—', text: 'Fortifies your province by adding a control token.' },
    { symbol: 'R', name: 'Raid', value: '—', text: 'Scorches an enemy or neutral province when supported by an adjacent holding or shinobi.' },
    { symbol: '?', name: 'Blank', value: 'bluff', text: 'Creates a false order and returns to your hand after reveal.' }
];

export function LobbyRules() {
    const { language } = useLanguage();
    const ru = language === 'ru';
    const tokens = ru ? RULE_TOKENS_RU : RULE_TOKENS_EN;

    return <section className="panel lobby-rules-panel">
        <details open>
            <summary className="rules-summary">
                <span className="rules-summary-mark" aria-hidden="true">?</span>
                <span><small>{ru ? 'КРАТКИЙ СПРАВОЧНИК' : 'QUICK REFERENCE'}</small><strong>{ru ? 'Правила и жетоны' : 'Rules & tokens'}</strong></span>
                <i aria-hidden="true" />
            </summary>
            <div className="rules-content">
                <div className="rules-intro">
                    <p>{ru ? 'Игра длится 5 раундов. Захватывайте провинции, укрепляйте их и выполняйте тайную цель — в конце побеждает игрок с наибольшей честью.' : 'The game lasts 5 rounds. Take provinces, fortify them, and complete your secret objective — the most Honor at the end wins.'}</p>
                    <div className="rules-score"><span>{ru ? 'Честь дают' : 'Honor comes from'}</span><b>{ru ? 'провинции · контроль · регионы · цель' : 'provinces · control · regions · objective'}</b></div>
                </div>
                <div className="rules-accordion">
                    <details open><summary>{ru ? 'Как проходит партия' : 'How a game flows'}</summary><ol className="rules-steps">
                        <li><b>{ru ? 'Подготовка.' : 'Setup.'}</b> {ru ? 'Выберите тайную цель и по очереди разместите начальные жетоны контроля.' : 'Choose a secret objective and take turns placing starting control tokens.'}</li>
                        <li><b>{ru ? 'Приказы.' : 'Orders.'}</b> {ru ? 'Каждый раунд возьмите жетоны, затем по очереди кладите их рубашкой вверх.' : 'Each round, draw tokens then place them face down in turn.'}</li>
                        <li><b>{ru ? 'Вскрытие и итог.' : 'Reveal & resolve.'}</b> {ru ? 'Все приказы открываются, эффекты исполняются, а сражения определяют контроль.' : 'All orders are revealed, effects resolve, and battles decide control.'}</li>
                    </ol></details>
                    <details><summary>{ru ? 'Сражения и контроль' : 'Battles & control'}</summary><div className="rules-copy">
                        <p>{ru ? 'Сложите силы своих боевых жетонов. Защитник добавляет напечатанную защиту провинции и +1 за каждый открытый жетон контроля.' : 'Add the strength of your combat tokens. The defender also adds printed province defense and +1 for each faceup control token.'}</p>
                        <p>{ru ? 'Победитель забирает провинцию. Контроль не только даёт очки чести в конце, но и делает владение труднее захватить.' : 'The winner takes the province. Control scores Honor at game end and makes the holding harder to take.'}</p>
                    </div></details>
                    <details><summary>{ru ? 'Полезно помнить' : 'Good to remember'}</summary><ul className="rules-tips">
                        <li>{ru ? 'Благословение кладётся поверх своего боевого жетона, а не в провинцию.' : 'A Blessing goes on top of your combat token, not into a province.'}</li>
                        <li>{ru ? 'Погром убирает контроль и все приказы в цели; провинция становится выжженной.' : 'A Raid removes control and every order at its target; the province becomes scorched.'}</li>
                        <li>{ru ? 'Особый жетон и способность клана указаны на карточке выбранного клана выше.' : 'Your clan card above lists its special token and ability.'}</li>
                    </ul></details>
                </div>
                <div className="rules-token-section">
                    <div><span>{ru ? 'ВАШ ЗАПАС' : 'YOUR SUPPLY'}</span><h3>{ru ? 'Жетоны приказов' : 'Order tokens'}</h3></div>
                    <div className="rules-token-grid">{tokens.map(token => <article className="rules-token" key={token.name}>
                        <span className="rules-token-symbol" aria-hidden="true">{token.symbol}</span>
                        <div><b>{token.name}</b><em>{token.value}</em><p>{token.text}</p></div>
                    </article>)}</div>
                </div>
            </div>
        </details>
    </section>;
}
