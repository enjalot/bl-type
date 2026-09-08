// Generated assets can live outside the application repository and Space.
const origin=import.meta.env.VITE_ASSET_ORIGIN || '';
const base=origin?origin.replace(/\/$/,'')+'/':import.meta.env.BASE_URL;
export function assetUrl(path){
 if(/^https?:\/\//.test(path))return path;
 return base+path.replace(/^\//,'');
}
