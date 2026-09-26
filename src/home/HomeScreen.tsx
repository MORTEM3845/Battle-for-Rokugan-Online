import { useState } from 'react';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { LanguageToggle, useLanguage } from '../i18n';

interface HomeScreenProps {
    name: string;
    code: string;
    busy: boolean;
    error: string;
    onNameChange: (name: string) => void;
    onCodeChange: (code: string) => void;
    onCreateRoom: () => Promise<void>;
    onOpenRoom: () => void;
}

export function HomeScreen({ name, code, busy, error, onNameChange, onCodeChange,
    onCreateRoom, onOpenRoom }: HomeScreenProps) {
    const { t } = useLanguage();
    const [feedbackOpen, setFeedbackOpen] = useState(false);

    return <main className="home-shell rokugan-home">
        <LanguageToggle className="home-language-toggle" />
        <section className="home-hero">
            <div className="home-copy">
                <p className="eyebrow">{t('home.eyebrow')}</p>
                <h1 className="rokugan-title">{t('home.title')}</h1>
                <p className="lead">{t('home.lead')}</p>

                <div className="home-actions">
                    <label>{t('home.playerName')}
                        <input value={name} maxLength={24} onChange={event => onNameChange(event.target.value)}
                            placeholder={t('home.playerPlaceholder')} />
                    </label>
                    <button className="primary home-primary" disabled={busy || !name.trim()}
                        onClick={() => void onCreateRoom()}>{t('home.create')}</button>

                    <div className="divider"><span>{t('home.joinDivider')}</span></div>

                    <div className="join-row">
                        <label>{t('home.roomCode')}
                            <input value={code} maxLength={6} onChange={event => onCodeChange(event.target.value.toUpperCase())}
                                onKeyDown={event => event.key === 'Enter' && onOpenRoom()} placeholder="ABC234" />
                        </label>
                        <button disabled={busy} onClick={onOpenRoom}>{t('home.join')}</button>
                    </div>
                    {error && <p className="error">{error}</p>}
                </div>
                <div className="home-links">
                    <button className="link-button" onClick={() => setFeedbackOpen(true)}>{t('home.feedback')}</button>
                </div>
            </div>

            <figure className="home-map-preview">
                <img src="/assets/rokugan-map.png" alt={t('home.mapCaption')} />
                <figcaption><span>{t('home.mapKicker')}</span><b>{t('home.mapCaption')}</b></figcaption>
            </figure>
        </section>
        <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </main>;
}
