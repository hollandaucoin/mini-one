import express from 'express';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdir } from 'fs/promises';

const router = express.Router();

// Dynamically load route files
async function loadRoutes() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const files = await readdir(__dirname);
  const routePromises = files.filter(file => file !== '_index.js').map(file => import(__dirname + '/' + file));
  const routeModules = await Promise.all(routePromises);
  routeModules.forEach(routeModule => { router.use(routeModule.default.path, routeModule.default.router); });
}

export default { router, loadRoutes };
