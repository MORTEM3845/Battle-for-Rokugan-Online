import {
    CLAN_RULES, type ActionCardType, type BattleTokenView, type GamePlayerView,
    type GameViewState, type RoomPlayer
} from '../../../shared/room';
import type { SelectedClanAction } from '../types';
import { ClanMon } from '../../components/ClanMon';
import { SecretObjectiveTab } from '../objectives/SecretObjectiveTab';
import { TOKEN_INFO, clanStyle } from '../presentation';
import { ActionCardHand } from './ActionCardHand';
import { OrderToken } from './OrderToken';
import { TokenInventory } from './TokenInventory';

interface PlayerRackProps {
    game: GameViewState;
    currentPlayer: RoomPlayer;
    currentStats: GamePlayerView;
    turnPlayer?: RoomPlayer;
    busy: boolean;
    canPlaceOrder: boolean;
    canPlaceControl: boolean;
    setupComplete: boolean;
    mustReturnDragonToken: boolean;
    canUseScorpionPeek: boolean;
    selectedToken: BattleTokenView | null;
    selectedActionCard: ActionCardType | null;
    selectedClanAction: SelectedClanAction | null;
    unicornOrderIds: string[];
    onSelectActionCard: (card: ActionCardType) => void;
    onToggleScorpion: () => void;
    onSelectToken: (token: BattleTokenView) => void;
    onReturnDragonToken: (tokenId: string) => Promise<void>;
}

export function PlayerRack(props: PlayerRackProps) {
    const { game, currentPlayer, currentStats, turnPlayer, busy, canPlaceOrder, canPlaceControl,
        setupComplete, mustReturnDragonToken, canUseScorpionPeek, selectedToken, selectedActionCard,
        selectedClanAction, unicornOrderIds, onSelectActionCard, onToggleScorpion, onSelectToken,
        onReturnDragonToken } = props;
    if (game.phase === 'finished')
        return <section className="private-rack is-finished" aria-label="Тайная цель">
            <SecretObjectiveTab objective={game.secretObjective} achieved={game.secretObjectiveAchieved} finished />
        </section>;
    const hint = rackHint(game, currentStats, mustReturnDragonToken, selectedClanAction, selectedActionCard, selectedToken, unicornOrderIds.length);
    return <section className="private-rack" aria-label="Тайная цель и ваши жетоны">
        <SecretObjectiveTab objective={game.secretObjective} achieved={game.secretObjectiveAchieved} finished={false} />
        <TokenInventory rows={game.tokenPool} />
        <div className="token-hand">
            {game.phase === 'setup' && <div className="setup-control-prompt">
                <span className="control-token-sample" style={clanStyle(currentPlayer)}>{currentPlayer.clanId
                    ? <ClanMon clanId={currentPlayer.clanId} className="control-token-sample-mon" />
                    : '?'}</span>
                <div><b>{currentStats.setupRemaining} жетонов контроля</b><small>{canPlaceControl
                    ? 'Нажмите на любую свободную провинцию'
                    : setupComplete ? 'Вся начальная армия размещена' : `Ожидайте ход игрока ${turnPlayer?.name ?? '—'}`}</small></div>
            </div>}
            {game.phase === 'placement' && <ActionCardHand cards={game.actionCards} selected={selectedActionCard}
                disabled={!canPlaceOrder || busy} onSelect={onSelectActionCard} />}
            {game.phase === 'placement' && currentPlayer.clanId === 'scorpion' &&
                <button className={`clan-action-card scorpion-action ${selectedClanAction === 'scorpion-peek' ? 'is-selected' : ''}`}
                    disabled={busy || !canUseScorpionPeek} onClick={onToggleScorpion} title={CLAN_RULES.scorpion.ability}>
                    <ClanMon clanId="scorpion" className="clan-action-card-mon" /><b>Подглядеть</b><em>{currentStats.clanAbilityUsed ? '✓' : '1×'}</em>
                </button>}
            {game.phase !== 'setup' && game.hand.map(token => <OrderToken key={token.id} token={token}
                selected={token.id === selectedToken?.id} returnMode={mustReturnDragonToken}
                disabled={mustReturnDragonToken ? busy || token.type === 'blank' : !canPlaceOrder || busy ||
                    (currentStats.isRonin && (token.type === 'raid' || token.type === 'diplomacy'))}
                onClick={() => mustReturnDragonToken ? void onReturnDragonToken(token.id) : onSelectToken(token)} />)}
        </div>
        <div className="rack-note">
            <strong>{rackTitle(game, mustReturnDragonToken, selectedClanAction, selectedActionCard, selectedToken)}</strong>
            {hint && <span>{hint}</span>}
        </div>
    </section>;
}

function rackTitle(game: GameViewState, dragon: boolean, clan: SelectedClanAction | null,
    card: ActionCardType | null, token: BattleTokenView | null): string {
    if (dragon) return 'Предвидение Дракона';
    if (clan === 'scorpion-peek') return 'Шёпот Скорпиона';
    if (clan === 'unicorn-swap') return 'Манёвр Единорога';
    if (card) return card === 'scout' ? 'Разведка' : 'Сюгэндзя';
    if (token) return TOKEN_INFO[token.type].label;
    return game.phase === 'setup' ? 'Начальные владения' : `${game.hand.length} жетонов в активе`;
}

function rackHint(game: GameViewState, stats: GamePlayerView, dragon: boolean, clan: SelectedClanAction | null,
    card: ActionCardType | null, token: BattleTokenView | null, unicornCount: number): string {
    if (dragon) return 'Нажмите на один непустой жетон, чтобы вернуть его в запас и оставить шесть.';
    if (clan === 'scorpion-peek') return 'Выберите один закрытый жетон соперника на карте.';
    if (clan === 'unicorn-swap') return `Выберите два своих жетона на карте · выбрано ${unicornCount}/2`;
    if (card) return card === 'scout' ? 'Тайно посмотрите один закрытый жетон соперника.' :
        'Раскройте и сбросьте один не защищённый благословением жетон соперника.';
    if (token) return TOKEN_INFO[token.type].hint;
    if (game.phase === 'setup') return 'Квадратный жетон с гербом означает контроль провинции';
    if (stats.skipsPlacement) return 'В этом раунде у вас не осталось законных размещений';
    return stats.isRonin
        ? 'Статус ронина проверяется в начале раунда; невозможные оставшиеся ходы пропускаются автоматически'
        : '';
}

