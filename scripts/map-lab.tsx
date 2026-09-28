// Local Vite fixture: /scripts/map-lab.html. No room, storage or network mutations.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProvinceMap } from '../src/game/ProvinceMap';
import { CLANS, type BattleTokenView, type GameViewState, type PlacedOrderView, type RoomPlayer } from '../shared/room';
import { LAND_BORDERS, PROVINCES, SEA_BORDERS } from '../shared/map';
import '../src/styles.css';
import '../src/features.css';
import '../src/game/game.css';
import '../src/polish.css';
import './map-lab.css';

const players: RoomPlayer[] = CLANS.map(clan => ({
    id: clan.id, clanId: clan.id, name: clan.name, kind: 'human', isHost: false, isReady: true
}));
const makeOrder = (id: string, target: PlacedOrderView['target'], type: PlacedOrderView['type'], index: number): PlacedOrderView => ({
    id, target, type, playerId: players[index % players.length].id, strength: 2, revealed: true
});
const provinceOrders = PROVINCES.map((province, index) => makeOrder(province.id,
    { kind: 'province', id: province.id }, 'shinobi', index));
const landOrders = LAND_BORDERS.flatMap(border => border.provinces.map((provinceId, index) => makeOrder(
    `${border.id}-${provinceId}`, { kind: 'land-border', id: border.id, provinceId }, 'army', index)));
const seaOrders = SEA_BORDERS.map(border => makeOrder(border.id,
    { kind: 'sea-border', id: border.id, provinceId: border.provinceId }, 'fleet', 0));

function MapLab() {
    const [outlines, setOutlines] = useState(true);
    const [controls, setControls] = useState(true);
    const [targets, setTargets] = useState(true);
    const [scenario, setScenario] = useState('none');
    const [selectedType, setSelectedType] = useState('none');
    const [lastTarget, setLastTarget] = useState('');
    const orders = scenario === 'province' ? provinceOrders : scenario === 'land' ? landOrders :
        scenario === 'sea' ? seaOrders : scenario === 'all' ? [...provinceOrders, ...landOrders, ...seaOrders] : [];
    const game: GameViewState = {
        stage: 'rounds', round: 1, phase: 'placement', firstPlayerId: players[0].id, turnPlayerId: players[0].id,
        players: [], provinces: Object.fromEntries(PROVINCES.map((province, index) => [province.id, players[index % players.length].id])),
        defenseBonuses: {}, provinceSpecials: {}, orders, resolution: null, readyPlayerIds: [], log: [], hand: [],
        tokenPool: [], actionCards: { scout: 0, shugenja: 0 }, canPassPlacement: false,
        secretObjectiveOptions: [], secretObjective: null, secretObjectiveAchieved: false, clanActionPending: null, results: null
    };
    const selectedToken = selectedType === 'none' ? null : { id: 'lab-token', type: selectedType, strength: 2 } as BattleTokenView;
    return <main className={`game-screen token-style-paper map-lab ${outlines ? 'show-outlines' : ''} ${controls ? '' : 'hide-controls'} ${targets ? 'show-targets' : ''}`}>
        <header className="map-lab-toolbar">
            <strong>Проверка карты · локальные данные</strong>
            <label><input type="checkbox" checked={outlines} onChange={e => setOutlines(e.target.checked)} />Границы</label>
            <label><input type="checkbox" checked={controls} onChange={e => setControls(e.target.checked)} />Контроль</label>
            <label><input type="checkbox" checked={targets} onChange={e => setTargets(e.target.checked)} />Все точки атак</label>
            <label>Приказы<select value={scenario} onChange={e => setScenario(e.target.value)}>
                <option value="none">Нет</option><option value="province">Во всех провинциях</option>
                <option value="land">На границах в обе стороны</option><option value="sea">Все флоты</option>
                <option value="all">Нагрузочная проверка: все</option>
            </select></label>
            <label>Выбрать жетон<select value={selectedType} onChange={e => setSelectedType(e.target.value)}>
                <option value="none">Нет</option><option value="army">Армия</option><option value="fleet">Флот</option>
                <option value="shinobi">Синоби</option><option value="raid">Набег</option><option value="diplomacy">Дипломатия</option>
            </select></label>
        </header>
        <ProvinceMap game={game} players={players} currentPlayerId={players[0].id} hoveredPlayerId={null}
            selectedToken={selectedToken} selectedActionCard={null} selectedClanAction={null} selectedClanOrderIds={[]}
            orderPlacementDisabled={false} controlPlacementActive={false} onTarget={target => setLastTarget(JSON.stringify(target))}
            onActionCardTarget={() => {}} onClanActionTarget={() => {}} onPlaceControl={() => {}} />
        <output className="map-lab-result">{lastTarget || `${PROVINCES.length} провинций · ${LAND_BORDERS.length} сухопутные границы · ${SEA_BORDERS.length} морских целей · ${orders.length} приказов`}</output>
    </main>;
}

createRoot(document.getElementById('root')!).render(<MapLab />);
