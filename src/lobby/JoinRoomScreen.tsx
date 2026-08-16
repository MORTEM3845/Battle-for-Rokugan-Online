import { LanguageToggle, useLanguage } from '../i18n';
import { navigate } from '../lib/navigation';

interface JoinRoomScreenProps {
    code: string;
    name: string;
    busy: boolean;
    error: string;
    full: boolean;
    joinDisabled: boolean;
    onNameChange: (name: string) => void;
    onJoin: () => Promise<void>;
}

export function JoinRoomScreen(props: JoinRoomScreenProps) {
    const { t } = useLanguage();
    const { code, name, busy, error, full, joinDisabled, onNameChange, onJoin } = props;
    return <main className="page home-page">
        <LanguageToggle className="room-language-toggle" />
        <section className="panel hero-panel">
            <button className="link-button" onClick={() => navigate('/')}>← {t('room.home')}</button>
            <p className="eyebrow">{t('room.private')} {code}</p>
            <h1>{t('room.joinTitle')}</h1>
            <label>{t('home.playerName')}
                <input value={name} maxLength={24} onChange={event => onNameChange(event.target.value)} />
            </label>
            <button className="primary" disabled={busy || !name.trim() || joinDisabled} onClick={() => void onJoin()}>
                {full ? t('room.full') : t('room.join')}
            </button>
            {error && <p className="error">{error}</p>}
        </section>
    </main>;
}
