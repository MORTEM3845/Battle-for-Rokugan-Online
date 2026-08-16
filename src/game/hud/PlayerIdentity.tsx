import { CLANS, type RoomPlayer } from '../../../shared/room';
import { CLAN_MON, clanStyle } from '../presentation';

export function ClanBadge({ player }: { player: RoomPlayer }) {
    const clan = CLANS.find(item => item.id === player.clanId);
    return <div className="clan-badge" style={clanStyle(player)} title={clan ? `Клан ${clan.name}` : 'Клан'}>
        {player.clanId ? CLAN_MON[player.clanId] : '?'}
    </div>;
}
