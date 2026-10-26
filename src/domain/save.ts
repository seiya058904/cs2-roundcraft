import type { Series } from './types';
import type { Career } from './career';
import { validateCareer, validateSeries } from './saveValidation';
export interface GameSave {
    sandboxMatch?: Series | null;
    schemaVersion: 2;
    engineVersion: 'ctm-1';
    dataSnapshotDate: '2026-10-05';
    savedAt: string;
    career: Career | null;
    match: Series | null;
    context: {
        eventId: string;
        fixtureId: string;
    } | null;
}
const record = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
export function validateSave(input: unknown): GameSave {
    if (!record(input) || (input.schemaVersion !== 1 && input.schemaVersion !== 2) || input.engineVersion !== 'ctm-1' || input.dataSnapshotDate !== '2026-10-05')
        throw new Error('不支持的存档版本或数据快照');
    const walk = (value: unknown, depth = 0) => { if (depth > 80)
        throw new Error('存档嵌套过深'); if (record(value)) {
        for (const [k, v] of Object.entries(value)) {
            if (['__proto__', 'constructor', 'prototype'].includes(k))
                throw new Error('存档包含危险字段');
            walk(v, depth + 1);
        }
    }
    else if (Array.isArray(value))
        for (const v of value)
            walk(v, depth + 1);
    else if (typeof value === 'number' && !Number.isFinite(value))
        throw new Error('存档数字无效'); };
    walk(input);
    try {
        if (input.career !== null)
            validateCareer(input.career as Career);
        if (input.match !== null)
            validateSeries(input.match as Series);
        if (input.sandboxMatch !== undefined && input.sandboxMatch !== null)
            validateSeries(input.sandboxMatch as Series);
    }
    catch (error) {
        throw new Error(error instanceof Error && error.message.startsWith('存档校验失败') ? error.message : '存档包含缺失或非法的领域数据');
    }
    if (typeof input.savedAt !== 'string' || !Number.isFinite(Date.parse(input.savedAt)))
        throw new Error('存档时间无效');
    if (input.context !== null && (!record(input.context) || typeof input.context.eventId !== 'string' || typeof input.context.fixtureId !== 'string' || input.career === null || input.match === null))
        throw new Error('赛事关联无效');
    if (input.context !== null) {
        const c = input.career as Career, m = input.match as Series, context = input.context as GameSave['context'];
        const e = c.calendar.find(e => e.id === context!.eventId), f = e?.tournament?.fixtures.find(f => f.id === context!.fixtureId);
        if (!f || f.winner || e!.status !== 'active' || f.a !== m.teams[0].id || f.b !== m.teams[1].id || f.seed !== m.seed)
            throw new Error('赛事关联与比赛不一致');
    }
    // v1 contains the same deterministic game state; v2 adds strict validation without rewriting history.
    return { ...structuredClone(input), schemaVersion: 2 } as unknown as GameSave;
}
export const makeSave = (career: Career | null, match: Series | null, context: GameSave['context']): GameSave => ({ sandboxMatch: context === null ? match : null, schemaVersion: 2, engineVersion: 'ctm-1', dataSnapshotDate: '2026-10-05', savedAt: new Date().toISOString(), career, match, context });
export function parseSave(text: string) { if (text.length > 80000000)
    throw new Error('存档超过 80 MB 上限'); let value: unknown; try {
    value = JSON.parse(text);
}
catch {
    throw new Error('文件不是有效 JSON');
} return validateSave(value); }
