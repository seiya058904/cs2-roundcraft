import type { RoundResult, Series } from './types';
import { deriveCommentaryBeats, renderChineseCommentary, commentaryCatalog } from './commentaryBeats';
import {realQuoteCatalog} from './realQuotes';
export { deriveCommentaryBeats, renderChineseCommentary } from './commentaryBeats';
export function renderCommentary(round: RoundResult, series: Series) { return renderChineseCommentary(deriveCommentaryBeats(round, series), round, series); }
export function validateNarration(round: RoundResult): string[] {
    const ids = new Set(round.events.map(e => e.id));
    const issues: string[] = [];
    for (const s of round.commentary) {
        if (s.briefText !== undefined && typeof s.briefText !== 'string') issues.push('精简解说格式错误');
        if (s.at !== undefined && (!Number.isFinite(s.at) || s.at < 0)) issues.push('解说时间错误');
        if (s.stage !== undefined && !['开局部署','接触交锋','道具配合','局势变化','回合结算'].includes(s.stage)) issues.push('解说阶段错误');
        if (s.sourceType !== undefined && !['original','quote','adapted-quote','template'].includes(s.sourceType)) issues.push('解说来源类型错误');
        if (!s.eventIds.length || !s.eventIds.every(id => ids.has(id)))
            issues.push('解说缺少合法事件引用');
        if (/\{[^{}]+\}/.test(s.text)||(typeof s.briefText==='string'&&/\{[^{}]+\}/.test(s.briefText)))
            issues.push('解说仍有未填变量');
        if (s.templateId && !commentaryCatalog.has(s.templateId))
            issues.push('未知语料来源');
        if(s.supportTemplateId&&(!commentaryCatalog.has(s.supportTemplateId)||realQuoteCatalog.has(s.supportTemplateId)))issues.push('辅助事实句来源不是合法原创模板');
    }
    return issues;
}
