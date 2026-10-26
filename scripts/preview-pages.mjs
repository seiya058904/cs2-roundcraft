// A strict subdirectory host for deployment tests, with no SPA fallback.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist'),prefix='/pages-preview/';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!path.startsWith(prefix)){res.writeHead(404).end();return;}
  const target=resolve(root,path.slice(prefix.length)||'index.html');
  if(!target.startsWith(root+sep)){res.writeHead(403).end();return;}
  const bytes=await readFile(target);res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
 }catch{res.writeHead(404).end();}
}).listen(4175,'127.0.0.1');
