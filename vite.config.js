import { defineConfig, loadEnv } from 'vite';
import { existsSync, readFileSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig(({mode}) => {
  const env=loadEnv(mode,process.cwd(),'');
  const release=JSON.parse(readFileSync(new URL('./deploy/asset-release.json',import.meta.url)));
  const origin=env.VITE_ASSET_ORIGIN ?? (mode==='hosted'||!existsSync('public/data/catalog.json')?release.origin:'');
  if(origin&&!/^https?:\/\/[^\s"'<>]+$/.test(origin))throw Error('VITE_ASSET_ORIGIN must be an HTTP(S) URL');
  let output;
  return {
  base: './',
  define: {'import.meta.env.VITE_ASSET_ORIGIN': JSON.stringify(origin)},
  build: {copyPublicDir: !origin},
  plugins: origin?[{
    name:'frontend-only-public-files',
    configResolved(config){output=resolve(config.root,config.build.outDir);},
    closeBundle(){cpSync('public/fonts',resolve(output,'fonts'),{recursive:true});cpSync('public/THIRD-PARTY-NOTICES.txt',resolve(output,'THIRD-PARTY-NOTICES.txt'));},
  }]:[],
  server: {
    host: '0.0.0.0',
    port: 5186,
    strictPort: true,
    allowedHosts: ['gsv.local'],
  },
  preview: {
    host: '0.0.0.0',
    port: 5186,
    strictPort: true,
    allowedHosts: ['gsv.local'],
  },
  };
});
