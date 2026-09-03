import fs from 'fs';
import { execSync } from 'child_process';

if (!fs.existsSync('dist/server.cjs')) {
  console.log('[Pterodactyl] dist/server.cjs not found. Automatically building project...');
  try {
    execSync('node scripts/build.js', { stdio: 'inherit' });
    console.log('[Pterodactyl] Build finished successfully! Starting server...');
  } catch (err) {
    console.error('[Pterodactyl] Critical error: could not compile server.', err);
    process.exit(1);
  }
}
