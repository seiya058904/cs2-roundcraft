import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/offline',outputDir:'pages-test-results',workers:1,use:{baseURL:'http://127.0.0.1:4175/pages-preview/',headless:true,viewport:{width:1280,height:900}},webServer:{command:'node scripts/preview-pages.mjs',url:'http://127.0.0.1:4175/pages-preview/',reuseExistingServer:false}});
