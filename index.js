// Primary universal entry point for Pterodactyl hosting panels executing 'node index.js' or 'npm start'
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.WA_ENGINE = process.env.WA_ENGINE || 'baileys';

console.log('═══════════════════════════════════════════════════════════');
console.log('🤖 MODULAR WHATSAPP BOT - MEMULAI BOT...');
console.log('═══════════════════════════════════════════════════════════');

const targetDist = path.join(__dirname, 'dist', 'server.cjs');

if (!fs.existsSync(targetDist)) {
  console.log('⚡ [Pterodactyl] Mengompilasi engine bot via esbuild (hanya 0.1 detik)...');
  try {
    const esbuild = (await import('esbuild')).default;
    if (!fs.existsSync(path.join(__dirname, 'dist'))) {
      fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
    }
    esbuild.buildSync({
      entryPoints: [path.join(__dirname, 'server.ts')],
      outfile: targetDist,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      packages: 'external',
      sourcemap: false,
    });
    console.log('✅ [Pterodactyl] Kompilasi berhasil!');
  } catch (e) {
    console.warn('⚠️ Kompilasi esbuild dilewati, menjalankan via tsx...');
  }
}

if (fs.existsSync(targetDist)) {
  require(targetDist);
} else {
  console.log('🚀 Menjalankan langsung via tsx...');
  import('./server.ts');
}
