import mapping from '../data/nicknames.json';
import type { Player, Team } from './types';
const playerAliases = new Map(mapping.players.map(row => [row.canonical.toLowerCase(), row.aliases]));
const teamAliases = new Map(mapping.teams.map(row => [row.canonical.toLowerCase(), row.aliases]));
const label = (name: string, aliases: Map<string, string[]>, annotate = false) => { const alias = aliases.get(name.toLowerCase())?.[0]; return alias ? (annotate ? `${alias}（${name}）` : alias) : name; };
export function commentaryPlayerName(player: Pick<Player, 'nickname'> | string | undefined): string { return label(typeof player === 'string' ? player : player?.nickname ?? '—', playerAliases, true); }
export function commentaryTeamName(team: Pick<Team, 'name'> | string | undefined): string { return label(typeof team === 'string' ? team : team?.name ?? '—', teamAliases); }
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Display old saved narration through current naming rules without changing stored facts or identity. */
export function formatCommentaryNames(text: string, players: Pick<Player, 'nickname'>[], teams: Pick<Team, 'name'>[]): string {
    const replacements = new Map<string, string>();
    for (const [entries, aliases, key] of [[players, playerAliases, 'nickname'], [teams, teamAliases, 'name']] as const) {
        for (const entry of entries) {
            const name = key === 'nickname' ? (entry as Pick<Player, 'nickname'>).nickname : (entry as Pick<Team, 'name'>).name;
            const names = aliases.get(name.toLowerCase());
            if (!names)
                continue;
            const display = label(name, aliases, key === 'nickname');
            replacements.set(display, display);
            replacements.set(name, display);
            for (const alias of names) {
                replacements.set(`${alias}（${name}）`, display);
                replacements.set(alias, display);
            }
        }
    }
    if (!replacements.size)
        return text;
    const keys = [...replacements.keys()].sort((a, b) => b.length - a.length);
    const patterns = keys.map(key => /^[\w-]+$/.test(key) ? `(?<![\\w-])${escape(key)}(?![\\w-])` : escape(key));
    const folded = new Map([...replacements].map(([key, value]) => [key.toLowerCase(), value]));
    return text.replace(new RegExp(patterns.join('|'), 'gi'), match => folded.get(match.toLowerCase()) ?? match);
}
