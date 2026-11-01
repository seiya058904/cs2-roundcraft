import {createRoot} from 'react-dom/client';
import App from './App';
import {MotionProvider} from './motion';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/match.css';
import './styles/pages.css';
createRoot(document.getElementById('root')!).render(<MotionProvider><App/></MotionProvider>);
if(import.meta.env.PROD&&'serviceWorker'in navigator){
 navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('离线资源缓存未完成；本地引擎仍可运行。',error));
}

