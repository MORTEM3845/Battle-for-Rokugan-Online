import type { TokenPoolCountView } from '../../../shared/room';
import { TOKEN_INFO } from '../presentation';
import { OrderIcon } from '../OrderIcon';

export function TokenInventory({ rows }: { rows: TokenPoolCountView[] }) {
    const totals = rows.reduce((result, row) => ({
        stock: result.stock + row.stock, hand: result.hand + row.hand,
        discard: result.discard + row.discard, placed: result.placed + row.placed
    }), { stock: 0, hand: 0, discard: 0, placed: 0 });
    return <details className="token-inventory">
        <summary title={`${totals.hand} жетонов в активе. Показать запас, актив, сброс и сыгранные жетоны`}
            aria-label={`${totals.hand} жетонов в активе. Показать запас жетонов`}>
            <span className="inventory-stack" aria-hidden="true"><i>兵</i><i>船</i><i>忍</i></span>
            <span><b>{totals.hand}</b><small>жетонов в активе</small></span>
        </summary>
        <aside className="token-ledger">
            <div className="ledger-title"><span>Ваша открытая информация</span><h3>Запас боевых жетонов</h3></div>
            <div className="ledger-head"><span>Жетон</span><b>Запас</b><b>Актив</b><b>Сброс</b><b>Поле</b></div>
            <div className="ledger-rows">{rows.map((row, index) =>
                <div className={`ledger-row ${row.isClanToken ? 'is-clan-token' : ''}`}
                    key={`${row.type}-${row.strength}-${row.isClanToken ? 'clan' : 'base'}-${index}`}>
                    <span><i className={`mini-token mini-token-${row.type}`}><OrderIcon type={row.type} /></i>
                        <span>{TOKEN_INFO[row.type].label}{row.strength !== null ? ` ${row.strength}` : ''}</span>
                        {row.isClanToken && <em>клановый</em>}</span>
                    <b>{row.stock}</b><b>{row.hand}</b><b>{row.discard}</b><b>{row.placed}</b>
                </div>)}</div>
            <div className="ledger-total"><span>Всего</span><b>{totals.stock}</b><b>{totals.hand}</b><b>{totals.discard}</b><b>{totals.placed}</b></div>
        </aside>
    </details>;
}
