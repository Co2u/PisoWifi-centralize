import fs from 'fs';
import path from 'path';

function copyRecursiveSync(src: string, dest: string) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    // skip sqlite files to ensure we don't overwrite DB during sync
    if (src.includes('database.sqlite')) return;
    
    fs.copyFileSync(src, dest);
  }
}

copyRecursiveSync('temp-sync', '.');

// Clean up
fs.rmSync('temp-sync', { recursive: true, force: true });
fs.rmSync('copy.ts', { force: true });
console.log('Sync completed and cleanup done.');
