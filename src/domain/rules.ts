import type { TimeoutRules, CoachStyle } from './types';
// Game tournament default. This is not a claim that every organizer uses these settings.
export const DEFAULT_TIMEOUT_RULES: Readonly<TimeoutRules> = { perMap: 4, durationSeconds: 30, overtimeExtra: 0, cooldownRounds: 2 };
export const COACH_LABELS: Record<CoachStyle, string> = { stopLoss: '止损型', momentum: '趁势型', reactive: '后手型', economist: '经济型', highLeverage: '大场面型', opportunist: '机会型' };
