import assert from 'node:assert/strict';
import {newWorld} from '../src/data/index';
import {createSeries,autoVeto} from '../src/domain/series';
import {resolveRound} from '../src/domain/engine';
import {deriveCommentaryBeats} from '../src/domain/commentaryBeats';
import {makeSave,validateSave} from '../src/domain/save';
const s=createSeries(newWorld(),'team-3','team-7',1,1);autoVeto(s);let index=-1,at=-1;
while(s.status==='playing'){
 const r=resolveRound(s),beats=deriveCommentaryBeats(r,s),b=beats.find(b=>b.category==='defuse-start');
 if(!b)continue;index=r.commentary.findIndex(l=>l.sourceBeatIds?.includes(b.id));if(index<0)continue;
 at=r.events.find(e=>b.eventIds.includes(e.id)&&e.kind==='defuseStart')!.at;break;
}
assert.ok(index>=0);const save=makeSave(null,s,null);validateSave(save);console.log(JSON.stringify({save,index,at}));
