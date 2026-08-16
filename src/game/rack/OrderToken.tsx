import type { BattleTokenView } from '../../../shared/room';
import { TOKEN_INFO } from '../presentation';

export function OrderToken({ token, selected, disabled, returnMode, onClick }: {
    token: BattleTokenView; selected: boolean; disabled: boolean; returnMode?: boolean; onClick: () => void;
}) {
    const info = TOKEN_INFO[token.type];
    return <button className={`battle-token battle-token-${token.type} ${selected ? 'is-selected' : ''} ${token.isClanToken ? 'is-clan-token' : ''} ${returnMode && token.type !== 'blank' ? 'is-return-option' : ''}`}
        type="button" disabled={disabled} onClick={onClick}
        title={returnMode && token.type !== 'blank' ? 'Вернуть этот жетон в запас' : info.hint}>
        <span>{info.symbol}</span>{token.strength !== null && <b>{token.strength}</b>}
        {token.isClanToken && <em>клан</em>}<small>{info.label}</small>
    </button>;
}
