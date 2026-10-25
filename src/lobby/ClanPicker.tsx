import { useState } from 'react';
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
    const [hoveredClan, setHoveredClan] = useState<ClanId | null>(null);
    const [focusedClan, setFocusedClan] = useState<ClanId | null>(null);
    const previewClan = hoveredClan ?? focusedClan ?? currentPlayer.clanId ?? CLANS[0].id;
    const rule = CLAN_RULES[previewClan];
    const en = CLAN_EN[previewClan];

    return <section className="panel clan-selection-panel">
        <div className="section-title"><div><h2>{t('room.clans')}</h2><p>{t('room.clansHint')}</p></div></div>
        <div className="clan-banners" role="group" aria-label={t('room.clans')}
            onPointerLeave={() => setHoveredClan(null)}>
            <img className="clan-banner-rail" src="/assets/ui/clan-banner-rail.webp" alt="" draggable={false} />
            {CLANS.map(clan => {
                const owner = players.find(player => player.clanId === clan.id);
                const selected = currentPlayer.clanId === clan.id;
                const disabled = busy || (!!owner && owner.id !== currentPlayer.id) || currentPlayer.isReady;
                return <button key={clan.id} type="button"
                    className={`clan-banner clan-theme-${clan.id}${selected ? ' selected' : ''}${owner && !selected ? ' occupied' : ''}`}
                    aria-pressed={selected} aria-disabled={disabled}
                    onPointerEnter={() => setHoveredClan(clan.id)}
                    onFocus={() => { setHoveredClan(null); setFocusedClan(clan.id); }}
                    onBlur={() => setFocusedClan(null)}
                    onClick={() => { if (!disabled) void onSelect(clan.id); }}>
                    <span className="clan-banner-cloth">
                        <ClanMon clanId={clan.id} className="clan-banner-mon" />
                        <strong>{clanName(clan.id, language)}</strong>
                        <span className="clan-banner-status">{selected ? t('clan.yours')
                            : owner ? `${t('clan.chosenBy')}: ${owner.name}` : t('room.free')}</span>
                    </span>
                </button>;
            })}
        </div>
        <div className={`clan-preview clan-theme-${previewClan}`}>
            <ClanMon clanId={previewClan} className="clan-preview-mon" />
            <div className="clan-preview-rule" aria-live="polite" aria-atomic="true">
                <h3>{language === 'ru' ? rule.name : en.rule}</h3>
                <p>{language === 'ru' ? rule.ability : en.ability}</p>
            </div>
            <div className="clan-preview-token"><span>{t('clan.uniqueToken')}</span>
                <strong>{language === 'ru' ? rule.uniqueToken.label : en.unique}</strong></div>
        </div>
    </section>;
}
