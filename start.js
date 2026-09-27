const fs = require('fs');
const path = require('path');

// Load config.json kalau ada
const CONFIG_PATH = path.join(__dirname, 'config.json');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch(e){}

// ENV override
if (process.env.DISCORD_TOKEN) cfg.token = process.env.DISCORD_TOKEN;
if (process.env.CLIENT_ID) cfg.clientId = process.env.CLIENT_ID;
if (process.env.GUILD_ID) cfg.guildId = process.env.GUILD_ID;

// Save config (biar bot.js baca yang udah di-override)
fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));

console.log('Config loaded. Token:', cfg.token ? cfg.token.slice(0, 20) + '...' : 'MISSING');

require('./bot.js');
require('./events.js');
const { client } = require('./bot.js');
client.login(cfg.token);
