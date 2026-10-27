import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseQuotes} from './import-quotes.mts';
import {reportMetadata} from './report-metadata.mts';
const manifest=JSON.parse(readFileSync('data/normalized/quotes-manifest.json','utf8'));
const imported=JSON.parse(readFileSync('src/data/quotes.json','utf8')) as {id:string;text:string;source:string}[];
const catalog=new Map(imported.map(q=>[q.id,q])),excluded=new Set<string>(manifest.exclusions.map((q:{id:string})=>q.id));
let rawCount=0,checked=0;
for(const batch of manifest.batches){const raw=parseQuotes(readFileSync(`data/source/${batch.sourceFile}`,'utf8'),batch.sourceFile,batch.prefix);assert.equal(raw.length,batch.rawCount);rawCount+=raw.length;
 for(const q of raw){const actual=catalog.get(q.id);assert.equal(Boolean(actual),!excluded.has(q.id),q.id);if(actual){assert.equal(actual.text,q.text,q.id+' text');assert.equal(actual.source,q.source,q.id+' source');checked++;}}
}
assert.equal(rawCount,1294);assert.equal(checked,1283);assert.equal(excluded.size,11);
const report={...reportMetadata(),rawCount,checked,excluded:excluded.size,scope:'逐条核对原始字幕整理稿与入库原文、出处，不代表已逐字听录。'};
writeFileSync('docs/commentary-source-integrity-iteration12.json',JSON.stringify(report,null,2));console.log(report);
