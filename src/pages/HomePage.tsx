import { useState } from 'react';
import { lobbyApi } from '../lobby/api';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { LanguageToggle, useLanguage } from '../i18n';
import { navigate, saveSession } from '../lib/navigation';

export function HomePage() {
    const { t } = useLanguage();
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
            const result = await lobbyApi.create(name);
            saveSession(result.session);
            navigate(`/room/${result.room.code}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : t('home.createError'));
        } finally {
            setBusy(false);
        }
    }

    function openRoom() {
        const normalized = code.trim().toUpperCase();
        if (!/^[A-Z2-9]{6}$/.test(normalized)) {
            setError(t('home.invalidCode'));
            return;
        }
        navigate(`/room/${normalized}`);
    }

    return <main className="home-shell rokugan-home">
        <LanguageToggle className="home-language-toggle" />
        <section className="home-hero panel">
            <div className="home-copy">
                <p className="eyebrow">{t('home.eyebrow')}</p>
                <h1 className="rokugan-title"><span aria-hidden="true">戦</span>{t('home.title')}</h1>
                <p className="lead">{t('home.lead')}</p>

                <label>{t('home.playerName')}
                    <input value={name} maxLength={24} onChange={event => setName(event.target.value)}
                        placeholder={t('home.playerPlaceholder')} />
                </label>
                <button className="primary home-primary" disabled={busy || !name.trim()}
                    onClick={() => void createRoom()}>{t('home.create')}</button>

                <div className="divider"><span>{t('home.joinDivider')}</span></div>

                <div className="join-row">
                    <label>{t('home.roomCode')}
                        <input value={code} maxLength={6} onChange={event => setCode(event.target.value.toUpperCase())}
                            onKeyDown={event => event.key === 'Enter' && openRoom()} placeholder="ABC234" />
                    </label>
                    <button disabled={busy} onClick={openRoom}>{t('home.join')}</button>
                </div>
                {error && <p className="error">{error}</p>}
                <div className="home-links">
                    <button className="link-button" onClick={() => setFeedbackOpen(true)}>{t('home.feedback')}</button>
                </div>
            </div>

            <figure className="home-map-preview">
                <div className="map-glow" />
                <img src="/assets/rokugan-map.png" alt={t('home.mapCaption')} />
                <figcaption><span>{t('home.mapKicker')}</span><b>{t('home.mapCaption')}</b></figcaption>
            </figure>
        </section>
        <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </main>;
}
