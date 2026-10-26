import {readFileSync,writeFileSync} from 'node:fs';
const sourceFile='quotes_draft.md';
const source=readFileSync(`data/source/${sourceFile}`,'utf8');
const sections=['一','二','三','四','五','六','七','八','九','十'];
let section=0;const quotes=[];
for(const line of source.split(/\r?\n/)){
 const heading=line.match(/^## ([一二三四五六七八九十]+)、/);
 if(heading)section=sections.indexOf(heading[1])+1;
 const row=line.match(/^(\d+)\. (.+?) \| 出处（(.+)）$/);
 if(row&&section)quotes.push({id:`RQ-${section}-${row[1]}`,section,index:Number(row[1]),text:row[2],source:row[3],sourceFile,priority:100,provenance:'user-supplied-transcript-quote',verification:'AI 字幕整理稿，未经本项目逐字听录核验'});
}
if(quotes.length!==364||new Set(quotes.map(q=>q.id)).size!==364)throw new Error('语录数量或编号异常');
writeFileSync('src/data/quotes.json',JSON.stringify(quotes));
writeFileSync('data/normalized/quotes-manifest.json',JSON.stringify({count:quotes.length,sourceFile,priority:'最高：情境匹配且未处于重复冷却的原始语录优先于原创模板',verification:quotes[0].verification,sourceNotes:'保留原文、比赛出处与绰号。未确认绰号不绑定选手；未实现的动作不触发相关语录。'},null,2));
console.log(`已导入 ${quotes.length} 条最高优先级用户语录`);
