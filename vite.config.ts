import { defineConfig } from 'vitest/config';
import {offlineBuild} from './scripts/offline-build';
export default defineConfig({base:'./',plugins:[offlineBuild()],build:{rollupOptions:{output:{manualChunks:{react:['react','react-dom','react-dom/client'],data:['./src/data/world.json'],commentary:['./src/data/commentary.json','./src/data/quotes.json']}}}},test:{include:['tests/**/*.test.ts']}});
