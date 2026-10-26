import type { BuyPolicy, Equipment, Fighter, Side, Weapon } from './types';
export const ECONOMY = { id: 'ctm-2026-rules-v1', startCash: 800, otCash: 10000, maxCash: 16000, loss: [1400, 1900, 2400, 2900, 3400], initialLossTier: 1, win: 3250, bombWin: 3500, plantPersonal: 300, defusePersonal: 300, plantedLoss: 600, ctKillTeam: 50, roundSeconds: 115, bombSeconds: 40, plantSeconds: 3.2, defuseKitSeconds: 5, defuseSeconds: 10 };
const w = (id: string, price: number, side: Weapon['side'], category: Weapon['category'], damage: number, penetration: number, accuracy: Weapon['accuracy'], killReward: number): Weapon => ({ id, price, side, category, damage, penetration, accuracy, killReward });
export const WEAPONS: Record<string, Weapon> = Object.fromEntries([
    w('Glock', 200, 'T', 'pistol', 29, .47, [.48, .31, .17], 300), w('USP-S', 200, 'CT', 'pistol', 35, .5, [.5, .38, .23], 300), w('P250', 300, 'both', 'pistol', 38, .64, [.55, .4, .25], 300), w('Five-SeveN', 500, 'CT', 'pistol', 32, .91, [.6, .4, .22], 300), w('Tec-9', 500, 'T', 'pistol', 33, .9, [.6, .38, .2], 300), w('Deagle', 700, 'both', 'pistol', 53, .93, [.48, .43, .36], 300),
    w('MP9', 1250, 'CT', 'smg', 26, .6, [.78, .48, .25], 600), w('MAC-10', 1050, 'T', 'smg', 29, .57, [.75, .45, .22], 600), w('FAMAS', 1950, 'CT', 'rifle', 30, .7, [.68, .6, .48], 300), w('Galil', 1800, 'T', 'rifle', 30, .77, [.7, .61, .49], 300), w('M4A1-S', 2900, 'CT', 'rifle', 38, .7, [.76, .73, .64], 300), w('AK-47', 2700, 'T', 'rifle', 36, .78, [.76, .75, .69], 300), w('AWP', 4750, 'both', 'awp', 115, .97, [.42, .76, .86], 100)
].map(x => [x.id, x]));
export const UTILITY_PRICES: Record<string, number> = { smoke: 300, flash: 200, he: 300, fire: 400 };
export const emptyEquipment = (side: Side): Equipment => ({ weapon: side === 'T' ? 'Glock' : 'USP-S', pistol: side === 'T' ? 'Glock' : 'USP-S', armor: 0, helmet: false, kit: false, utility: [] });
export function purchase(f: Fighter, policy: BuyPolicy, isAwper: boolean, discipline: number): {
    spend: number;
    loadout: Equipment;
} {
    const before = f.cash;
    const eq = f.equipment;
    const budget = policy === 'eco' ? 0 : policy === 'halfBuy' ? Math.min(2000, Math.max(0, f.cash - 2000)) : policy === 'auto' && f.cash < 3200 && discipline >= 65 ? Math.min(1000, Math.max(0, f.cash - 1800)) : f.cash;
    let spent = 0;
    const pay = (price: number) => { if (price > f.cash || spent + price > budget)
        return false; f.cash -= price; spent += price; return true; };
    const buyWeapon = (id: string) => { const gun = WEAPONS[id]; if (gun.side !== 'both' && gun.side !== f.side)
        throw new Error('非法购买侧'); if (pay(gun.price)) {
        eq.weapon = id;
        if (gun.category === 'pistol')
            eq.pistol = id;
        return true;
    } return false; };
    if (budget > 0) {
        if (eq.armor < 50 && pay(650))
            eq.armor = 100;
        const available = budget - spent;
        const held = WEAPONS[eq.weapon];
        if (held.category === 'pistol') {
            if ((policy === 'awpPriority' || isAwper) && available >= 4750)
                buyWeapon('AWP');
            else if (available >= (f.side === 'T' ? 2700 : 2900))
                buyWeapon(f.side === 'T' ? 'AK-47' : 'M4A1-S');
            else if (available >= (f.side === 'T' ? 1800 : 1950))
                buyWeapon(f.side === 'T' ? 'Galil' : 'FAMAS');
            else if (available >= (f.side === 'T' ? 1050 : 1250))
                buyWeapon(f.side === 'T' ? 'MAC-10' : 'MP9');
            else if (available >= 500)
                buyWeapon(f.side === 'T' ? 'Tec-9' : 'Five-SeveN');
            else if (available >= 300)
                buyWeapon('P250');
        }
        if (eq.armor > 0 && !eq.helmet && pay(350))
            eq.helmet = true;
        for (const item of ['smoke', 'flash', 'he', 'fire'])
            if (eq.utility.length < 4 && !eq.utility.includes(item) && pay(item === 'fire' && f.side === 'CT' ? 500 : UTILITY_PRICES[item]))
                eq.utility.push(item);
        if (f.side === 'CT' && !eq.kit && pay(400))
            eq.kit = true;
    }
    if (f.cash < 0 || before - f.cash !== spent)
        throw new Error('购买资金不守恒');
    return { spend: spent, loadout: structuredClone(eq) };
}
export interface WeaponDonation {
    donor: string;
    recipient: string;
    weapon: string;
    price: number;
}
/** A teammate buys a new weapon with their own remaining cash; no free inventory or cash transfer. */
export function purchaseForTeammates(fighters: Fighter[], policies: [
    BuyPolicy,
    BuyPolicy
], awpers: Set<string>): WeaponDonation[] {
    const donations: WeaponDonation[] = [];
    for (const team of [0, 1] as const) {
        const policy = policies[team];
        if (policy === 'eco' || policy === 'halfBuy')
            continue;
        const members = fighters.filter(f => f.team === team);
        const recipients = members.filter(f => WEAPONS[f.equipment.weapon].category === 'pistol').sort((a, b) => Number(awpers.has(b.id)) - Number(awpers.has(a.id)) || a.id.localeCompare(b.id));
        for (const recipient of recipients) {
            const donor = members.filter(f => f.id !== recipient.id && WEAPONS[f.equipment.weapon].category !== 'pistol').sort((a, b) => b.cash - a.cash || a.id.localeCompare(b.id))[0];
            if (!donor)
                continue;
            const reserve = policy === 'auto' ? 1000 : 0;
            const options = awpers.has(recipient.id) ? ['AWP', recipient.side === 'T' ? 'AK-47' : 'M4A1-S'] : [recipient.side === 'T' ? 'AK-47' : 'M4A1-S', recipient.side === 'T' ? 'Galil' : 'FAMAS'];
            const weapon = options.find(id => WEAPONS[id].price <= donor.cash - reserve);
            if (!weapon)
                continue;
            const price = WEAPONS[weapon].price;
            donor.cash -= price;
            recipient.equipment.weapon = weapon;
            donations.push({ donor: donor.id, recipient: recipient.id, weapon, price });
        }
    }
    return donations;
}
