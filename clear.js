const { REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN) { console.error('❌ DISCORD_TOKEN belum di-set!'); process.exit(1); }

const rest = new REST({ version: '10' }).setToken(TOKEN);
const { commands } = require('./commands.js');

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: [] }
    );
    console.log('✅ Cleared old commands');

    const body = commands.map(c => c.toJSON());
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body }
    );
    console.log(`✅ Registered ${body.length} new commands:`);
    body.forEach(c => console.log('  /' + c.name));
  } catch (e) {
    console.error('❌', e.message);
    if (e.rawError) console.error(JSON.stringify(e.rawError, null, 2));
  }
})();
