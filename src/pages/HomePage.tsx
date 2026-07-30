import { useState } from 'react';
import { roomApi } from '../api';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { navigate, saveSession } from '../lib/navigation';

export function HomePage() {
    const [name, setName] = useState(localStorage.getItem('rokugan-player-name') ?? '');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [feedbackOpen, setFeedbackOpen] = useState(false);

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

    return <main className="home-shell">
        <section className="home-hero panel">
            <div className="home-copy">
                <p className="eyebrow">Браузерная настольная стратегия</p>
                <h1>Битва за Рокуган</h1>
                <p className="lead">Создай приватную комнату, пригласи друзей или добавь ботов и сразись за контроль над провинциями империи.</p>

                <label>Имя игрока
                    <input value={name} maxLength={24} onChange={event => setName(event.target.value)} placeholder="Например, Александр" />
                </label>
                <button className="primary home-primary" disabled={busy || !name.trim()} onClick={() => void createRoom()}>Создать комнату</button>

                <div className="divider"><span>или войти в существующую</span></div>

                <div className="join-row">
                    <label>Код комнаты
                        <input value={code} maxLength={6} onChange={event => setCode(event.target.value.toUpperCase())}
                            onKeyDown={event => event.key === 'Enter' && openRoom()} placeholder="ABC234" />
                    </label>
                    <button disabled={busy} onClick={openRoom}>Войти</button>
                </div>
                {error && <p className="error">{error}</p>}
                <div className="home-links">
                    <button className="link-button" onClick={() => setFeedbackOpen(true)}>Написать автору</button>
                    <span>Музыка запускается вручную в левом нижнем углу</span>
                </div>
            </div>

            <figure className="home-map-preview">
                <div className="map-glow" />
                <img src="/assets/rokugan-map.webp" alt="Карта провинций Рокугана" />
                <figcaption><span>Империя ждёт</span><b>Семь Великих кланов. Пять раундов. Один победитель.</b></figcaption>
            </figure>
        </section>
        <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </main>;
}
