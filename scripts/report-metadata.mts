import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {cpus,totalmem} from 'node:os';

export function reportMetadata(){
 const files:string[]=[];
 function scan(directory:string){for(const entry of readdirSync(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())scan(path);else files.push(path);}}
 scan('src/domain');scan('src/data');files.push('package-lock.json');
 const digest=createHash('sha256');for(const file of files.sort()){digest.update(relative('.',file).replaceAll('\\','/'));digest.update(readFileSync(file));}
 return {generatedAt:new Date().toISOString(),simulationSourceSha256:digest.digest('hex'),runtime:process.version,cpu:cpus()[0]?.model,logicalCpus:cpus().length,memoryGiB:Math.round(totalmem()/2**30)};
}
