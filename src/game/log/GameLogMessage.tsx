export function GameLogMessage({ message, details }: { message: string; details?: string }) {
    if (!details)
        return <span className="log-message-text">{message}</span>;

    return <details className="log-message">
        <summary title={details}>
            <span className="log-message-text">{message}</span>
            <span className="log-message-hint">Подробности боя</span>
        </summary>
        <span className="log-message-details">{details}</span>
    </details>;
}
