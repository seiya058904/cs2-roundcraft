import {createRoot} from 'react-dom/client';
import App from './App';
import {MotionProvider} from './motion';
import './style.css';
createRoot(document.getElementById('root')!).render(<MotionProvider><App/></MotionProvider>);
if(import.meta.env.PROD&&'serviceWorker'in navigator){
 navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('离线资源缓存未完成；本地引擎仍可运行。',error));
}

import './upgrade.css';
