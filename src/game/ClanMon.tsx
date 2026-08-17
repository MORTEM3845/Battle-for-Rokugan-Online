import type { ClanId } from '../../shared/room';
import { CLAN_MON_ASSET } from './presentation';

interface ClanMonProps {
    clanId: ClanId;
    className?: string;
}

export function ClanMon({ clanId, className = '' }: ClanMonProps) {
    return <span className={`clan-mon ${className}`.trim()} data-clan={clanId} aria-hidden="true">
        <img src={CLAN_MON_ASSET[clanId]} alt="" draggable={false} />
    </span>;
}
