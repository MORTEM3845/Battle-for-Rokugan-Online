import { CLANS, type RoomPlayer } from '../../../shared/room';
import { ClanMon } from '../ClanMon';
import { clanStyle } from '../presentation';

export function ClanBadge({ player }: { player: RoomPlayer }) {
    const clan = CLANS.find(item => item.id === player.clanId);
    return <div className="clan-badge" style={clanStyle(player)} title={clan ? `Клан ${clan.name}` : 'Клан'}>
        {player.clanId ? <ClanMon clanId={player.clanId} className="clan-badge-mon" /> : '?'}
    </div>;
}
