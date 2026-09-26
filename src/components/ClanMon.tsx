import type { ClanId } from '../../shared/room';

const CLAN_MON_ASSET: Record<ClanId, string> = {
    crab: '/assets/clans/crab.png', crane: '/assets/clans/crane.png', dragon: '/assets/clans/dragon.png',
    lion: '/assets/clans/lion.png', phoenix: '/assets/clans/phoenix.png', scorpion: '/assets/clans/scorpion.png',
    unicorn: '/assets/clans/unicorn.png'
};

interface ClanMonProps {
    clanId: ClanId;
    className?: string;
}

export function ClanMon({ clanId, className = '' }: ClanMonProps) {
    return <span className={`clan-mon ${className}`.trim()} data-clan={clanId} aria-hidden="true">
        <img src={CLAN_MON_ASSET[clanId]} alt="" draggable={false} />
    </span>;
}
