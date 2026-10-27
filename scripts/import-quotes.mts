import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const sections=['一','二','三','四','五','六','七','八','九','十','十一','十二'];
const verification='AI 字幕整理稿，未经本项目逐字听录核验';
export function parseQuotes(source:string,sourceFile:string,prefix:string){
 let section=0;
 const quotes=[];
 for(const line of source.split(/\r?\n/)){
  const heading=line.match(/^## ([一二三四五六七八九十]+)、/);
  if(heading)section=sections.indexOf(heading[1])+1;
  const row=line.match(/^(\d+)\. (.+?) \| 出处（(.+)）$/);
  if(row&&section)quotes.push({id:`${prefix}-${section}-${row[1]}`,section,index:Number(row[1]),text:row[2],source:row[3],sourceFile,priority:100,provenance:'user-supplied-transcript-quote',verification,...(prefix!=='RQ'?{beat:''}:{})});
 }
 return quotes;
}
export const normalizeQuote=(text:string)=>text.toLowerCase().replace(/[\p{P}\p{Z}\s]/gu,'');
export function duplicateQuote(a:string,b:string){
 const left=normalizeQuote(a),right=normalizeQuote(b);
 return left===right||(Math.min([...left].length,[...right].length)>=10&&(left.includes(right)||right.includes(left)));
}
export function importQuotes(){
 const sources=[{sourceFile:'quotes_draft.md',prefix:'RQ',expected:364},{sourceFile:'quotes_batch2.md',prefix:'RB',expected:458},{sourceFile:'quotes_iem-rio-day3.md',prefix:'RD',expected:198},{sourceFile:'quotes_iem-rio-finals.md',prefix:'RF',expected:134},{sourceFile:'quotes_blast-wolfsburg.md',prefix:'RW',expected:140}];
 const uncertain=new Set(['RB-2-22','RB-2-39','RB-6-24','RB-8-14','RB-12-8','RB-12-17','RB-12-20','RB-12-21','RB-12-33','RD-7-3']);
 const quotes: ReturnType<typeof parseQuotes>=[],batches=[];
 const exclusions:{id:string;reason:string;duplicateOf?:string}[]=[];
 for(const batch of sources){
  const bytes=readFileSync(`data/source/${batch.sourceFile}`),rows=parseQuotes(bytes.toString('utf8'),batch.sourceFile,batch.prefix);
  if(rows.length!==batch.expected||new Set(rows.map(row=>row.id)).size!==batch.expected)throw new Error(`${batch.sourceFile} 数量或编号异常`);
  const tags: {section:number;index:number;beat:string}[]=batch.prefix==='RQ'?[]:JSON.parse(readFileSync(`data/source/${batch.sourceFile.replace('.md','_beats.json')}`,'utf8'));
  const tagMap=new Map(tags.map(row=>[`${batch.prefix}-${row.section}-${row.index}`,row.beat]));
  if(batch.prefix!=='RQ'&&(tags.length!==batch.expected||tagMap.size!==batch.expected||tags.some(row=>!row.beat||!rows.some(quote=>quote.id===`${batch.prefix}-${row.section}-${row.index}`))))throw new Error(`${batch.sourceFile} 标签数量或编号异常`);
  const before=quotes.length;
  for(const row of rows){
   // Batch one is immutable, including its original IDs and wording.
   if(batch.prefix!=='RQ'){
    if(!tagMap.has(row.id))throw new Error(`缺少节拍标签 ${row.id}`);
    const duplicate=quotes.find(previous=>duplicateQuote(row.text,previous.text));
    if(duplicate){exclusions.push({id:row.id,reason:'normalized-duplicate',duplicateOf:duplicate.id});continue;}
    if(uncertain.has(row.id)){exclusions.push({id:row.id,reason:'uncertain-transcript'});continue;}
    quotes.push({...row,beat:tagMap.get(row.id)!});
   }else quotes.push(row);
  }
  batches.push({...batch,rawCount:rows.length,importedCount:quotes.length-before,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 writeFileSync('src/data/quotes.json',JSON.stringify(quotes));
 writeFileSync('data/normalized/quotes-manifest.json',JSON.stringify({count:quotes.length,batches,exclusions,priority:'最高：情境匹配且未处于重复冷却的原始语录优先于原创模板',verification,sourceNotes:'原始材料逐字保留；后续批次与全部已接收批次归一化去重，编号不重排。beat 是材料标签，不是触发授权；实际场景门位于 realQuotes.ts。未确认绰号不绑定选手，未实现动作不触发。'},null,2));
 console.log(`已导入 ${quotes.length} 条语录，各批累计排除 ${exclusions.length} 条`);
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/import-quotes.mts'))importQuotes();
