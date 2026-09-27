const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
        ChannelType, PermissionFlagsBits } = require('discord.js');
const DB = require('./db.js');
const CONFIG = require('./config.json');

// ============ ROLE COLOR MAP ============
const COLOR_MAP = {
  RED: 0xED4245,
  DARK_RED: 0xA12823,
  ORANGE: 0xE67E22,
  DARK_ORANGE: 0xCA6F1E,
  YELLOW: 0xFEE75C,
  GOLD: 0xDAA520,
  GREEN: 0x57F287,
  DARK_GREEN: 0x2ECC71,
  AQUA: 0x1ABC9C,
  BLUE: 0x3498DB,
  PURPLE: 0x9B59B6
};

function getTierRoleName(tier, gamemode) {
  // Ubah "Vanilla PvP" jadi "VANILLA", "Netherite Pot" jadi "NETH"
  const short = gamemode.toUpperCase()
    .replace('VANILLA PVP', 'VANILLA')
    .replace('NETHERITE POT', 'NETHPOT')
    .replace('DIAMOND SMP', 'DSMP')
    .replace(/\s+/g, '');
  return `${tier.toUpperCase()} ${short}`;
}

// ============ AUTO-CREATE TIER ROLES ============
async function ensureTierRoles(guild) {
  const created = [];
  for (const gm of CONFIG.gamemodes) {
    for (const tier of CONFIG.tiers) {
      const name = getTierRoleName(tier, gm);
      let role = guild.roles.cache.find(r => r.name === name);
      if (!role) {
        try {
          const colorName = CONFIG.tierColors[tier] || 'GREY';
          role = await guild.roles.create({
            name,
            color: COLOR_MAP[colorName] || 0x99AAB5,
            reason: 'Auto-create tier role',
            mentionable: false,
            hoist: false
          });
          created.push(name);
        } catch (e) {
          console.error('role create fail', name, e.message);
        }
      }
    }
  }
  return created;
}

// ============ QUEUE PANEL ============
function buildQueuePanel(gamemode, testerTag, testerId, status, queue) {
  const isOnline = status === 'online';
  const dot = isOnline ? '🟢' : '🔴';
  const statusText = isOnline ? 'Open' : 'Closed';
  const borderColor = isOnline ? 0x57F287 : 0xED4245;

  const testerLine = `<@${testerId}>`;

  const queueLines = queue.length === 0
    ? '_Nobody in queue yet._'
    : queue.map((e, i) => `${i + 1}. <@${e.userId}> — \`${e.ign}\``).join('\n');

  const description = isOnline
    ? `The **${gamemode}** queue is currently **open**.\nPress **Join Queue** below to enter the waitlist.\nYou'll be asked for your **Minecraft username**.\n\n**Tester(s) Online**\n${testerLine}\n\n**Queue (${queue.length}/${CONFIG.queueMax})**\n${queueLines}\n\n${dot} **${statusText}**`
    : `The **${gamemode}** queue is currently **closed**.\nPress **Join Queue** below to enter the waitlist.\n\n**Tester(s) Online**\n${testerLine}\n\n**Queue (${queue.length}/${CONFIG.queueMax})**\n${queueLines}\n\n${dot} **${statusText}**`;

  const embed = new EmbedBuilder()
    .setColor(borderColor)
    .setAuthor({ name: `${gamemode} Tester${isOnline ? 's' : ''} ${isOnline ? 'Available!' : 'Offline'}` })
    .setDescription(description)
    .setFooter({ text: `Last Update: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`queue_join_${gamemode}`)
      .setLabel('Join Queue')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!isOnline),
    new ButtonBuilder()
      .setCustomId(`queue_leave_${gamemode}`)
      .setLabel('Leave Queue')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!isOnline),
    new ButtonBuilder()
      .setCustomId(`queue_list_${gamemode}`)
      .setLabel('View Queue')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// ============ /queue ============
async function handleQueue(interaction) {
  const gamemode = interaction.options.getString('gamemode');
  const tester = interaction.options.getUser('tester');
  const status = interaction.options.getString('status');

  const queue = DB.getQueue(gamemode);
  const panel = buildQueuePanel(gamemode, tester.tag, tester.id, status, queue);

  DB.setRuntime(`tester_${gamemode}`, {
    testerId: tester.id,
    testerTag: tester.tag,
    status,
    updatedAt: Date.now()
  });

  const saved = DB.getQueueMessages()[gamemode];
  if (saved) {
    try {
      const ch = await interaction.guild.channels.fetch(saved.chId);
      const msg = await ch.messages.fetch(saved.msgId);
      await msg.edit(panel);
      await interaction.reply({ content: `✅ Panel **${gamemode}** updated: **${status.toUpperCase()}**`, ephemeral: true });
      return;
    } catch (e) {}
  }

  const qch = interaction.channel;
  const sent = await qch.send(panel);
  DB.setQueueMessage(gamemode, sent.id, qch.id);
  await interaction.reply({ content: `✅ Panel **${gamemode}** dibuat di channel ini.`, ephemeral: true });
}

// ============ /result ============
async function handleResult(interaction) {
  await interaction.deferReply();

  const discord = interaction.options.getUser('discord');
  const ign = interaction.options.getString('ign');
  const tier = interaction.options.getString('tier');
  const point = interaction.options.getString('point');
  const gamemode = interaction.options.getString('gamemode');
  const region = interaction.options.getString('region') || 'Asia';
  const previous = interaction.options.getString('previous') || 'No Rank';

  const member = await interaction.guild.members.fetch(discord.id).catch(()=>null);
  if (!member) {
    await interaction.editReply({ content: `❌ User <@${discord.id}> ga ada di server.` });
    return;
  }

  // ==== AUTO ROLE ====
  const tierRoleName = getTierRoleName(tier, gamemode);
  let roleNote = '';

  try {
    // Remove semua tier role lama (semua gamemode)
    const allTierRoleNames = [];
    for (const gm of CONFIG.gamemodes) {
      for (const t of CONFIG.tiers) {
        allTierRoleNames.push(getTierRoleName(t, gm));
      }
    }
    const oldRoles = member.roles.cache.filter(r => allTierRoleNames.includes(r.name));
    if (oldRoles.size) await member.roles.remove(oldRoles).catch(()=>{});

    // Cari role target, kalau belum ada → bikin
    let targetRole = interaction.guild.roles.cache.find(r => r.name === tierRoleName);
    if (!targetRole) {
      const colorName = CONFIG.tierColors[tier] || 'GREY';
      targetRole = await interaction.guild.roles.create({
        name: tierRoleName,
        color: COLOR_MAP[colorName] || 0x99AAB5,
        reason: 'Auto-create tier role from /result',
        mentionable: false,
        hoist: false
      });
    }

    await member.roles.add(targetRole);
    roleNote = `✅ Role **${tierRoleName}** diberikan.`;
  } catch (e) {
    roleNote = `⚠️ Gagal assign role: ${e.message}`;
    console.error('role error', e);
  }

  // Set cooldown
  const cdMs = CONFIG.cooldownDays * 24 * 60 * 60 * 1000;
  DB.setCooldown(discord.id, gamemode, Date.now() + cdMs);

  // Save
  DB.addResult({
    playerId: discord.id,
    ign, tier, point, gamemode, region, previous,
    testerId: interaction.user.id,
    testerTag: interaction.user.tag,
    roleName: tierRoleName
  });

  // Post
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setAuthor({ name: `${ign}'s Test Results 🏆` })
    .setThumbnail(`https://mc-heads.net/avatar/${ign}/128`)
    .addFields(
      { name: 'Tester', value: `<@${interaction.user.id}>`, inline: false },
      { name: 'Region', value: region, inline: false },
      { name: 'Username', value: `\`${ign}\``, inline: false },
      { name: 'Gamemode', value: gamemode, inline: false },
      { name: 'Previous Rank', value: previous, inline: false },
      { name: 'Rank Earned', value: `**${tier} ${gamemode.toUpperCase().replace(/\s+/g,'')}**`, inline: false },
      { name: 'Score', value: `\`${point}\``, inline: false }
    )
    .setFooter({ text: 'Creators Tier' })
    .setTimestamp();

  const resultCh = interaction.guild.channels.cache.find(c =>
    c.name === CONFIG.channels.result && c.type === ChannelType.GuildText);

  const pingMsg = `<@${discord.id}> ${roleNote}`;

  if (resultCh) {
    await resultCh.send({ content: pingMsg, embeds: [embed] });
    await interaction.editReply({ content: `✅ Result dipost di <#${resultCh.id}>` });
  } else {
    await interaction.editReply({ content: pingMsg, embeds: [embed] });
  }
}

// ============ /profile ============
async function handleProfile(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'register') {
    const ign = interaction.options.getString('ign');
    const region = interaction.options.getString('region');
    DB.setProfile(interaction.user.id, { ign, region, updatedAt: Date.now() });
    await interaction.reply({ content: `✅ Profile saved! IGN: \`${ign}\` | Region: \`${region}\``, ephemeral: true });
  } else {
    const user = interaction.options.getUser('user') || interaction.user;
    const p = DB.getProfile(user.id);
    if (!p) { await interaction.reply({ content: `❌ ${user.tag} belum register.`, ephemeral: true }); return; }
    const results = DB.getUserResults(user.id);
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`Profile: ${user.tag}`)
      .setThumbnail(`https://mc-heads.net/avatar/${p.ign || 'Steve'}/128`)
      .addFields(
        { name: 'IGN', value: `\`${p.ign}\``, inline: true },
        { name: 'Region', value: `\`${p.region}\``, inline: true },
        { name: 'Tests Taken', value: `${results.length}`, inline: true }
      );
    await interaction.reply({ embeds: [embed] });
  }
}

// ============ /cooldown ============
async function handleCooldown(interaction) {
  const cds = DB.getCooldownsByUser(interaction.user.id);
  const now = Date.now();
  const lines = CONFIG.gamemodes.map(gm => {
    const until = cds[gm] || 0;
    if (until > now) {
      const ms = until - now;
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      return `❌ **${gm}**: cooldown ${d}d ${h}h ${m}m`;
    }
    return `✅ **${gm}**: free to queue`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('Your Cooldowns')
    .setDescription(lines)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ============ /applytester ============
async function handleApplyTester(interaction) {
  const gm = interaction.options.getString('gamemode');
  const reason = interaction.options.getString('reason');
  if (reason.length < 100) {
    await interaction.reply({ content: `❌ Alasan minimal 100 karakter. Kamu: ${reason.length}`, ephemeral: true });
    return;
  }
  const logCh = interaction.guild.channels.cache.find(c => c.name === CONFIG.channels.applyTester);
  if (!logCh) {
    await interaction.reply({ content: `❌ Channel \`${CONFIG.channels.applyTester}\` ga ada.`, ephemeral: true });
    return;
  }
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🛡️ Tester Application')
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: 'Applicant', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Gamemode', value: gm, inline: true },
      { name: 'Reason', value: reason }
    )
    .setTimestamp();
  await logCh.send({ embeds: [embed] });
  await interaction.reply({ content: `✅ Lamaran terkirim ke <#${logCh.id}>.`, ephemeral: true });
}

// ============ /setuptier ============
async function handleSetupTier(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  const everyone = guild.roles.everyone;

  const template = [
    { cat: '📋 INFO', perm: 'public', channels: [
      { n: '📜┃rules', v: false },
      { n: '📢┃announcement', v: false },
      { n: '💬┃general', v: false }
    ]},
    { cat: '🏆 TIER TEST', perm: 'public', channels: [
      { n: '📊┃queue', v: false },
      { n: '📝┃result', v: false },
      { n: '📋┃apply-for-tester', v: false },
      { n: '📞┃request-test', v: false },
      { n: '❓┃support', v: false }
    ]},
    { cat: '🔊 VOICE', perm: 'public', channels: [
      { n: '🔊┃public-1', v: true },
      { n: '💤┃afk', v: true }
    ]},
    { cat: '🔒 STAFF', perm: 'admin', channels: [
      { n: '📝┃staff-chat', v: false },
      { n: '📋┃tier-logs', v: false }
    ]}
  ];

  let channelCount = 0;
  for (const c of template) {
    const ov = c.perm === 'admin'
      ? [{ id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] }]
      : [{ id: everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }];

    const category = await guild.channels.create({
      name: c.cat, type: ChannelType.GuildCategory, permissionOverwrites: ov
    });

    for (const ch of c.channels) {
      await guild.channels.create({
        name: ch.n, type: ch.v ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent: category.id, permissionOverwrites: ov
      }).catch(()=>{});
      channelCount++;
    }
  }

  // Auto-create tier roles
  const roleCount = (await ensureTierRoles(guild)).length;

  await interaction.editReply({
    content: `✅ Setup selesai!\n📁 **${channelCount}** channel dibuat\n🎭 **${roleCount}** role tier dibuat`
  });
}

async function handleAutoWelcome(interaction) {
  const ch = interaction.options.getChannel('channel');
  DB.setRuntime('welcomeChannel', ch.id);
  await interaction.reply({ content: `✅ Welcome channel: <#${ch.id}>`, ephemeral: true });
}

async function handleAutoLeft(interaction) {
  const ch = interaction.options.getChannel('channel');
  DB.setRuntime('leaveChannel', ch.id);
  await interaction.reply({ content: `✅ Leave channel: <#${ch.id}>`, ephemeral: true });
}

async function handleTesterManage(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') {
    const user = interaction.options.getUser('user');
    const gm = interaction.options.getString('gamemode');
    DB.addTester(user.id, { userTag: user.tag, gamemode: gm });
    await interaction.reply({ content: `✅ <@${user.id}> ditambah sebagai tester **${gm}**`, ephemeral: true });
  } else if (sub === 'remove') {
    const user = interaction.options.getUser('user');
    DB.removeTester(user.id);
    await interaction.reply({ content: `✅ <@${user.id}> dihapus dari tester`, ephemeral: true });
  } else {
    const testers = DB.getAllTesters();
    const list = Object.entries(testers).map(([id, t]) => `<@${id}> — ${t.gamemode}`).join('\n') || '_No testers_';
    await interaction.reply({ content: `**Testers:**\n${list}`, ephemeral: true });
  }
}

async function handleResetTest(interaction) {
  const user = interaction.options.getUser('user');
  const gm = interaction.options.getString('gamemode');
  if (gm) {
    DB.resetCooldown(user.id, gm);
    await interaction.reply({ content: `✅ Cooldown ${gm} direset untuk <@${user.id}>`, ephemeral: true });
  } else {
    for (const g of CONFIG.gamemodes) DB.resetCooldown(user.id, g);
    await interaction.reply({ content: `✅ Semua cooldown direset untuk <@${user.id}>`, ephemeral: true });
  }
}

// ============ BUTTON ============
async function handleQueueButton(interaction) {
  const parts = interaction.customId.split('_');
  const action = parts[1];
  const gamemode = parts.slice(2).join('_');

  const runtime = DB.getRuntime(`tester_${gamemode}`, null);
  if (!runtime || runtime.status === 'offline') {
    await interaction.reply({ content: `❌ Queue **${gamemode}** closed.`, ephemeral: true });
    return;
  }

  if (action === 'join') {
    const profile = DB.getProfile(interaction.user.id);
    if (!profile) {
      await interaction.reply({ content: `❌ Register dulu pakai \`/profile register ign:X region:Asia\``, ephemeral: true });
      return;
    }
    const cd = DB.getCooldown(interaction.user.id, gamemode);
    if (cd > Date.now()) {
      const ms = cd - Date.now();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      await interaction.reply({ content: `⏳ Cooldown masih **${h}h ${m}m**.`, ephemeral: true });
      return;
    }
    const q = DB.getQueue(gamemode);
    if (q.length >= CONFIG.queueMax) {
      await interaction.reply({ content: `❌ Queue penuh.`, ephemeral: true });
      return;
    }
    if (q.some(e => e.userId === interaction.user.id)) {
      await interaction.reply({ content: `⚠️ Kamu udah di queue.`, ephemeral: true });
      return;
    }
    DB.addToQueue(gamemode, { userId: interaction.user.id, ign: profile.ign, joinedAt: Date.now() });
    await interaction.reply({ content: `✅ Masuk queue **${gamemode}** sebagai \`${profile.ign}\``, ephemeral: true });
    await refreshQueuePanel(interaction.guild, gamemode);
  } else if (action === 'leave') {
    DB.removeFromQueue(gamemode, interaction.user.id);
    await interaction.reply({ content: `✅ Keluar dari queue **${gamemode}**`, ephemeral: true });
    await refreshQueuePanel(interaction.guild, gamemode);
  } else {
    const q = DB.getQueue(gamemode);
    const list = q.length === 0 ? '_Queue kosong_' : q.map((e, i) => `${i + 1}. \`${e.ign}\``).join('\n');
    await interaction.reply({ content: `**Queue ${gamemode} (${q.length}/${CONFIG.queueMax}):**\n${list}`, ephemeral: true });
  }
}

async function refreshQueuePanel(guild, gamemode) {
  const saved = DB.getQueueMessages()[gamemode];
  if (!saved) return;
  const runtime = DB.getRuntime(`tester_${gamemode}`, null);
  if (!runtime) return;
  try {
    const ch = await guild.channels.fetch(saved.chId);
    const msg = await ch.messages.fetch(saved.msgId);
    const q = DB.getQueue(gamemode);
    const panel = buildQueuePanel(gamemode, runtime.testerTag, runtime.testerId, runtime.status, q);
    await msg.edit(panel);
  } catch (e) {}
}

module.exports = {
  handleQueue, handleResult, handleProfile, handleCooldown,
  handleApplyTester, handleSetupTier, handleAutoWelcome, handleAutoLeft,
  handleTesterManage, handleResetTest, handleQueueButton,
  buildQueuePanel, refreshQueuePanel, ensureTierRoles, getTierRoleName
};
