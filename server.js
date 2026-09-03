// Bridge entry point for hosting panels like Pterodactyl that default to 'node server.js'
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDist = path.join(__dirname, 'dist', 'server.cjs');

if (!fs.existsSync(targetDist)) {
  console.log('⚡ [Pterodactyl] dist/server.cjs belum ter-compile. Menjalankan build otomatis...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ [Pterodactyl] Build selesai!');
  } catch (e) {
    console.error('❌ Gagal melakukan build otomatis:', e);
  }
}

// Execute compiled production server
import('./dist/server.cjs');
