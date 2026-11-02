/**
 * Spoken layer for engine v5 narration.
 *
 * The causal renderer produces accurate but bookish fact sentences ("人数变成4打5", "40秒倒计时开始").
 * This pass rewrites only those generated fact sentences into the caster's spoken rhythm, following
 * data/source/commentary-style-guide.md: conclusion first, short clauses, people counts read aloud
 * ("四打五"), "第二时间" timing talk, and sparing interjections reserved for real highlights.
 *
 * Boundaries:
 * - A sourced quote prefix is never edited; only the generated facts after it change.
 * - briefText, event anchors, template ids and quote sources are untouched.
 * - Every choice is a pure function of the round (hash of series/map/round/segment), so a seed and
 *   decisions still reproduce the same narration and the engine random stream is not consumed.
 * - Facts are never added: every number and name in a rewrite comes from the matched sentence or
 *   from the round ledger.
 */
import type {CommentarySegment, RoundResult, Series, TeamIndex} from './types';
import {hash} from './random';
import {realQuoteCatalog} from './realQuotes';
import {commentaryTeamName, formatCommentaryNames} from './names';
import {roundHighlights, streak} from './insights';

const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
/** People counts are read aloud ("四打五"); scores and seconds stay numeric. */
export const spokenCount = (n: number | string) => DIGITS[Number(n)] ?? String(n);
/** A quantity reads 两 for two ("两个"), while a people count keeps 二 ("一打二"). */
const spokenQty = (n: number | string) => (Number(n) === 2 ? '两' : spokenCount(n));

type Chooser = (options: readonly string[]) => string;
type Rule = [RegExp, (pick: Chooser, ...groups: string[]) => string];
// A name never crosses a clause boundary or whitespace, so it is matched with S.
const S = '[^。！？，；：\\s]+?';
// Zones may contain a space ("B 包点") but never start with one.
const Z = '[^。！？，；：\\s][^。！？，；：]*?';
const START = '(?<=^|[。！？\\s])';
const RULES: Rule[] = [
  // Opening exchange and kill trades.
  [new RegExp(`${START}(${Z})这边先掉人，(${S})用(${S})(爆头)?拿下(${S})，人数变成(\\d)打(\\d)。`), (p, zone, actor, weapon, hs, target, a, b) =>
    p([`${zone}先掉人！${actor}${hs ? '一个爆头' : `用${weapon}`}带走${target}，${spokenCount(a)}打${spokenCount(b)}了。`,
      `${actor}在${zone}${hs ? '爆头' : `用${weapon}`}拿下${target}，人数${spokenCount(a)}打${spokenCount(b)}。`,
      `${zone}这边先倒一个，${actor}${hs ? '爆头' : ''}带走${target}！${spokenCount(a)}打${spokenCount(b)}。`])],
  [/，首杀之后是(\d)打(\d)。/, (p, a, b) => p([`，首杀到手，${spokenCount(a)}打${spokenCount(b)}。`, `，${spokenCount(a)}打${spokenCount(b)}了。`, `。首杀拿到，人数${spokenCount(a)}打${spokenCount(b)}。`])],
  [/，场上变成(\d)打(\d)。/, (p, a, b) => p([`，${spokenCount(a)}打${spokenCount(b)}了。`, `，场上${spokenCount(a)}打${spokenCount(b)}。`, `，人数来到${spokenCount(a)}打${spokenCount(b)}。`])],
  [/，场上是(\d)打(\d)。/, (p, a, b) => p([`，现在${spokenCount(a)}打${spokenCount(b)}。`, `，${spokenCount(a)}打${spokenCount(b)}。`, `，场上${spokenCount(a)}打${spokenCount(b)}。`])],
  [/，人数变成(\d)打(\d)。/, (p, a, b) => p([`，${spokenCount(a)}打${spokenCount(b)}了。`, `，人数${spokenCount(a)}打${spokenCount(b)}。`])],
  [/，场上(\d)打(\d)。/, (_p, a, b) => `，场上${spokenCount(a)}打${spokenCount(b)}。`],
  [/(?<=^|[。！？\s])马上接上，击杀的是/, p => p(['第二时间就补上了，倒下的是', '马上补上，倒下的是'])],
  [/(?<=^|[。！？\s])间隔(\d+)秒，击杀的是/, (p, n) => Number(n) <= 2 ? p(['第二时间就补上了，倒下的是', `${n}秒就补回来，倒下的是`]) : `隔了${n}秒补上，倒下的是`],
  [new RegExp(`(${S})只隔(\\d+)秒就补掉(${S})，`), (p, actor, n, target) => Number(n) <= 2 ? p([`${actor}第二时间就把${target}补掉了，`, `${actor}${n}秒就补掉${target}，`]) : `${actor}隔了${n}秒补掉${target}，`],
  [new RegExp(`(${S})马上补掉(${S})，`), (p, actor, target) => p([`${actor}第二时间补掉${target}，`, `${actor}马上把${target}补掉，`])],
  [new RegExp(`只剩(${S})，一打(\\d)。`), (p, who, n) => p([`只剩${who}了，一打${spokenCount(n)}！`, `就剩${who}一个人，一打${spokenCount(n)}。`])],
  [new RegExp(`(${S})已经打掉(\\d)个，可这个一打(\\d)还是没能拿下来。`), (p, who, k, n) => p([`${who}一打${spokenCount(n)}，已经带走${spokenQty(k)}个，还是差了一口气。`, `${who}打掉了${spokenQty(k)}个，这个一打${spokenCount(n)}最后没拿下来。`])],
  [/一打(\d)/g, (_p, n) => `一打${spokenCount(n)}`],
  // Bomb.
  [new RegExp(`(${S})把包下在(${Z})，40 ?秒(?:回防)?倒计时开始。`), (p, who, zone) => p([`包下了！${who}放在${zone}，40 秒，看回防。`, `${who}把包下在${zone}了，接下来 40 秒就看回防怎么组织。`, `${zone}，包落地！${who}下的，40 秒开始读。`])],
  [new RegExp(`下包的是(${S})，位置在(${Z})，40秒倒计时开始。`), (p, who, zone) => p([`${who}下的包，${zone}，40 秒开始读。`, `包在${zone}，${who}放的，回防只有 40 秒。`])],
  [new RegExp(`(${S})在(${Z})下包成功，回防方现在有40秒时间。`), (p, who, zone) => p([`${who}在${zone}把包放下去了，回防只有 40 秒。`, `包下在${zone}，${who}放的。回防方，40 秒。`, `${zone}包落地了！${who}下的，40 秒倒计时。`])],
  [new RegExp(`(${S})开始拆包，炸弹还剩(\\d+)秒；(有钳|没钳)需要(\\d+)秒。`), (p, who, left, kit, need) => p([`${who}上去拆了！${kit}要${need}秒，炸弹还有${left}秒。`, `${who}开始拆，${kit}，${need}秒；炸弹还剩${left}秒。`])],
  [new RegExp(`(${S})选择撤退保枪：人数劣势，保留长枪。`), (p, who) => p([`${who}直接保了，人数不占优，枪留到下一把。`, `${who}不打了，保枪！人数不够，下把还有枪用。`])],
  // Multi-kills and timing.
  [/从第一个到第(\d)个击杀，经过了(\d+)秒。/, (p, k, s) => p([`${spokenQty(k)}个人头，前后${s}秒！`, `${s}秒之内，${spokenCount(k)}杀！`])],
  [new RegExp(`(${S})这一回合已经拿到(\\d)杀，他的第一杀到最后一杀相隔(\\d+)秒。`), (p, who, k, s) => p([`${who}这回合已经${spokenCount(k)}杀了，${s}秒之内打出来的！`, `${who}${spokenCount(k)}杀到手，前后就${s}秒。`])],
  [new RegExp(`(${S})拿到(\\d)个击杀，这\\d杀横跨(\\d+)秒。`), (p, who, k, s) => p([`${who}一个人${spokenCount(k)}杀，${s}秒打完！`, `${who}${spokenCount(k)}杀，前后${s}秒。`])],
  [/这一枪是隔着烟打的。/, p => p(['这一枪是隔着烟打的。', '还是穿烟打的！', '这枪隔着烟！'])],
  // Plans and timeouts.
  [new RegExp(`(${S})这次希望稳住节奏。`), (p, team) => p([`${team}想先把节奏稳下来。`, `${team}这个暂停，就是要稳一稳。`])],
  [new RegExp(`(${S})这次希望调整重点区域。`), (p, team) => p([`${team}要换个重点区域打了。`, `${team}暂停回来，重点区域要变。`])],
  // Round result.
  [new RegExp(`时间走完，炸弹爆炸。(${S})拿下这一分，比分来到(\\d+:\\d+)。`), (p, team, score) => p([`包炸了！这一分是${team}的，${score}。`, `时间读完，炸弹爆炸！${team}拿下这一分，${score}。`, `炸了！${team}收下这一分，比分${score}。`])],
  [new RegExp(`炸弹爆炸，(${S})拿下这一分，比分来到(\\d+:\\d+)。`), (p, team, score) => p([`炸了！${team}拿下这一分，${score}。`, `包炸了，这一分给到${team}，${score}。`])],
  [new RegExp(`对方全部倒下，这个回合结束。(${S})拿下这一分，比分来到(\\d+:\\d+)。`), (p, team, score) => p([`人清干净了！${team}拿下这一分，${score}。`, `全部倒下，这分${team}拿了，比分${score}。`, `一个不剩！${team}收下这一分，${score}。`])],
  [new RegExp(`(${S})拿下这一分，比分来到(\\d+:\\d+)。`), (p, team, score) => p([`${team}拿下这一分，${score}。`, `这一分给到${team}，比分${score}。`])],
  [/当前比分(\d+)比(\d+)。/, (p, a, b) => p([`当前比分${a}比${b}。`, `现在${a}比${b}。`, `比分${a}比${b}。`])],
];

/** Same intensity budget as the renderer: one strong shout per round, none within three rounds. */
const INTENSE = /卧槽|牛逼|无敌|太变态|太夸张/;
const INTERJECTION = /^(?:卧槽|我去|兄弟们|好家伙|哇|哦|漂亮|太|无敌|牛|帅|OK|好，|来，|啊|诶|唉|哎)/;

function rewriteFacts(text: string, seed: number): string {
  let out = text, n = 0;
  for (const [pattern, render] of RULES) {
    out = out.replace(pattern, (...args: unknown[]) => {
      const groups = args.slice(1, -2).map(g => (g === undefined ? '' : String(g)));
      const roll = hash(`${seed}|${n++}`);
      return render(options => options[roll % options.length], ...groups);
    });
  }
  return out;
}

/** Context-driven closers in the caster's register: praise a run, own a slump, never invent facts. */
function moodLine(round: RoundResult, series: Series, prior: readonly RoundResult[], roll: number, intense: boolean): string | undefined {
  const winner = round.winner as TeamIndex, loser = (1 - winner) as TeamIndex;
  const history = [...prior, round];
  const team = (i: TeamIndex) => commentaryTeamName(series.teams[i]);
  const won = streak(history, winner);
  const highlights = roundHighlights(round);
  const pick = (options: string[]) => options[roll % options.length];
  if (highlights.some(h => h.kind === 'ecoUpset' && h.team === winner)) return pick([`装备差那么多都拿下来了，这分${team(winner)}赚大了好吧！`, `穷的那边反而拿分了，${team(loser)}这一分亏麻了！`]);
  if (highlights.some(h => h.kind === 'ace')) return intense ? pick(['一个人打穿五个，无敌了，兄弟们！', '五杀！这就是纯粹的数值碾压！']) : '五杀！这就是纯粹的数值碾压！';
  if (won === 5 || won === 8) return pick([`${team(winner)}连下${won}分了，这节奏太舒服了！`, `${won}连胜，${team(winner)}现在打得太顺了，兄弟们！`]);
  const before: [number, number] = [...round.score];
  before[winner]--;
  const deficit = Math.max(0, ...prior.map(r => r.score[loser] - r.score[winner]));
  if (round.score[0] === round.score[1] && deficit >= 3 && before[winner] < before[loser]) return pick([`从落后${deficit}分一路追平，${team(winner)}这口气提起来了！`, `追平了！落后${deficit}分都追回来了，好吧！`]);
  return undefined;
}
/** Applies the spoken layer to an engine v5 round. Pure: same round and series give the same lines. */
export function speakCommentary(segments: CommentarySegment[], round: RoundResult, series: Series): CommentarySegment[] {
  const prior = series.mapStates.find(m => m.map === round.map)?.rounds.filter(r => r.number < round.number) ?? [];
  const base = `${series.id}|${round.map}|${round.number}|spoken`;
  let interjected = false;
  let intenseAllowed = !segments.some(s => INTENSE.test(s.text)) && !prior.slice(-3).some(r => r.commentary.some(s => INTENSE.test(s.text)));
  const conclusionIndex = segments.findIndex(s => s.emphasis === 'conclusion' && s.voice !== 'analyst');
  const hasStreakLine = segments.some(s => /连拿|连下|连胜|连续|扳平/.test(s.text));
  return segments.map((segment, index) => {
    if (segment.voice === 'analyst') return segment;
    const quote = segment.templateId ? realQuoteCatalog.get(segment.templateId) : undefined;
    const prefix = quote ? formatCommentaryNames(quote.text, series.players, series.teams) : '';
    if (quote && !segment.text.startsWith(prefix)) return segment;
    const seed = hash(`${base}|${index}`);
    let rest = segment.text.slice(prefix.length);
    rest = rewriteFacts(rest, seed);
    // Interjections only on generated lines that open flat, at most once per round.
    if (!quote && !interjected && segment.emphasis === 'hype' && !INTERJECTION.test(rest.trim())) {
      const big = roundHighlights(round).some(h => h.kind === 'ace' || h.kind === '4k');
      const options = big && intenseAllowed ? ['卧槽，', '太夸张了！'] : ['我去，', '漂亮啊漂亮！', '兄弟们，'];
      const opener = options[seed % options.length];
      rest = opener + rest.trimStart();
      interjected = true;
      if (INTENSE.test(opener)) intenseAllowed = false;
    }
    if (index === conclusionIndex && !hasStreakLine) {
      const mood = moodLine(round, series, prior, seed, intenseAllowed);
      if (mood) { rest = `${rest.trimEnd()} ${mood}`; if (INTENSE.test(mood)) intenseAllowed = false; }
    }
    const text = prefix + rest;
    return text === segment.text ? segment : {...segment, text};
  });
}
