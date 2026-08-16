import { useEffect, useRef, useState } from 'react';
import {
    type ActionCardType,
    type OrderTarget,
    type RoomState
} from '../../shared/room';
import type { SecretObjectiveId } from '../../shared/objectives';
import { ProvinceMap } from './ProvinceMap';
import { GameHud } from './hud/GameHud';
import { SecretObjectivePicker } from './objectives/SecretObjectivePicker';
import { GamePhasePanel } from './phase/GamePhasePanel';
import { PlayerRack } from './rack/PlayerRack';
import type { SelectedClanAction } from './types';
import './game.css';

interface GameBoardProps {
    room: RoomState;
    currentPlayerId: string;
    busy: boolean;
    error: string;
    onAdvance: () => Promise<void>;
    onChooseSecretObjective: (objectiveId: SecretObjectiveId) => Promise<void>;
    onSetResolutionReady: (isReady: boolean) => Promise<void>;
    onPlayScout: (orderId: string) => Promise<void>;
    onPlayShugenja: (orderId: string) => Promise<void>;
    onReturnDragonToken: (tokenId: string) => Promise<void>;
    onUseScorpionPeek: (orderId: string | null) => Promise<void>;
    onSwapUnicornOrders: (orderIds: string[]) => Promise<void>;
    onPassPlacement: () => Promise<void>;
    onPlaceOrder: (tokenId: string, target: OrderTarget) => Promise<void>;
    onPlaceControl: (provinceId: string) => Promise<void>;
}
export function GameBoard(props: GameBoardProps) {
    const {
        room,
        currentPlayerId,
        busy,
        error,
        onAdvance,
        onChooseSecretObjective,
        onSetResolutionReady,
        onPlayScout,
        onPlayShugenja,
        onReturnDragonToken,
        onUseScorpionPeek,
        onSwapUnicornOrders,
        onPassPlacement,
        onPlaceOrder,
        onPlaceControl
    } = props;
    const game = room.game;
    const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
    const [selectedActionCard, setSelectedActionCard] = useState<ActionCardType | null>(null);
    const [selectedClanAction, setSelectedClanAction] = useState<SelectedClanAction | null>(null);
    const [unicornOrderIds, setUnicornOrderIds] = useState<string[]>([]);
    const [actionNotice, setActionNotice] = useState<string | null>(null);
    const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);
    const seenLogIds = useRef(new Set<string>());
    const logsInitialized = useRef(false);

    useEffect(() => {
        if (!game?.hand.some(token => token.id === selectedTokenId))
            setSelectedTokenId(null);
    }, [game?.hand, selectedTokenId]);

    useEffect(() => {
        if (game?.phase !== 'placement' || game.turnPlayerId !== currentPlayerId)
            setSelectedActionCard(null);
    }, [currentPlayerId, game?.phase, game?.turnPlayerId]);

    useEffect(() => {
        const entries = game?.log ?? [];
        if (!logsInitialized.current) {
            seenLogIds.current = new Set(entries.map(entry => entry.id));
            logsInitialized.current = true;
            return;
        }

        const freshShugenja = [...entries].reverse().find(entry =>
            !seenLogIds.current.has(entry.id) &&
            entry.type === 'card' &&
            entry.playerId === currentPlayerId &&
            entry.message.toLocaleLowerCase('ru').includes('сюгэндзя')
        );
        for (const entry of entries)
            seenLogIds.current.add(entry.id);
        if (freshShugenja) {
            const detail = freshShugenja.message
                .replace(/^.*?:\s*/, '')
                .replace('раскрыт и сброшен жетон', 'Вы убрали жетон');
            setActionNotice(`✨ ${detail}`);
        }
    }, [currentPlayerId, game?.log]);

    useEffect(() => {
        if (!actionNotice)
            return;
        const timer = window.setTimeout(() => setActionNotice(null), 4200);
        return () => window.clearTimeout(timer);
    }, [actionNotice]);

    useEffect(() => {
        const player = room.players.find(candidate => candidate.id === currentPlayerId);
        const stats = game?.players.find(candidate => candidate.playerId === currentPlayerId);
        if (game?.clanActionPending === 'scorpion-peek' && player?.clanId === 'scorpion' && !stats?.clanAbilityUsed) {
            setSelectedClanAction('scorpion-peek');
            return;
        }
        if (game?.clanActionPending === 'unicorn-swap' && player?.clanId === 'unicorn' && !stats?.clanAbilityUsed) {
            setSelectedClanAction('unicorn-swap');
            return;
        }
        if (selectedClanAction === 'unicorn-swap') {
            setSelectedClanAction(null);
            setUnicornOrderIds([]);
        }
        if (selectedClanAction === 'scorpion-peek' &&
            ((game?.phase !== 'placement' && game?.clanActionPending !== 'scorpion-peek') ||
                stats?.clanAbilityUsed))
            setSelectedClanAction(null);
    }, [currentPlayerId, game?.clanActionPending, game?.phase, game?.players, room.players, selectedClanAction]);

    const turnPlayer = room.players.find(player => player.id === game?.turnPlayerId);

    if (!game)
        return null;

    const currentPlayer = room.players.find(player => player.id === currentPlayerId)!;
    const currentStats = game.players.find(player => player.playerId === currentPlayerId)!;
    const selectedToken = game.hand.find(token => token.id === selectedTokenId) ?? null;
    const isMyTurn = game.turnPlayerId === currentPlayerId;
    const mustReturnDragonToken = currentPlayer.clanId === 'dragon' && currentStats.mustReturnToken;
    const canPlaceOrder = isMyTurn && game.phase === 'placement' && !mustReturnDragonToken;
    const canPlaceControl = isMyTurn && game.phase === 'setup' && currentStats.setupRemaining > 0;
    const setupComplete = game.players.every(player => player.setupRemaining === 0);
    const isRevealReady = game.readyPlayerIds.includes(currentPlayerId);
    const canUseScorpionPeek = currentPlayer.clanId === 'scorpion' &&
        (game.phase === 'placement' || game.clanActionPending === 'scorpion-peek') &&
        currentStats.placedCount > 0 &&
        !currentStats.clanAbilityUsed;
    const scorpionActionPending = currentPlayer.clanId === 'scorpion' &&
        game.clanActionPending === 'scorpion-peek' &&
        !currentStats.clanAbilityUsed;
    const unicornActionPending = currentPlayer.clanId === 'unicorn' &&
        game.clanActionPending === 'unicorn-swap' &&
        !currentStats.clanAbilityUsed;

    async function placeOrder(target: OrderTarget) {
        if (!selectedToken || !canPlaceOrder || busy)
            return;
        setSelectedTokenId(null);
        await onPlaceOrder(selectedToken.id, target);
    }

    async function playActionCard(orderId: string) {
        if (!selectedActionCard || !canPlaceOrder || busy)
            return;
        const card = selectedActionCard;
        setSelectedActionCard(null);
        if (card === 'scout')
            await onPlayScout(orderId);
        else
            await onPlayShugenja(orderId);
    }

    async function playClanAction(orderId: string) {
        if (busy || !selectedClanAction)
            return;
        if (selectedClanAction === 'scorpion-peek') {
            setSelectedClanAction(null);
            await onUseScorpionPeek(orderId);
            return;
        }

        const nextIds = unicornOrderIds.includes(orderId)
            ? unicornOrderIds.filter(id => id !== orderId)
            : [...unicornOrderIds, orderId].slice(-2);
        setUnicornOrderIds(nextIds);
        if (nextIds.length === 2) {
            setSelectedClanAction(null);
            setUnicornOrderIds([]);
            await onSwapUnicornOrders(nextIds);
        }
    }

    if (game.phase === 'objectives')
        return <SecretObjectivePicker room={room} game={game} busy={busy} error={error}
            currentPlayer={currentPlayer} onChoose={onChooseSecretObjective} />;

    return <main className="game-screen">
        <GameHud room={room} currentPlayerId={currentPlayerId} onPlayerHover={setHoveredPlayerId} />

        <section className="game-stage" aria-label="Игровой стол">
            <div className="map-frame">
                <ProvinceMap game={game} players={room.players} currentPlayerId={currentPlayerId}
                    hoveredPlayerId={hoveredPlayerId} selectedToken={selectedActionCard ? null : selectedToken}
                    selectedActionCard={selectedActionCard}
                    selectedClanAction={selectedClanAction}
                    selectedClanOrderIds={unicornOrderIds}
                    orderPlacementDisabled={!canPlaceOrder || busy}
                    controlPlacementActive={canPlaceControl && !busy}
                    onTarget={placeOrder} onActionCardTarget={playActionCard}
                    onClanActionTarget={playClanAction}
                    onPlaceControl={onPlaceControl} />
                {actionNotice && <div className="action-result-toast" role="status">
                    <span>Сюгэндзя</span>
                    <strong>{actionNotice}</strong>
                </div>}
            </div>

            <GamePhasePanel game={game} players={room.players} currentPlayer={currentPlayer} currentStats={currentStats}
                turnPlayer={turnPlayer} busy={busy} canPlaceOrder={canPlaceOrder} setupComplete={setupComplete}
                isRevealReady={isRevealReady} scorpionActionPending={scorpionActionPending}
                unicornActionPending={unicornActionPending} unicornSelectionCount={unicornOrderIds.length}
                onPassPlacement={onPassPlacement} onSetResolutionReady={onSetResolutionReady} onAdvance={onAdvance}
                onSkipScorpion={() => {
                    setSelectedClanAction(null);
                    void onUseScorpionPeek(null);
                }}
                onSkipUnicorn={() => {
                    setSelectedClanAction(null);
                    setUnicornOrderIds([]);
                    void onSwapUnicornOrders([]);
                }} />
        </section>

        <PlayerRack game={game} currentPlayer={currentPlayer} currentStats={currentStats} turnPlayer={turnPlayer}
            busy={busy} isMyTurn={isMyTurn} canPlaceOrder={canPlaceOrder} canPlaceControl={canPlaceControl}
            setupComplete={setupComplete} mustReturnDragonToken={mustReturnDragonToken}
            canUseScorpionPeek={canUseScorpionPeek} selectedToken={selectedToken}
            selectedActionCard={selectedActionCard} selectedClanAction={selectedClanAction}
            unicornOrderIds={unicornOrderIds} onReturnDragonToken={onReturnDragonToken}
            onSelectActionCard={card => {
                setSelectedTokenId(null);
                setSelectedActionCard(selectedActionCard === card ? null : card);
                setSelectedClanAction(null);
            }}
            onToggleScorpion={() => {
                setSelectedActionCard(null);
                setSelectedTokenId(null);
                setSelectedClanAction(selectedClanAction === 'scorpion-peek' ? null : 'scorpion-peek');
            }}
            onSelectToken={token => {
                setSelectedActionCard(null);
                setSelectedClanAction(null);
                setSelectedTokenId(token.id === selectedTokenId ? null : token.id);
            }} />

        {error && <p className="game-error">{error}</p>}
    </main>;
}
