import type { RoomState } from '../../shared/room';
import type { RoomAction } from './types';

interface RoomConnectionOptions {
    load: () => Promise<RoomState>;
    onRoom: (room: RoomState) => void;
    onLoadError: (cause: unknown) => void;
    onActionError: (cause: unknown) => void;
    onBusy: (busy: boolean) => void;
    pollDelay: () => number;
    schedule: (task: () => void, delay: number) => () => void;
}

/** Owns one room subscription. A command invalidates any older polling response. */
export class RoomConnection {
    private active = false;
    private stopped = false;
    private revision = 0;
    private pending = false;
    private cancelRefresh: (() => void) | null = null;

    constructor(private readonly options: RoomConnectionOptions) {}

    start(): void {
        if (this.active || this.stopped)
            return;
        this.active = true;
        void this.refresh();
    }

    stop(): void {
        this.active = false;
        this.stopped = true;
        this.revision++;
        this.cancelRefresh?.();
        this.cancelRefresh = null;
    }

    async run(action: RoomAction): Promise<void> {
        if (!this.active || this.pending)
            return;
        this.pending = true;
        const revision = ++this.revision;
        this.cancelRefresh?.();
        this.cancelRefresh = null;
        this.options.onBusy(true);
        this.options.onActionError(null);
        try {
            const room = await action();
            if (this.active && revision === this.revision) {
                this.options.onRoom(room);
                this.options.onLoadError(null);
            }
        } catch (cause) {
            if (this.active && revision === this.revision)
                this.options.onActionError(cause);
        } finally {
            this.pending = false;
            if (this.active && revision === this.revision) {
                this.options.onBusy(false);
                this.scheduleRefresh();
            }
        }
    }

    private async refresh(): Promise<void> {
        if (!this.active || this.pending)
            return;
        const revision = this.revision;
        try {
            const room = await this.options.load();
            if (this.active && revision === this.revision) {
                this.options.onRoom(room);
                this.options.onLoadError(null);
            }
        } catch (cause) {
            if (this.active && revision === this.revision)
                this.options.onLoadError(cause);
        } finally {
            if (this.active && revision === this.revision)
                this.scheduleRefresh();
        }
    }

    private scheduleRefresh(): void {
        this.cancelRefresh?.();
        this.cancelRefresh = this.options.schedule(() => {
            this.cancelRefresh = null;
            void this.refresh();
        }, this.options.pollDelay());
    }
}
