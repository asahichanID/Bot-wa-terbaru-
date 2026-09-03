import fs from 'fs';
import { execSync } from 'child_process';

// Ensure dist/server.cjs exists before running 'node dist/server.cjs'
if (!fs.existsSync('dist/server.cjs')) {
  console.log('[Pterodactyl] dist/server.cjs not found. Automatically building project...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('[Pterodactyl] Build finished successfully! Starting server...');
  } catch (err) {
    console.warn('[Pterodactyl] Full build failed, compiling server.ts via esbuild fallback...', err);
    try {
      if (!fs.existsSync('dist')) {
        fs.mkdirSync('dist', { recursive: true });
      }
      execSync('npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs', { stdio: 'inherit' });
      console.log('[Pterodactyl] Fallback server build ready!');
    } catch (fallbackErr) {
      console.error('[Pterodactyl] Critical error: could not compile server.', fallbackErr);
      process.exit(1);
    }
  }
}
