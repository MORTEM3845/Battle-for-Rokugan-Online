import { CLANS, CLAN_RULES, type ClanId, type RoomPlayer } from '../../shared/room';
import { ClanMon } from '../components/ClanMon';
import { useLanguage } from '../i18n';
import { CLAN_EN, clanName } from './clans';

interface ClanPickerProps {
    players: RoomPlayer[];
    currentPlayer: RoomPlayer;
    busy: boolean;
    onSelect: (clanId: ClanId) => Promise<void>;
}

export function ClanPicker({ players, currentPlayer, busy, onSelect }: ClanPickerProps) {
    const { language, t } = useLanguage();
    return <section className="panel clan-selection-panel">
        <div className="section-title"><div><h2>{t('room.clans')}</h2><p>{t('room.clansHint')}</p></div></div>
        <div className="clan-grid detailed-clan-grid">
            {CLANS.map(clan => {
                const owner = players.find(player => player.clanId === clan.id);
                const selected = currentPlayer.clanId === clan.id;
                const disabled = busy || (!!owner && owner.id !== currentPlayer.id) || currentPlayer.isReady;
                const rule = CLAN_RULES[clan.id];
                const en = CLAN_EN[clan.id];
                return <button key={clan.id} className={`clan-card detailed-clan-card clan-${clan.id} ${selected ? 'selected' : ''}`}
                    disabled={disabled} onClick={() => void onSelect(clan.id)}>
                    <ClanMon clanId={clan.id} className="clan-card-mon" />
                    <span className="clan-card-heading"><strong>{clanName(clan.id, language)}</strong>
                        <em>{owner ? `${t('clan.chosenBy')}: ${owner.name}` : t('room.free')}</em></span>
                    <span className="clan-card-rule"><b>{language === 'ru' ? rule.name : en.rule}</b>
                        <small>{language === 'ru' ? rule.ability : en.ability}</small></span>
                    <span className="clan-card-token"><i>{t('clan.uniqueToken')}</i><b>{language === 'ru' ? rule.uniqueToken.label : en.unique}</b></span>
                </button>;
            })}
        </div>
    </section>;
}
