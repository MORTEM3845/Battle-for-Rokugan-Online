import type { ActionCardHandView, ActionCardType } from '../../../shared/room';

export function ActionCardHand({ cards, selected, disabled, onSelect }: {
    cards: ActionCardHandView; selected: ActionCardType | null; disabled: boolean;
    onSelect: (card: ActionCardType) => void;
}) {
    return <div className="action-card-hand" aria-label="Карты действий">
        <button className={`action-card scout-card ${selected === 'scout' ? 'is-selected' : ''}`}
            disabled={disabled || cards.scout <= 0} onClick={() => onSelect('scout')}
            title="Тайно посмотреть один закрытый жетон соперника"><span>👁</span><b>Разведка</b><em>×{cards.scout}</em></button>
        <button className={`action-card shugenja-card ${selected === 'shugenja' ? 'is-selected' : ''}`}
            disabled={disabled || cards.shugenja <= 0} onClick={() => onSelect('shugenja')}
            title="Раскрыть и сбросить один жетон соперника"><span>✨</span><b>Сюгэндзя</b><em>×{cards.shugenja}</em></button>
    </div>;
}
