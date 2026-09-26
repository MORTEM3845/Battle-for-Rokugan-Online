import type { VisibleTokenType } from '../../shared/room';

// One stroke weight and viewBox for every order, including its hidden face.
const paths: Record<VisibleTokenType, string> = {
    army: 'M5 3 19 17 M3 5 17 19 M3 3 7 4 4 7 Z M16 14 20 18 M14 16 18 20 M19 3 5 17 M21 5 7 19 M21 3 17 4 20 7 Z M8 14 4 18 M10 16 6 20',
    fleet: 'M12 3 V17 M12 4 5 14 H12 M14 6 20 14 H14 M3 17 H21 L18 21 H6 Z',
    shinobi: 'M12 2 14 8 21 5 17 12 22 16 15 16 12 22 10 16 3 19 7 12 2 8 9 8 Z M10 12 A2 2 0 1 0 14 12 A2 2 0 1 0 10 12',
    blessing: 'M12 6 A6 6 0 1 0 12 18 A6 6 0 1 0 12 6 M12 1 V3 M12 21 V23 M1 12 H3 M21 12 H23 M4 4 6 6 M18 18 20 20 M4 20 6 18 M18 6 20 4',
    diplomacy: 'M6 21 18 3 M10 15 C3 15 3 8 10 12 M13 11 C6 9 8 3 14 7 M14 11 C20 12 21 5 17 6 M10 16 C16 20 21 14 14 13',
    raid: 'M12 2 C13 8 19 9 19 15 A7 7 0 0 1 5 15 C5 11 7 8 9 6 C9 10 11 11 12 2 Z M12 13 C15 16 15 20 12 21 C8 20 9 16 12 13 Z',
    blank: 'M12 5 A7 7 0 1 0 12 19 A7 7 0 1 0 12 5',
    hidden: 'M8 7 C8 2 17 2 17 7 C17 10 12 10 12 14 M12 19 V20'
};

export function OrderIcon({ type }: { type: VisibleTokenType }) {
    return <svg className="order-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={paths[type]} />
    </svg>;
}
