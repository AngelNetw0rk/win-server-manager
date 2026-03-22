const fs = require('fs');
const path = require('path');
const db = require('./database');

function scan() {
  const rootPathsRaw = db.getSetting('root_paths');
  let rootPaths = [];
  try { rootPaths = JSON.parse(rootPathsRaw); } catch {}

  if (!Array.isArray(rootPaths) || rootPaths.length === 0) {
    return { discovered: 0, paths: [] };
  }

  const discovered = [];
  const existingIds = new Set(db.getAllSofts().map(s => s.id));

  for (const rootPath of rootPaths) {
    if (!fs.existsSync(rootPath)) continue;

    const entries = fs.readdirSync(rootPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip hidden and system dirs
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = path.join(rootPath, entry.name);
      const id = generateId(fullPath);

      if (!existingIds.has(id)) {
        const soft = {
          id,
          name: entry.name,
          directory: fullPath,
          command: detectCommand(fullPath),
          status: 'stopped'
        };
        db.upsertSoft(soft);
        discovered.push(soft);
      }
      existingIds.add(id);
    }
  }

  return { discovered: discovered.length, softs: discovered };
}

function generateId(dirPath) {
  // Stable ID based on path
  const normalized = dirPath.replace(/\\/g, '/').toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const chr = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'soft_' + Math.abs(hash).toString(36);
}

function detectCommand(dirPath) {
  // Try to auto-detect the launch command
  if (fs.existsSync(path.join(dirPath, 'package.json'))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dirPath, 'package.json'), 'utf-8'));
      if (pkg.scripts && pkg.scripts.start) return 'npm start';
    } catch {}
    return 'node index.js';
  }
  if (fs.existsSync(path.join(dirPath, 'index.js'))) return 'node index.js';
  if (fs.existsSync(path.join(dirPath, 'main.js'))) return 'node main.js';
  if (fs.existsSync(path.join(dirPath, 'app.js'))) return 'node app.js';
  if (fs.existsSync(path.join(dirPath, 'index.py'))) return 'python index.py';
  if (fs.existsSync(path.join(dirPath, 'main.py'))) return 'python main.py';
  if (fs.existsSync(path.join(dirPath, 'start.bat'))) return 'start.bat';
  return 'node index.js';
}

module.exports = { scan, generateId };
