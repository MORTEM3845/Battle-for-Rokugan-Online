import { useEffect, useRef, useState, type ButtonHTMLAttributes } from 'react';
import { useLanguage } from '../i18n';
import './copy-room-link.css';

export function CopyRoomLinkButton({ url, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { url: string }) {
    const { language } = useLanguage();
    const [notice, setNotice] = useState<'success' | 'error' | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => () => clearTimeout(timer.current), []);

    async function copyLink() {
        clearTimeout(timer.current);
        try {
            await navigator.clipboard.writeText(url);
            setNotice('success');
        } catch {
            setNotice('error');
        }
        timer.current = setTimeout(() => setNotice(null), 3500);
    }

    return <>
        <button {...props} onClick={() => void copyLink()}>{children}</button>
        {notice && <div className="copy-room-link-toast" role="status" aria-live="polite">
            {notice === 'success'
                ? (language === 'ru' ? 'Ссылка скопирована' : 'Link copied')
                : (language === 'ru' ? 'Не удалось скопировать ссылку. Попробуйте ещё раз.' : 'Could not copy the link. Please try again.')}
        </div>}
    </>;
}
