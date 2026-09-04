// Primary universal entry point for Pterodactyl hosting panels executing 'node index.js'
import 'dotenv/config';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const targetDist = path.join(__dirname, 'dist', 'server.cjs');

if (!fs.existsSync(targetDist)) {
  console.log('⚡ [Pterodactyl] dist/server.cjs belum ter-compile. Menjalankan build otomatis...');
  try {
    execSync('node scripts/build.js', { stdio: 'inherit' });
    console.log('✅ [Pterodactyl] Build selesai!');
  } catch (e) {
    console.error('❌ Gagal melakukan build otomatis:', e);
    // Fallback directly to tsx if available
    try {
      console.log('🔄 Mencoba menjalankan langsung via tsx...');
      execSync('npx tsx server.ts', { stdio: 'inherit' });
      process.exit(0);
    } catch {
      process.exit(1);
    }
  }
}

// Start compiled server & bot
require('./dist/server.cjs');
