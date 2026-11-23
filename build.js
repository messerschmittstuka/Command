/* Concatenates src/ (in dependency order) into one self-contained dist/index.html. Run: node build.js */
const fs = require('fs'), path = require('path');
const ORDER = ['core/namespace', 'core/util', 'data/ranks', 'data/equipment', 'data/regiments', 'data/difficulty',
  'data/colliders', 'data/layout', 'data/battles', 'sim/time', 'sim/journal', 'sim/characters', 'sim/relationships', 'sim/section', 'sim/space', 'sim/squad', 'sim/interactions', 'sim/battle', 'sim/comms', 'sim/ai', 'sim/evaluation', 'sim/game',
  'render/engine', 'render/people', 'render/world', 'render/battlefield', 'ui/player', 'ui/hud', 'ui/battle_ui', 'ui/main'];
const read = f => fs.readFileSync(path.join(__dirname, 'src', f + '.js'), 'utf8');
exports.ORDER = ORDER; exports.source = (skip = []) => ORDER.filter(f => !skip.includes(f)).map(read).join('\n');
const shell = () => fs.readFileSync(path.join(__dirname, 'src/shell.html'), 'utf8');
/* Embeds the reused Hailstorm models and (downscaled) textures from assets/ as base64 so the game stays a single file. */
exports.assets = () => { const glb = {}, tex = {}; for (const f of fs.readdirSync(path.join(__dirname, 'assets'))) { const b = fs.readFileSync(path.join(__dirname, 'assets', f)).toString('base64'); if (f.endsWith('.glb')) glb[f.slice(0, -4)] = b; else if (f.endsWith('.jpg')) tex[f.slice(0, -4)] = b; } return 'Command.assets=' + JSON.stringify({ glb, tex }) + ';\n'; };
if (require.main === module) {
  const code = exports.source().replace(/^/, '') ; const marker = "(function (C) {\n  'use strict';\n  C.Engine"; // assets must exist before render modules run
  const html = shell().replace('@@SCRIPT@@', () => code.replace('var Command = { version', 'var Command = { version') + '\n' + exports.assets() + '\nCommand.main && Command.main();');
  fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'dist/index.html'), html); console.log('built', (html.length / 1e6).toFixed(2), 'MB');
}
