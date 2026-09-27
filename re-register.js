const { REST, Routes } = require('discord.js');
const { commands } = require('./commands.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN) { console.error('❌ Token ga ada'); process.exit(1); }

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    const body = commands.map(c => c.toJSON());
    console.log('Registering', body.length, 'commands...');
    const data = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body }
    );
    console.log(`✅ ${data.length} commands registered:`);
    data.forEach(c => console.log('  /' + c.name));
  } catch (e) {
    console.error('❌', e.message);
    if (e.rawError) console.error(JSON.stringify(e.rawError, null, 2));
  }
})();
