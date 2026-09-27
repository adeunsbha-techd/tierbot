const { REST, Routes } = require('discord.js');
const { client, CONFIG } = require('./bot.js');
const { commands } = require('./commands.js');
const H = require('./handlers.js');

client.once('clientReady', async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  console.log(`📡 Guilds: ${client.guilds.cache.size}`);

  const rest = new REST({ version: '10' }).setToken(CONFIG.token);
  try {
    const body = commands.map(c => c.toJSON());
    await rest.put(
      Routes.applicationGuildCommands(CONFIG.clientId, CONFIG.guildId),
      { body }
    );
    console.log(`✅ ${body.length} slash commands registered.`);
  } catch (e) {
    console.error('Register error:', e.message);
    if (e.rawError) console.error(JSON.stringify(e.rawError));
  }
});

client.on('interactionCreate', async interaction => {
  try {
    // BUTTON
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('queue_')) {
        await H.handleQueueButton(interaction);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    switch (interaction.commandName) {
      case 'queue': await H.handleQueue(interaction); break;
      case 'result': await H.handleResult(interaction); break;
      case 'profile': await H.handleProfile(interaction); break;
      case 'cooldown': await H.handleCooldown(interaction); break;
      case 'applytester': await H.handleApplyTester(interaction); break;
      case 'setuptier': await H.handleSetupTier(interaction); break;
      case 'autowelcome': await H.handleAutoWelcome(interaction); break;
      case 'autoleft': await H.handleAutoLeft(interaction); break;
      case 'testermanage': await H.handleTesterManage(interaction); break;
      case 'resettest': await H.handleResetTest(interaction); break;
    }
  } catch (e) {
    console.error('Interaction error:', e);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true }).catch(()=>{});
    }
  }
});

process.on('SIGINT', () => { console.log('\n[!] Shutdown...'); process.exit(0); });
