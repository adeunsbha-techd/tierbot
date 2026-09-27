const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const GAMEMODES = ["Sword","Netherite Pot","Vanilla PvP","UHC","Mace","Diamond SMP","Axe","Pot","Crystal"];

const commands = [
  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Setup panel queue untuk gamemode')
    .addStringOption(o => o.setName('gamemode').setDescription('Gamemode').setRequired(true)
      .addChoices(...GAMEMODES.map(g => ({ name: g, value: g }))))
    .addUserOption(o => o.setName('tester').setDescription('Tester yang online').setRequired(true))
    .addStringOption(o => o.setName('status').setDescription('Status').setRequired(true)
      .addChoices({ name: 'Online', value: 'online' }, { name: 'Offline', value: 'offline' }))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('result')
    .setDescription('Post hasil tier test')
    .addUserOption(o => o.setName('discord').setDescription('Discord player').setRequired(true))
    .addStringOption(o => o.setName('ign').setDescription('IGN Minecraft').setRequired(true))
    .addStringOption(o => o.setName('tier').setDescription('Tier (HT1, LT1, HT2, ... Retired)').setRequired(true)
      .addChoices(
        { name: 'HT1', value: 'HT1' }, { name: 'LT1', value: 'LT1' },
        { name: 'HT2', value: 'HT2' }, { name: 'LT2', value: 'LT2' },
        { name: 'HT3', value: 'HT3' }, { name: 'LT3', value: 'LT3' },
        { name: 'HT4', value: 'HT4' }, { name: 'LT4', value: 'LT4' },
        { name: 'HT5', value: 'HT5' }, { name: 'LT5', value: 'LT5' },
        { name: 'Retired', value: 'Retired' }
      ))
    .addStringOption(o => o.setName('point').setDescription('Score, contoh: 3-0').setRequired(true))
    .addStringOption(o => o.setName('gamemode').setDescription('Gamemode').setRequired(true)
      .addChoices(...GAMEMODES.map(g => ({ name: g, value: g }))))
    .addStringOption(o => o.setName('region').setDescription('Region').setRequired(false)
      .addChoices(
        { name: 'Asia', value: 'Asia' },
        { name: 'EU', value: 'EU' },
        { name: 'NA', value: 'NA' },
        { name: 'SA', value: 'SA' },
        { name: 'OCE', value: 'OCE' }
      ))
    .addStringOption(o => o.setName('previous').setDescription('Rank sebelumnya').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Register / update profile')
    .addSubcommand(s => s.setName('register').setDescription('Register IGN')
      .addStringOption(o => o.setName('ign').setDescription('IGN Minecraft').setRequired(true))
      .addStringOption(o => o.setName('region').setDescription('Region').setRequired(true)
        .addChoices(
          { name: 'Asia', value: 'Asia' },
          { name: 'EU', value: 'EU' },
          { name: 'NA', value: 'NA' }
        )))
    .addSubcommand(s => s.setName('view').setDescription('Lihat profile')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(false))),

  new SlashCommandBuilder()
    .setName('cooldown')
    .setDescription('Lihat cooldown kamu'),

  new SlashCommandBuilder()
    .setName('applytester')
    .setDescription('Apply jadi tester')
    .addStringOption(o => o.setName('gamemode').setDescription('Gamemode').setRequired(true)
      .addChoices(...GAMEMODES.map(g => ({ name: g, value: g }))))
    .addStringOption(o => o.setName('reason').setDescription('Alasan (min 100)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('setuptier')
    .setDescription('Auto bikin channel + role tier')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('autowelcome')
    .setDescription('Set channel welcome')
    .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)
      .addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('autoleft')
    .setDescription('Set channel leave notif')
    .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)
      .addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('testermanage')
    .setDescription('Manage tester')
    .addSubcommand(s => s.setName('add').setDescription('Tambah tester')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('gamemode').setDescription('Gamemode').setRequired(true)
        .addChoices(...GAMEMODES.map(g => ({ name: g, value: g })))))
    .addSubcommand(s => s.setName('remove').setDescription('Hapus tester')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List tester'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('resettest')
    .setDescription('Reset cooldown player')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o => o.setName('gamemode').setDescription('Gamemode').setRequired(false)
      .addChoices(...GAMEMODES.map(g => ({ name: g, value: g }))))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

module.exports = { commands, GAMEMODES };
