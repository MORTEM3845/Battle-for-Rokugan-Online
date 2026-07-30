import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n';

const AUTHOR_EMAIL = 'tomkoska3845@gmail.com';
const SUBJECT = 'BattleForRokuganImportant';

interface FeedbackDialogProps {
    open: boolean;
    onClose: () => void;
}

export function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
    const { language, t } = useLanguage();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [name, setName] = useState(localStorage.getItem('rokugan-player-name') ?? '');
    const [message, setMessage] = useState('');
    const [copied, setCopied] = useState(false);
    const [status, setStatus] = useState('');

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog)
            return;
        if (open && !dialog.open)
            dialog.showModal();
        if (!open && dialog.open)
            dialog.close();
    }, [open]);

    function buildBody(): string {
        return [
            language === 'ru' ? 'Сообщение с сайта Battle for Rokugan Online' : 'Message from Battle for Rokugan Online',
            '',
            `${language === 'ru' ? 'Отправитель' : 'Sender'}: ${name.trim() || (language === 'ru' ? 'не указано' : 'not specified')}`,
            `${language === 'ru' ? 'Страница' : 'Page'}: ${location.href}`,
            '',
            message.trim()
        ].join('\n');
    }

    async function copyMessage(showStatus = true) {
        await navigator.clipboard.writeText(`To: ${AUTHOR_EMAIL}\nSubject: ${SUBJECT}\n\n${buildBody()}`);
        if (!showStatus)
            return;
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    }

    async function openGmail() {
        const url = 'https://mail.google.com/mail/?view=cm&fs=1' +
            `&to=${encodeURIComponent(AUTHOR_EMAIL)}` +
            `&su=${encodeURIComponent(SUBJECT)}` +
            `&body=${encodeURIComponent(buildBody())}`;
        const tab = window.open(url, '_blank');
        if (tab) {
            tab.opener = null;
            setStatus('');
            return;
        }
        await copyMessage(false);
        setStatus(t('feedback.popupBlocked'));
    }

    return <dialog ref={dialogRef} className="feedback-dialog" onCancel={onClose} onClose={onClose}>
        <form method="dialog" onSubmit={event => {
            event.preventDefault();
            void openGmail();
        }}>
            <header>
                <div><span>{t('feedback.kicker')}</span><h2>{t('feedback.title')}</h2></div>
                <button type="button" className="dialog-close" onClick={onClose} aria-label={t('feedback.close')}>×</button>
            </header>
            <label>{t('feedback.name')}
                <input value={name} maxLength={60} onChange={event => setName(event.target.value)}
                    placeholder={t('feedback.namePlaceholder')} />
            </label>
            <label>{t('feedback.message')}
                <textarea value={message} maxLength={3000} rows={7} required
                    onChange={event => setMessage(event.target.value)} placeholder={t('feedback.messagePlaceholder')} />
            </label>
            <p className="feedback-note">{t('feedback.note')}</p>
            {status && <p className="feedback-status" role="status">{status}</p>}
            <footer>
                <button type="button" onClick={() => void copyMessage()}>{copied ? t('feedback.copied') : t('feedback.copy')}</button>
                <button className="primary" disabled={!message.trim()} type="submit">{t('feedback.openGmail')}</button>
            </footer>
        </form>
    </dialog>;
}
