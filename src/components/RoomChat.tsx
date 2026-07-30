import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '../../shared/chat';
import type { PlayerSession, RoomPlayer } from '../../shared/room';
import { roomApi } from '../api';
import { useLanguage } from '../i18n';

interface RoomChatProps {
    session: PlayerSession;
    currentPlayer: RoomPlayer;
    mode: 'lobby' | 'game';
}

export function RoomChat({ session, currentPlayer, mode }: RoomChatProps) {
    const { language } = useLanguage();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [text, setText] = useState('');
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const [unread, setUnread] = useState(0);
    const initialized = useRef(false);
    const previousCount = useRef(0);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let active = true;
        let timer = 0;

        const refresh = async () => {
            try {
                const state = await roomApi.getChat(session.roomCode);
                if (!active)
                    return;
                setMessages(state.messages);
                setError('');
                if (initialized.current && !open && state.messages.length > previousCount.current)
                    setUnread(value => value + state.messages.length - previousCount.current);
                initialized.current = true;
                previousCount.current = state.messages.length;
            } catch (e) {
                if (active)
                    setError(e instanceof Error ? e.message : language === 'ru' ? 'Чат временно недоступен' : 'Chat is temporarily unavailable');
            } finally {
                if (active)
                    timer = window.setTimeout(refresh, open ? 2_000 : 5_000);
            }
        };

        void refresh();
        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [language, open, session.roomCode]);

    useEffect(() => {
        if (!open)
            return;
        setUnread(0);
        requestAnimationFrame(() => {
            const list = listRef.current;
            list?.scrollTo({ top: list.scrollHeight });
        });
    }, [messages, open]);

    async function send(event: FormEvent) {
        event.preventDefault();
        const message = text.trim();
        if (!message || sending)
            return;

        try {
            setSending(true);
            setError('');
            const state = await roomApi.sendChat(session, currentPlayer.name, message);
            setMessages(state.messages);
            previousCount.current = state.messages.length;
            setText('');
        } catch (e) {
            setError(e instanceof Error ? e.message : language === 'ru' ? 'Не удалось отправить сообщение' : 'Could not send the message');
        } finally {
            setSending(false);
        }
    }

    const chat = language === 'ru' ? 'Чат' : 'Chat';
    return <aside className={`room-chat room-chat-${mode} ${open ? 'is-open' : ''}`}>
        <button className="chat-fab" onClick={() => setOpen(value => !value)} aria-expanded={open}>
            <span>文</span><b>{chat}</b>{unread > 0 && <em>{Math.min(unread, 99)}</em>}
        </button>
        {open && <section className="chat-panel" aria-label={language === 'ru' ? 'Чат комнаты' : 'Room chat'}>
            <header><div><span>{language === 'ru' ? 'Комната' : 'Room'} {session.roomCode}</span>
                <h2>{language === 'ru' ? 'Чат игроков' : 'Player chat'}</h2></div>
                <button onClick={() => setOpen(false)} aria-label={language === 'ru' ? 'Закрыть чат' : 'Close chat'}>×</button></header>
            <div ref={listRef} className="chat-messages">
                {messages.length === 0 && <p className="chat-empty">{language === 'ru'
                    ? 'Сообщений пока нет. Можно обсудить правила или напомнить сопернику о ходе.'
                    : 'No messages yet. Discuss the rules or remind an opponent that everyone is waiting.'}</p>}
                {messages.map(message => <article key={message.id} className={message.playerId === currentPlayer.id ? 'is-mine' : ''}>
                    <div className="chat-avatar">{message.playerName.slice(0, 1).toUpperCase()}</div>
                    <div><span><b>{message.playerName}</b><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></span>
                        <p>{message.text}</p></div>
                </article>)}
            </div>
            <form onSubmit={send}>
                <textarea value={text} maxLength={500} rows={2} onChange={event => setText(event.target.value)}
                    onKeyDown={event => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                        }
                    }} placeholder={language === 'ru' ? 'Сообщение комнате…' : 'Message the room…'} />
                <button className="primary" disabled={sending || !text.trim()}>{sending ? '…' : language === 'ru' ? 'Отправить' : 'Send'}</button>
            </form>
            {error && <p className="chat-error">{error}</p>}
        </section>}
    </aside>;
}
