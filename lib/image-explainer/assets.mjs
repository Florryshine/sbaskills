const clean=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
const ALLOWED_HOSTS=new Set(['images.pexels.com','videos.pexels.com','pixabay.com','cdn.pixabay.com','upload.wikimedia.org','commons.wikimedia.org','images.unsplash.com']);
export function normalizeAssetReview(asset,index=0){
 const mediaUrl=clean(asset?.media_url,2000),sourceUrl=clean(asset?.source_url,2000);
 let host='';try{const u=new URL(mediaUrl);if(u.protocol!=='https:')return null;host=u.hostname.toLowerCase();}catch{return null;}
 if(!ALLOWED_HOSTS.has(host)&&!host.endsWith('.pexels.com')&&!host.endsWith('.pixabay.com')&&!host.endsWith('.wikimedia.org'))return null;
 const type=asset?.media_type==='video'?'video':'image';
 return {id:clean(asset.id,100)||`research-asset-${index+1}`,title:clean(asset.title,180)||'Untitled asset',media_type:type,media_url:mediaUrl,preview_url:clean(asset.preview_url,2000)||mediaUrl,source_url:sourceUrl,provider:clean(asset.provider,80),creator:clean(asset.creator,160),license:clean(asset.license,240),attribution_required:asset.attribution_required===true,review_status:asset.review_status==='approved'&&asset.license_verified===true?'approved':'needs_admin_review',license_verified:asset.review_status==='approved'&&asset.license_verified===true,attribution:clean(asset.attribution,300),query:clean(asset.query,160)};
}
export function approvedAssetsFromBundle(bundle){
 return (Array.isArray(bundle?.assets)?bundle.assets:[]).map(normalizeAssetReview).filter(a=>a&&a.review_status==='approved'&&a.license_verified);
}
export function reviewAssetCandidates(bundle,updates){
 if(!Array.isArray(bundle?.assets)||!Array.isArray(updates))throw new Error('Asset candidates and review updates are required.');
 const byId=new Map(updates.map(x=>[clean(x.id,100),x]));
 return {...bundle,assets:bundle.assets.map((raw,i)=>{
  const asset=normalizeAssetReview(raw,i);if(!asset)return raw;
  const change=byId.get(asset.id);if(!change)return asset;
  const approved=change.decision==='approve'&&change.license_verified===true&&clean(change.license,240).length>=4&&clean(change.source_url||asset.source_url,2000).startsWith('https://');
  return {...asset,review_status:approved?'approved':'rejected',license_verified:approved,license:clean(change.license,240)||asset.license,source_url:clean(change.source_url,2000)||asset.source_url,attribution:clean(change.attribution,300)||asset.creator,reviewed_at:new Date().toISOString()};
 })};
}
export function validateAssetForRender(asset){
 if(!asset||!['image','video'].includes(asset.media_type)||asset.review_status!=='approved'||asset.license_verified!==true)return false;
 try{const u=new URL(asset.media_url);return u.protocol==='https:'&&([...ALLOWED_HOSTS].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)));}
 catch{return false;}
}
