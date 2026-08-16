export class RoomRequestError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
        this.name = 'RoomRequestError';
    }
}

export const jsonResponse = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff'
    }
});
