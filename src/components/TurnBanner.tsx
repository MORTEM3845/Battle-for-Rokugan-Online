import { useEffect } from 'react';
import type { RoomState } from '../../shared/room';

interface TurnBannerProps {
    room: RoomState;
    currentPlayerId: string;
}

export function TurnBanner({ room, currentPlayerId }: TurnBannerProps) {
    const game = room.game;
    const hidden = !game || game.phase === 'resolution' || game.phase === 'finished';
    const currentPlayer = room.players.find(player => player.id === currentPlayerId);
    const turnPlayer = room.players.find(player => player.id === game?.turnPlayerId);
    const currentStats = game?.players.find(player => player.playerId === currentPlayerId);
    const pendingForCurrentPlayer =
        game?.clanActionPending === 'scorpion-peek' && currentPlayer?.clanId === 'scorpion' ||
        game?.clanActionPending === 'unicorn-swap' && currentPlayer?.clanId === 'unicorn';

    let isYours = false;
    let title = 'ОЖИДАНИЕ';
    let text = 'Другие игроки завершают действие';

    if (game?.phase === 'objectives') {
        isYours = !currentStats?.hasSecretObjective;
        title = isYours ? 'ВАШЕ РЕШЕНИЕ' : 'ОЖИДАЕМ ИГРОКОВ';
        text = isYours ? 'Выберите тайную цель' : 'Не все игроки выбрали тайную цель';
    } else if (game?.phase === 'setup' || game?.phase === 'placement') {
        isYours = game.turnPlayerId === currentPlayerId;
        title = isYours ? 'ВАШ ХОД' : 'СЕЙЧАС ХОДИТ';
        text = isYours
            ? game.phase === 'setup' ? 'Разместите жетон контроля на свободной провинции' : 'Выберите приказ и цель на карте'
            : turnPlayer?.name ?? 'другой игрок';
    } else if (game?.phase === 'reveal') {
        const isReady = game.readyPlayerIds.includes(currentPlayerId);
        isYours = pendingForCurrentPlayer || (!game.clanActionPending && !isReady);
        title = isYours ? 'ТРЕБУЕТСЯ ВАШЕ ДЕЙСТВИЕ' : 'ВСКРЫТИЕ ПРИКАЗОВ';
        text = pendingForCurrentPlayer
            ? 'Завершите способность клана перед вскрытием'
            : isReady ? 'Ожидаем подтверждения остальных игроков' : 'Изучите приказы и подтвердите готовность';
    }

    useEffect(() => {
        const defaultTitle = 'Битва за Рокуган';
        document.title = !hidden && isYours ? `⚔ ${title} — Битва за Рокуган` : defaultTitle;
        return () => { document.title = defaultTitle; };
    }, [hidden, isYours, title]);

    if (hidden)
        return null;

    return <div className={`prominent-turn-banner ${isYours ? 'is-yours' : ''}`} role="status" aria-live="polite">
        <span className="turn-banner-mon">戦</span>
        <div><b>{title}</b><strong>{text}</strong></div>
        <i aria-hidden="true" />
    </div>;
}
