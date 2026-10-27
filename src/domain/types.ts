import type {BattlePlan,PhaseOverrides,StrategyStyle} from './battlePlan';
export const ATTRIBUTE_KEYS = ['aim', 'entry', 'awp', 'defense', 'utility', 'gameSense', 'positioning', 'teamwork', 'clutch', 'consistency', 'composure', 'peakPotential'] as const;
export type Attribute = typeof ATTRIBUTE_KEYS[number];
export type Role = 'IGL' | 'AWPer' | 'Entry' | 'Support' | 'Lurker' | 'Rifler' | 'Anchor';
export type Side = 'T' | 'CT';
export type MapId = 'dust2' | 'mirage' | 'inferno' | 'nuke' | 'ancient' | 'anubis' | 'cache';
export type TeamIndex = 0 | 1;
export type BuyPolicy = 'auto' | 'eco' | 'halfBuy' | 'forceBuy' | 'fullBuy' | 'awpPriority';
export interface PlayerProfile {
    checkedAt: string;
    basis: 'ranked' | 'sampled' | 'role-only' | 'baseline';
    roles: {label:string; asOf:string; url:string}[];
    ranking?: {year:number; rank:number; url:string};
    metrics: {key:string; label:string; value:number; scope:string; period:string; url:string}[];
    awards: {label:string; url:string}[];
}
export interface Player {
    id: string;
    nickname: string;
    initialTeamId: string;
    nationality: string | null;
    history: string[];
    historyCompleteness: 'unknown' | 'partial' | 'complete';
    role: Role;
    roleConfidence: 'inferred' | 'verified' | 'user-assigned';
    attributes: Record<Attribute, number>;
    mapProficiency: Record<MapId, number>;
    source: {
        url: string;
        snapshotDate: string;
        confidence: 'verified';
        identityUrl?: string;
    };
    modelVersion: string;
    profile?: PlayerProfile;
}
export interface TeamDynamics {
    chemistry: number;
    execution: number;
    communication: number;
    adaptability: number;
    economyDiscipline: number;
    belief: number;
    mapPreparation: Record<MapId, number>;
    tacticFamiliarity: Record<string, number>;
}
export type CoachStyle = 'stopLoss' | 'momentum' | 'reactive' | 'economist' | 'highLeverage' | 'opportunist';
export interface TimeoutRules {
    perMap: number;
    durationSeconds: number;
    overtimeExtra: number;
    cooldownRounds: number;
}
export interface Team {
    id: string;
    name: string;
    region: 'EU' | 'AMERICAS' | 'ASIA' | 'UNKNOWN';
    regionSource?: string;
    startingFive: string[];
    initialRank: number;
    initialVrsPoints: number;
    dynamics: TeamDynamics;
    coach: {
        name: string;
        style: CoachStyle;
    };
}
export interface World {
    teams: Team[];
    players: Player[];
}
export interface Zone {
    id: string;
    name: string;
    site: 'A' | 'B' | 'mid' | 'neutral';
    cover: number;
    range: 'close' | 'mid' | 'long';
    paths: {
        to: string;
        seconds: number;
    }[];
    sightlines: {
        to: string;
        range: 'close' | 'mid' | 'long';
    }[];
}
export interface GameMap {
    id: MapId;
    name: string;
    zones: Zone[];
    tSpawn: string;
    ctSpawn: string;
    siteA: string;
    siteB: string;
    laneA: string;
    laneB: string;
    mid: string;
    alternateA: string;
    alternateB: string;
}
export interface Weapon {
    id: string;
    price: number;
    side: Side | 'both';
    category: 'pistol' | 'smg' | 'rifle' | 'awp';
    damage: number;
    penetration: number;
    accuracy: [
        number,
        number,
        number
    ];
    killReward: number;
}
export interface Equipment {
    weapon: string;
    pistol: string;
    armor: number;
    helmet: boolean;
    kit: boolean;
    utility: string[];
}
export interface Fighter {
    id: string;
    team: TeamIndex;
    side: Side;
    hp: number;
    alive: boolean;
    cash: number;
    equipment: Equipment;
    zone: string;
    blindedUntil: number;
    hasBomb: boolean;
}
export type EventKind = 'buy' | 'position' | 'move' | 'sight' | 'info' | 'misread' | 'flash' | 'smoke' | 'fire' | 'he' | 'blind' | 'duel' | 'damage' | 'kill' | 'trade' | 'plant' | 'defuseStart' | 'defuseStop' | 'defuse' | 'save' | 'explode' | 'timerEnd' | 'roundEnd' | 'tactic' | 'coachTimeout' | 'pickup' | 'donation' | 'extinguish';
export interface RoundEvent {
    id: string;
    at: number;
    kind: EventKind;
    actor?: string;
    target?: string;
    team?: TeamIndex;
    zone?: string;
    weapon?: string;
    damage?: number;
    hpBefore?: number;
    hpAfter?: number;
    alive?: [
        number,
        number
    ];
    causes: string[];
    detail: Record<string, string | number | boolean>;
}
export interface EconomyEntry {
    playerId: string;
    cashBefore: number;
    spend: number;
    cashAfterBuy: number;
    loadout: Equipment;
    killRewards: number;
    objectiveRewards: number;
    teamRewards: number;
    cashAtEnd: number;
    carriedEquipment: Equipment | null;
    lossTierBefore: number;
    lossTierAfter: number;
}
export interface Decision {
    strategy?: StrategyStyle;
    phases?: PhaseOverrides;
    tactic: string;
    buy: BuyPolicy;
    risk: 'conservative' | 'balanced' | 'aggressive';
    adaptive: boolean;
    positions?: Record<string, string>;
    stances?: Record<string, 'close' | 'standard'>;
}
export interface TimeoutEffect {
    kind: 'position' | 'belief' | 'economy';
    site: 'A' | 'B';
    expiresAfterRound: number;
}
export interface TimeoutRecord {
    round: number;
    team: TeamIndex;
    kind: TimeoutEffect['kind'];
    reason: string;
}
export interface CommentarySegment {
    /** Original factual phrasing appended to a sourced quote, with independent provenance/cooldown. */
    supportTemplateId?: string;
    stage?: '开局部署' | '接触交锋' | '道具配合' | '局势变化' | '回合结算';
    at?: number;
    briefText?: string;
    sourceType?: 'original' | 'quote' | 'adapted-quote' | 'template';
    text: string;
    eventIds: string[];
    emphasis: 'neutral' | 'tense' | 'hype' | 'conclusion';
    templateId?: string;
    sourceBeatIds?: string[];
    quoteSource?: string;
}
export interface RoundResult {
    plans?: [BattlePlan,BattlePlan];
    number: number;
    map: MapId;
    sides: [
        Side,
        Side
    ];
    decisions: [
        Decision,
        Decision
    ];
    winner: TeamIndex;
    reason: 'elimination' | 'defuse' | 'explode' | 'time';
    events: RoundEvent[];
    economy: EconomyEntry[];
    initial: Fighter[];
    final: Fighter[];
    commentary: CommentarySegment[];
    score: [
        number,
        number
    ];
}
export interface MapState {
    timeoutRules?: TimeoutRules;
    map: MapId;
    score: [
        number,
        number
    ];
    startSide: Side;
    rounds: RoundResult[];
    fighters: Fighter[];
    lossTiers: [
        number,
        number
    ];
    timeoutsUsed: [
        number,
        number
    ];
    effects: [
        TimeoutEffect | null,
        TimeoutEffect | null
    ];
    timeoutHistory: TimeoutRecord[];
    winner: TeamIndex | null;
}
export interface VetoAction {
    team: TeamIndex;
    kind: 'ban' | 'pick';
    map: MapId;
}
export interface Series {
    engineVersion?: string;
    higherSeed?: TeamIndex;
    timeoutRules?: TimeoutRules;
    id: string;
    seed: number;
    rngState: number;
    bestOf: 1 | 3 | 5;
    teams: [
        Team,
        Team
    ];
    players: Player[];
    veto: VetoAction[];
    vetoA?: TeamIndex;
    startingSides?: Partial<Record<MapId, Side>>;
    maps: MapId[];
    mapStates: MapState[];
    score: [
        number,
        number
    ];
    winner: TeamIndex | null;
    status: 'veto' | 'playing' | 'finished';
}
