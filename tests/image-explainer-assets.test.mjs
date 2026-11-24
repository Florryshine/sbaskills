import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAssetReview,approvedAssetsFromBundle,reviewAssetCandidates,validateAssetForRender} from '../lib/image-explainer/assets.mjs';
const candidate={id:'p1',title:'Plant cell',media_type:'image',media_url:'https://images.pexels.com/photos/1/photo.jpeg',source_url:'https://www.pexels.com/photo/1/',provider:'Pexels',license:'Pexels license',creator:'A. Creator',review_status:'needs_admin_review'};
test('unreviewed media is never render-approved',()=>{assert.equal(normalizeAssetReview(candidate).review_status,'needs_admin_review');assert.equal(approvedAssetsFromBundle({assets:[candidate]}).length,0);});
test('approval requires explicit decision, license verification and source page',()=>{const b=reviewAssetCandidates({assets:[candidate]},[{id:'p1',decision:'approve',license_verified:true,license:'Pexels license confirmed',source_url:candidate.source_url}]);assert.equal(approvedAssetsFromBundle(b).length,1);});
test('rejects non-HTTPS and untrusted media hosts',()=>{assert.equal(normalizeAssetReview({...candidate,media_url:'http://images.pexels.com/a.jpg'}),null);assert.equal(normalizeAssetReview({...candidate,media_url:'https://evil.example/a.jpg'}),null);});
test('render validator requires approved trusted asset',()=>{const a={...candidate,review_status:'approved',license_verified:true};assert.equal(validateAssetForRender(a),true);assert.equal(validateAssetForRender({...a,license_verified:false}),false);});
