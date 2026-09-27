const { Client, GatewayIntentBits, Partials, REST, Routes, EmbedBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const DB = require('./db.js');
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

if (!CONFIG.token || CONFIG.token.includes('PASTE_')) { console.error('❌ Token belum diisi!'); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.GuildMember]
});

// WELCOME
client.on('guildMemberAdd', async member => {
  const chId = DB.getRuntime('welcomeChannel', null);
  if (!chId) return;
  try {
    const ch = await member.guild.channels.fetch(chId);
    if (!ch) return;
    const embed = new EmbedBuilder()
      .setColor(0x8B5CF6)
      .setTitle('🎉 Welcome!')
      .setDescription(`Halo <@${member.id}>, selamat datang di **${member.guild.name}**!\nMember ke-**${member.guild.memberCount}**`)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setTimestamp();
    await ch.send({ content: `<@${member.id}>`, embeds: [embed] });
  } catch(e) {}
});

// LEAVE
client.on('guildMemberRemove', async member => {
  const chId = DB.getRuntime('leaveChannel', null);
  if (!chId) return;
  try {
    const ch = await member.guild.channels.fetch(chId);
    if (!ch) return;
    const embed = new EmbedBuilder()
      .setColor(0xFF5555)
      .setTitle('👋 Member Left')
      .setDescription(`**${member.user.tag}** keluar dari server.\nSisa: **${member.guild.memberCount}**`)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setTimestamp();
    await ch.send({ embeds: [embed] });
  } catch(e) {}
});

module.exports = { client, CONFIG, DB };
