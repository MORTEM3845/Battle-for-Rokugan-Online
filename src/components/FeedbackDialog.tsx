import { useEffect, useRef, useState } from 'react';

const AUTHOR_EMAIL = 'tomkoska3845@gmail.com';
const SUBJECT = 'BattleForRokuganImportant';

interface FeedbackDialogProps {
    open: boolean;
    onClose: () => void;
}

export function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [name, setName] = useState(localStorage.getItem('rokugan-player-name') ?? '');
    const [message, setMessage] = useState('');
    const [copied, setCopied] = useState(false);

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
            'Сообщение с сайта Battle for Rokugan Online',
            '',
            `Отправитель: ${name.trim() || 'не указано'}`,
            `Страница: ${location.href}`,
            '',
            message.trim()
        ].join('\n');
    }

    function sendEmail() {
        const url = `mailto:${AUTHOR_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(buildBody())}`;
        location.href = url;
    }

    async function copyMessage() {
        await navigator.clipboard.writeText(`${SUBJECT}\n\n${buildBody()}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    }

    return <dialog ref={dialogRef} className="feedback-dialog" onCancel={onClose} onClose={onClose}>
        <form method="dialog" onSubmit={event => {
            event.preventDefault();
            sendEmail();
        }}>
            <header>
                <div><span>Связь с автором</span><h2>Сообщить о проблеме или идее</h2></div>
                <button type="button" className="dialog-close" onClick={onClose} aria-label="Закрыть">×</button>
            </header>
            <label>Ваше имя
                <input value={name} maxLength={60} onChange={event => setName(event.target.value)} placeholder="Как к вам обращаться" />
            </label>
            <label>Сообщение
                <textarea value={message} maxLength={3000} rows={7} required
                    onChange={event => setMessage(event.target.value)} placeholder="Опишите баг, пожелание или вопрос" />
            </label>
            <p className="feedback-note">Откроется установленное почтовое приложение. Так адрес и тема заполняются без хранения почтовых ключей на сайте.</p>
            <footer>
                <button type="button" onClick={() => void copyMessage()}>{copied ? 'Скопировано' : 'Скопировать текст'}</button>
                <button className="primary" disabled={!message.trim()} type="submit">Открыть письмо</button>
            </footer>
        </form>
    </dialog>;
}
