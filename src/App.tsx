import { useEffect, useMemo, useState } from 'react';
import { CLANS, type ClanId, type PlayerSession, type RoomState } from '../shared/room';
import { roomApi } from './api';
import { GameBoard } from './game/GameBoard';

const sessionKey = (code: string) => `rokugan-session-${code}`;

function saveSession(session: PlayerSession): void {
    localStorage.setItem(sessionKey(session.roomCode), JSON.stringify(session));
}

function loadSession(code: string): PlayerSession | null {
    const value = localStorage.getItem(sessionKey(code));
    if (!value)
        return null;
    try {
        return JSON.parse(value) as PlayerSession;
    } catch {
        return null;
    }
}

function roomCodeFromPath(): string | null {
    const match = location.pathname.match(/^\/room\/([A-Z2-9]{6})$/i);
    return match ? match[1].toUpperCase() : null;
}

function navigate(path: string): void {
    history.pushState({}, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
}

export default function App() {
    const [roomCode, setRoomCode] = useState(roomCodeFromPath());

    useEffect(() => {
        const handler = () => setRoomCode(roomCodeFromPath());
        addEventListener('popstate', handler);
        return () => removeEventListener('popstate', handler);
    }, []);

    return roomCode ? <RoomPage code={roomCode} /> : <HomePage />;
}

function HomePage() {
    const [name, setName] = useState(localStorage.getItem('rokugan-player-name') ?? '');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function createRoom() {
        try {
            setBusy(true);
            setError('');
            localStorage.setItem('rokugan-player-name', name.trim());
            const result = await roomApi.create(name);
            saveSession(result.session);
            navigate(`/room/${result.room.code}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось создать комнату');
        } finally {
            setBusy(false);
        }
    }

    function openRoom() {
        const normalized = code.trim().toUpperCase();
        if (!/^[A-Z2-9]{6}$/.test(normalized)) {
            setError('Код комнаты должен состоять из 6 символов');
            return;
        }
        navigate(`/room/${normalized}`);
    }

    return <main className="page home-page">
        <section className="panel hero-panel">
            <p className="eyebrow">Браузерная настольная игра</p>
            <h1>Битва за Рокуган</h1>
            <p className="lead">Создай приватную комнату, добавь бота и выбери один из семи Великих кланов.</p>

            <label>Имя игрока
                <input value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="Например, Александр" />
            </label>
            <button className="primary" disabled={busy || !name.trim()} onClick={createRoom}>Создать комнату</button>

            <div className="divider"><span>или</span></div>

            <label>Код комнаты
                <input value={code} maxLength={6} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABC234" />
            </label>
            <button disabled={busy} onClick={openRoom}>Войти по коду</button>
            {error && <p className="error">{error}</p>}
        </section>
    </main>;
}

function RoomPage({ code }: { code: string }) {
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
                    setRoom(state);
                    setError('');
                }
            } catch (e) {
                if (active)
                    setError(e instanceof Error ? e.message : 'Не удалось загрузить комнату');
            } finally {
                if (active)
                    timer = window.setTimeout(refresh, 1000);
            }
        };

        void refresh();
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [code, session]);

    async function run(action: () => Promise<RoomState>) {
        try {
            setBusy(true);
            setError('');
            setRoom(await action());
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Не удалось выполнить действие');
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
            setError(e instanceof Error ? e.message : 'Не удалось войти в комнату');
        } finally {
            setBusy(false);
        }
    }

    if (!room)
        return <main className="page"><section className="panel"><h1>Комната {code}</h1><p>{error || 'Загрузка…'}</p></section></main>;

    if (!session || !currentPlayer) {
        return <main className="page home-page">
            <section className="panel hero-panel">
                <button className="link-button" onClick={() => navigate('/')}>← На главную</button>
                <p className="eyebrow">Комната {code}</p>
                <h1>Войти в лобби</h1>
                <label>Имя игрока
                    <input value={name} maxLength={24} onChange={e => setName(e.target.value)} />
                </label>
                <button className="primary" disabled={busy || !name.trim() || room.players.length >= room.maxPlayers || room.status !== 'lobby'} onClick={joinRoom}>
                    {room.players.length >= room.maxPlayers ? 'Комната заполнена' : 'Войти'}
                </button>
                {error && <p className="error">{error}</p>}
            </section>
        </main>;
    }

    if (room.status === 'playing') {
        return <GameBoard room={room} currentPlayerId={currentPlayer.id} busy={busy} error={error}
            onAdvance={() => run(() => roomApi.advanceGame(session))}
            onPlaceOrder={(tokenId, target) => run(() => roomApi.placeOrder(session, tokenId, target))} />;
    }

    const inviteUrl = `${location.origin}/room/${code}`;
    const canStart = room.players.length >= 2 && room.players.every(player => player.clanId && player.isReady);

    return <main className="page lobby-page">
        <header className="lobby-header">
            <div>
                <p className="eyebrow">Приватная комната</p>
                <h1>{code}</h1>
            </div>
            <div className="header-actions">
                <button onClick={() => navigator.clipboard.writeText(inviteUrl)}>Скопировать ссылку</button>
                <button className="link-button" onClick={() => navigate('/')}>На главную</button>
            </div>
        </header>

        <section className="panel">
            <div className="section-title">
                <div><h2>Игроки</h2><p>{room.players.length} из {room.maxPlayers}</p></div>
                {isHost && room.players.length < room.maxPlayers && <button disabled={busy} onClick={() => run(() => roomApi.addBot(session))}>Добавить случайного бота</button>}
            </div>
            <div className="players-grid">
                {room.players.map(player => <PlayerCard key={player.id} player={player} removable={isHost && player.kind === 'bot'}
                    onRemove={() => run(() => roomApi.removeBot(session, player.id))} />)}
            </div>
        </section>

        <section className="panel">
            <div className="section-title"><div><h2>Выбор клана</h2><p>Кланы не могут повторяться</p></div></div>
            <div className="clan-grid">
                {CLANS.map(clan => {
                    const owner = room.players.find(player => player.clanId === clan.id);
                    const selected = currentPlayer.clanId === clan.id;
                    const disabled = busy || (!!owner && owner.id !== currentPlayer.id) || currentPlayer.isReady;
                    return <button key={clan.id} className={`clan-card clan-${clan.id} ${selected ? 'selected' : ''}`} disabled={disabled}
                        onClick={() => run(() => roomApi.selectClan(session, clan.id as ClanId))}>
                        <strong>{clan.name}</strong>
                        <span>{owner ? owner.name : 'Свободен'}</span>
                    </button>;
                })}
            </div>
        </section>

        <section className="panel action-panel">
            <div>
                <h2>{currentPlayer.isReady ? 'Ты готов к игре' : 'Подтверди выбор'}</h2>
                <p>{currentPlayer.clanId ? `Выбран клан: ${CLANS.find(clan => clan.id === currentPlayer.clanId)?.name}` : 'Сначала выбери клан'}</p>
            </div>
            <div className="action-buttons">
                <button disabled={busy || !currentPlayer.clanId} onClick={() => run(() => roomApi.setReady(session, !currentPlayer.isReady))}>
                    {currentPlayer.isReady ? 'Отменить готовность' : 'Готов'}
                </button>
                {isHost && <button className="primary" disabled={busy || !canStart} onClick={() => run(() => roomApi.start(session))}>Начать игру</button>}
            </div>
        </section>
        {error && <p className="error floating-error">{error}</p>}
    </main>;
}

function PlayerCard({ player, removable, onRemove }: { player: RoomState['players'][number]; removable?: boolean; onRemove?: () => void }) {
    const clan = CLANS.find(item => item.id === player.clanId);
    return <article className="player-card">
        <div className="player-avatar">{player.kind === 'bot' ? 'AI' : player.name.slice(0, 1).toUpperCase()}</div>
        <div className="player-info">
            <strong>{player.name}</strong>
            <span>{player.isHost ? 'Хозяин · ' : ''}{player.kind === 'bot' ? 'Бот' : 'Игрок'}</span>
            <span>{clan ? `Клан ${clan.name}` : 'Клан не выбран'}</span>
        </div>
        <span className={`status ${player.isReady ? 'ready' : ''}`}>{player.isReady ? 'Готов' : 'Не готов'}</span>
        {removable && <button className="danger small" onClick={onRemove}>Удалить</button>}
    </article>;
}
