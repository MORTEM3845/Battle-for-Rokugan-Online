import { useEffect, useMemo, useState } from 'react';
import { CLANS, CLAN_RULES, type ClanId, type PlayerSession, type RoomState } from '../../shared/room';
import { roomApi } from '../api';
import { AmbientPlayer } from '../components/AmbientPlayer';
import { RoomChat } from '../components/RoomChat';
import { TurnBanner } from '../components/TurnBanner';
import { CLAN_MON, GameBoard } from '../game/GameBoard';
import { LanguageToggle, useLanguage } from '../i18n';
import { loadSession, navigate, saveSession } from '../lib/navigation';

const CLAN_EN: Record<ClanId, { name: string; rule: string; ability: string; unique: string }> = {
    crab: { name: 'Crab', rule: 'Crab Resilience', ability: 'Each faceup control token grants +3 defense instead of +1.', unique: 'Fleet 3' },
    crane: { name: 'Crane', rule: 'Perfect Honor', ability: 'The Crane wins tied battles in which it has the highest tied strength.', unique: 'Extra Diplomacy' },
    dragon: { name: 'Dragon', rule: 'Dragon Foresight', ability: 'Draw one extra token, then return one non-bluff token to your reserve.', unique: 'Blessing 3' },
    lion: { name: 'Lion', rule: 'Unbreakable Lion', ability: 'The Lion bluff has defense 2 when used to defend a province.', unique: 'Army 6' },
    phoenix: { name: 'Phoenix', rule: 'Phoenix Fire', ability: 'When attacking a capital, ignore only its printed defense bonus.', unique: 'Blessing 3' },
    scorpion: { name: 'Scorpion', rule: 'Scorpion Whispers', ability: 'Once per round after placing an order, secretly inspect an enemy order.', unique: 'Shinobi 3' },
    unicorn: { name: 'Unicorn', rule: 'Unicorn Maneuver', ability: 'Before orders are revealed, swap two of your unblessed combat orders.', unique: 'Extra Raid' }
};

export function RoomPage({ code }: { code: string }) {
    const { language, t } = useLanguage();
    const [session, setSession] = useState<PlayerSession | null>(() => loadSession(code));
    const [room, setRoom] = useState<RoomState | null>(null);
    const [name, setName] = useState(localStorage.getItem('rokugan-player-name') ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const currentPlayer = useMemo(() => room?.players.find(player => player.id === session?.playerId) ?? null, [room, session]);
    const isHost = currentPlayer?.isHost === true;

    useEffect(() => {
        let active = true;
        let timer = 0;

        const refresh = async () => {
            try {
                const state = await roomApi.get(code, session);
                if (active) {
                    setRoom(current => current && JSON.stringify(current) === JSON.stringify(state) ? current : state);
                    setError('');
                }
            } catch (e) {
                if (active)
                    setError(e instanceof Error ? e.message : language === 'ru' ? 'Не удалось загрузить комнату' : 'Could not load the room');
            } finally {
                if (active)
                    timer = window.setTimeout(refresh, document.hidden ? 15_000 : 2_000);
            }
        };

        void refresh();
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [code, language, session]);

    async function run(action: () => Promise<RoomState>) {
        try {
            setBusy(true);
            setError('');
            setRoom(await action());
        } catch (e) {
            setError(e instanceof Error ? e.message : language === 'ru' ? 'Не удалось выполнить действие' : 'The action failed');
        } finally {
            setBusy(false);
        }
    }

    async function joinRoom() {
        try {
            setBusy(true);
            setError('');
            localStorage.setItem('rokugan-player-name', name.trim());
            const result = await roomApi.join(code, name);
            saveSession(result.session);
            setSession(result.session);
            setRoom(result.room);
        } catch (e) {
            setError(e instanceof Error ? e.message : language === 'ru' ? 'Не удалось войти в комнату' : 'Could not join the room');
        } finally {
            setBusy(false);
        }
    }

    if (!room)
        return <main className="page"><section className="panel"><h1>{language === 'ru' ? 'Комната' : 'Room'} {code}</h1><p>{error || t('room.loading')}</p></section></main>;

    if (!session || !currentPlayer) {
        return <main className="page home-page">
            <LanguageToggle className="room-language-toggle" />
            <section className="panel hero-panel">
                <button className="link-button" onClick={() => navigate('/')}>← {t('room.home')}</button>
                <p className="eyebrow">{language === 'ru' ? 'Комната' : 'Room'} {code}</p>
                <h1>{t('room.joinTitle')}</h1>
                <label>{t('home.playerName')}
                    <input value={name} maxLength={24} onChange={event => setName(event.target.value)} />
                </label>
                <button className="primary" disabled={busy || !name.trim() || room.players.length >= room.maxPlayers || room.status !== 'lobby'}
                    onClick={() => void joinRoom()}>{room.players.length >= room.maxPlayers ? t('room.full') : t('room.join')}</button>
                {error && <p className="error">{error}</p>}
            </section>
        </main>;
    }

    const tools = <div className="room-tools"><AmbientPlayer /><LanguageToggle /></div>;

    if (room.status === 'playing') {
        return <>
            {tools}
            <TurnBanner room={room} currentPlayerId={currentPlayer.id} />
            <GameBoard room={room} currentPlayerId={currentPlayer.id} busy={busy} error={error}
                onAdvance={() => run(() => roomApi.advanceGame(session, room.game!.phase))}
                onChooseSecretObjective={objectiveId => run(() => roomApi.chooseSecretObjective(session, objectiveId))}
                onSetResolutionReady={isReady => run(() => roomApi.setResolutionReady(session, isReady))}
                onPlayScout={orderId => run(() => roomApi.playScout(session, orderId))}
                onPlayShugenja={orderId => run(() => roomApi.playShugenja(session, orderId))}
                onReturnDragonToken={tokenId => run(() => roomApi.returnDragonToken(session, tokenId))}
                onUseScorpionPeek={orderId => run(() => roomApi.useScorpionPeek(session, orderId))}
                onSwapUnicornOrders={orderIds => run(() => roomApi.swapUnicornOrders(session, orderIds))}
                onPassPlacement={() => run(() => roomApi.passPlacement(session))}
                onPlaceOrder={(tokenId, target) => run(() => roomApi.placeOrder(session, tokenId, target))}
                onPlaceControl={provinceId => run(() => roomApi.placeControl(session, provinceId))} />
            <RoomChat session={session} currentPlayer={currentPlayer} mode="game" />
        </>;
    }

    const inviteUrl = `${location.origin}/room/${code}`;
    const canStart = room.players.length >= 2 && room.players.every(player => player.clanId && player.isReady);

    return <>
        {tools}
        <main className="page lobby-page">
            <header className="lobby-header">
                <div><p className="eyebrow">{t('room.private')}</p><h1>{code}</h1></div>
                <div className="header-actions">
                    <button onClick={() => void navigator.clipboard.writeText(inviteUrl)}>{t('room.copy')}</button>
                    <button className="link-button" onClick={() => navigate('/')}>{t('room.home')}</button>
                </div>
            </header>

            <section className="panel">
                <div className="section-title">
                    <div><h2>{t('room.players')}</h2><p>{room.players.length} / {room.maxPlayers}</p></div>
                    {isHost && room.players.length < room.maxPlayers && <button disabled={busy}
                        onClick={() => void run(() => roomApi.addBot(session))}>{t('room.addBot')}</button>}
                </div>
                <div className="players-grid">
                    {room.players.map(player => <PlayerCard key={player.id} player={player}
                        removable={isHost && !player.isHost} removeText={t('room.kick')}
                        onRemove={() => {
                            if (confirm(`${t('room.kickConfirm')} ${player.name}`))
                                void run(() => roomApi.kickPlayer(session, player.id));
                        }} />)}
                </div>
            </section>

            <section className="panel clan-selection-panel">
                <div className="section-title"><div><h2>{t('room.clans')}</h2><p>{t('room.clansHint')}</p></div></div>
                <div className="clan-grid detailed-clan-grid">
                    {CLANS.map(clan => {
                        const owner = room.players.find(player => player.clanId === clan.id);
                        const selected = currentPlayer.clanId === clan.id;
                        const disabled = busy || (!!owner && owner.id !== currentPlayer.id) || currentPlayer.isReady;
                        const rule = CLAN_RULES[clan.id];
                        const en = CLAN_EN[clan.id];
                        return <button key={clan.id} className={`clan-card detailed-clan-card clan-${clan.id} ${selected ? 'selected' : ''}`}
                            disabled={disabled} onClick={() => void run(() => roomApi.selectClan(session, clan.id as ClanId))}>
                            <span className="clan-card-mon" aria-hidden="true">{CLAN_MON[clan.id]}</span>
                            <span className="clan-card-heading"><strong>{language === 'ru' ? clan.name : en.name}</strong>
                                <em>{owner ? `${t('clan.chosenBy')}: ${owner.name}` : t('room.free')}</em></span>
                            <span className="clan-card-rule"><b>{language === 'ru' ? rule.name : en.rule}</b>
                                <small>{language === 'ru' ? rule.ability : en.ability}</small></span>
                            <span className="clan-card-token"><i>{t('clan.uniqueToken')}</i><b>{language === 'ru' ? rule.uniqueToken.label : en.unique}</b></span>
                        </button>;
                    })}
                </div>
            </section>

            <section className="panel action-panel">
                <div>
                    <h2>{currentPlayer.isReady ? t('room.ready') : t('room.confirm')}</h2>
                    <p>{currentPlayer.clanId
                        ? `${t('room.selectedClan')}: ${language === 'ru' ? CLANS.find(clan => clan.id === currentPlayer.clanId)?.name : CLAN_EN[currentPlayer.clanId].name}`
                        : t('room.chooseClan')}</p>
                </div>
                <div className="action-buttons">
                    <button disabled={busy || !currentPlayer.clanId}
                        onClick={() => void run(() => roomApi.setReady(session, !currentPlayer.isReady))}>
                        {currentPlayer.isReady ? t('room.cancelReady') : t('room.ready')}
                    </button>
                    {isHost && <button className="primary" disabled={busy || !canStart}
                        onClick={() => void run(() => roomApi.start(session))}>{t('room.start')}</button>}
                </div>
            </section>
            {error && <p className="error floating-error">{error}</p>}
        </main>
        <RoomChat session={session} currentPlayer={currentPlayer} mode="lobby" />
    </>;
}

function PlayerCard({ player, removable, removeText, onRemove }: {
    player: RoomState['players'][number];
    removable?: boolean;
    removeText: string;
    onRemove?: () => void;
}) {
    const { language, t } = useLanguage();
    const clan = CLANS.find(item => item.id === player.clanId);
    return <article className="player-card">
        <div className="player-avatar">{player.kind === 'bot' ? 'AI' : player.name.slice(0, 1).toUpperCase()}</div>
        <div className="player-info">
            <strong>{player.name}</strong>
            <span>{player.isHost ? language === 'ru' ? 'Хозяин · ' : 'Host · ' : ''}{player.kind === 'bot' ? language === 'ru' ? 'Бот' : 'Bot' : language === 'ru' ? 'Игрок' : 'Player'}</span>
            <span>{clan ? `${language === 'ru' ? 'Клан' : 'Clan'} ${language === 'ru' ? clan.name : CLAN_EN[clan.id].name}` : t('room.chooseClan')}</span>
        </div>
        <span className={`status ${player.isReady ? 'ready' : ''}`}>{player.isReady ? t('room.ready') : t('room.notReady')}</span>
        {removable && <button className="danger small" onClick={onRemove}>{removeText}</button>}
    </article>;
}
