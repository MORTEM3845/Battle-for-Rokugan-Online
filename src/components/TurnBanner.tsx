import { useEffect, useMemo, useState } from 'react';
import type { RoomState } from '../../shared/room';
import { useLanguage } from '../i18n';

interface TurnBannerProps {
    room: RoomState;
    currentPlayerId: string;
}

export function TurnBanner({ room, currentPlayerId }: TurnBannerProps) {
    const { language, t } = useLanguage();
    const game = room.game;
    const hiddenByPhase = !game || game.phase === 'resolution' || game.phase === 'finished';
    const currentPlayer = room.players.find(player => player.id === currentPlayerId);
    const turnPlayer = room.players.find(player => player.id === game?.turnPlayerId);
    const currentStats = game?.players.find(player => player.playerId === currentPlayerId);
    const pendingForCurrentPlayer =
        game?.clanActionPending === 'scorpion-peek' && currentPlayer?.clanId === 'scorpion' ||
        game?.clanActionPending === 'unicorn-swap' && currentPlayer?.clanId === 'unicorn';
    const stateKey = useMemo(() => game
        ? `${room.code}:${game.round}:${game.phase}:${game.turnPlayerId ?? 'none'}:${game.clanActionPending ?? 'none'}:${game.readyPlayerIds.join(',')}`
        : `${room.code}:none`, [game, room.code]);
    const [dismissedKey, setDismissedKey] = useState<string | null>(null);

    let isYours = false;
    let title = t('turn.waiting');
    let text = t('turn.waitingText');

    if (game?.phase === 'objectives') {
        isYours = !currentStats?.hasSecretObjective;
        title = isYours ? t('turn.decision') : t('turn.waitPlayers');
        text = isYours ? t('turn.chooseObjective') : t('turn.waitPlayers');
    } else if (game?.phase === 'setup' || game?.phase === 'placement') {
        isYours = game.turnPlayerId === currentPlayerId;
        title = isYours ? t('turn.yours') : t('turn.current');
        text = isYours
            ? game.phase === 'setup' ? t('turn.placeControl') : t('turn.placeOrder')
            : turnPlayer?.name ?? (language === 'ru' ? 'другой игрок' : 'another player');
    } else if (game?.phase === 'reveal') {
        const isReady = game.readyPlayerIds.includes(currentPlayerId);
        isYours = pendingForCurrentPlayer || (!game.clanActionPending && !isReady);
        title = isYours ? t('turn.actionRequired') : t('turn.reveal');
        text = pendingForCurrentPlayer
            ? t('turn.finishClan')
            : isReady ? t('turn.waitConfirmations') : t('turn.inspectOrders');
    }

    useEffect(() => {
        const defaultTitle = language === 'ru' ? 'Битва за Рокуган' : 'Battle for Rokugan';
        document.title = !hiddenByPhase && isYours ? `⚔ ${title} — ${defaultTitle}` : defaultTitle;
        return () => { document.title = defaultTitle; };
    }, [hiddenByPhase, isYours, language, title]);

    if (hiddenByPhase || dismissedKey === stateKey)
        return null;

    return <div className={`prominent-turn-banner ${isYours ? 'is-yours' : ''}`} role="status" aria-live="polite">
        <span className="turn-banner-mon">戦</span>
        <div><b>{title}</b><strong>{text}</strong></div>
        <button className="turn-banner-close" onClick={() => setDismissedKey(stateKey)} title={t('turn.close')}
            aria-label={t('turn.close')}>×</button>
    </div>;
}
