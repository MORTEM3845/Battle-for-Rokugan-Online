export async function apiRequest<T>(url: string, init?: RequestInit, token?: string): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body)
        headers.set('content-type', 'application/json');
    if (token)
        headers.set('x-player-token', token);

    const response = await fetch(url, { ...init, headers });
    const data = await response.json() as unknown;
    if (!response.ok) {
        const message = typeof data === 'object' && data !== null && 'error' in data &&
            typeof data.error === 'string' ? data.error : `Ошибка HTTP ${response.status}`;
        throw new Error(message);
    }
    return data as T;
}
