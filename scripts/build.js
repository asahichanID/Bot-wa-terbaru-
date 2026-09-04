import { execSync } from 'child_process';
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

console.log('📦 [Build] 1/3 Membangun asset web dashboard...');
try {
  execSync('npx vite build', { stdio: 'inherit' });
  console.log('✅ Web dashboard siap!');
} catch (e) {
  console.error('❌ Gagal build web dashboard:', e);
  process.exit(1);
}

console.log('⚙️ [Build] 2/3 Mengompilasi engine bot WhatsApp (src/index.ts)...');
try {
  esbuild.buildSync({
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.js',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    sourcemap: true,
  });
  console.log('✅ dist/index.js siap!');
} catch (e) {
  console.error('❌ Gagal compile src/index.ts:', e);
}

console.log('🚀 [Build] 3/3 Mengompilasi server utama (server.ts)...');
try {
  esbuild.buildSync({
    entryPoints: ['server.ts'],
    outfile: 'dist/server.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    sourcemap: true,
  });
  console.log('✅ dist/server.cjs siap!');
} catch (e) {
  console.error('❌ Gagal compile server.ts:', e);
  process.exit(1);
}

console.log('✨ [Build] Selesai! Semua file siap dijalankan di Pterodactyl.');

