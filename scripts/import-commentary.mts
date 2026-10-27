import {readFileSync,writeFileSync} from 'node:fs';
const inputs=[{file:'commentary-lines-v1.jsonl',expected:180,provenance:'user-supplied-original-template'},{file:'commentary-lines-expanded.jsonl',expected:180,provenance:'user-supplied-original-template'},{file:'commentary-lines-phase.jsonl',expected:84,provenance:'assistant-authored-original-template'},{file:'commentary-lines-context.jsonl',expected:24,provenance:'assistant-authored-original-template'}];
const lines=inputs.flatMap(({file,expected,provenance})=>{
 const rows=readFileSync(`data/source/${file}`,'utf8').trim().split('\n').map(line=>{const r=JSON.parse(line);if(r.verified_spoken_quote!==false||!(r.provenance==='original_for_simulator'||r.source_type==='original_template'))throw new Error('仅导入标明原创的素材');return{id:r.id,family:r.event_family??r.category_id,trigger:r.trigger_hint??r.trigger,intensity:r.intensity??r.energy,text:r.text,sourceFile:file,provenance,verifiedSpokenQuote:false};});
 if(rows.length!==expected)throw new Error(`${file} 语料数量不符`);return rows;
});
if(new Set(lines.map(l=>l.id)).size!==lines.length)throw new Error('原创语料 ID 重复');
writeFileSync('src/data/commentary.json',JSON.stringify(lines));writeFileSync('data/normalized/commentary-manifest.json',JSON.stringify({count:lines.length,files:inputs.map(input=>input.file),batches:inputs,originalTemplates:lines.length,verifiedSpokenQuotes:0,policy:'按结构化事件和逐句前置条件激活；不满足条件的素材不随机投放。AI 新写模板不冒充真人语录。'},null,2));console.log(`已导入 ${lines.length} 条明确标注原创的台词，保留来源与触发条件。`);
