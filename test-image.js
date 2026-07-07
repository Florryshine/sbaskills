import { fetchStockImage, createBrandedThumbnail } from './lib/image-engine.js';
import fs from 'fs';

const test = async () => {
  console.log('🔍 Fetching stock image...');
  const stock = await fetchStockImage('Nigerian student studying');
  if (!stock) {
    console.error('❌ No stock found – check PEXELS/PIXABAY keys');
    return;
  }
  console.log('✅ Stock fetched, creating thumbnail...');
  const buffer = await createBrandedThumbnail(stock.buffer, 'Test Title', 'JAMB');
  fs.writeFileSync('test-output.jpg', buffer);
  console.log('✅ Saved test-output.jpg – check if text is visible.');
};

test().catch(console.error);