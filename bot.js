const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require("discord.js");
require("dotenv").config();
require("./server");

const PREFIX = "!";
const {
  TOKEN,
  CLIENT_ID,
  REDIRECT_URI,
  ROLE_VERIFIED_ID,
  ROLE_UNVERIFIED_ID,
  VERIFY_CHANNEL_ID,
  LOG_CHANNEL_ID,
  STAFF_ROLE_ID,
} = process.env;

if (!TOKEN || !CLIENT_ID || !REDIRECT_URI) {
  console.warn("Verifica TOKEN, CLIENT_ID e REDIRECT_URI no .env.");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function hasPerm(message) {
  return (
    message.guild?.ownerId === message.author.id ||
    (STAFF_ROLE_ID && message.member?.roles.cache.has(STAFF_ROLE_ID))
  );
}

function getRole(guild, roleId, roleName) {
  if (roleId) {
    const byId = guild.roles.cache.get(roleId);
    if (byId) return byId;
  }
  return guild.roles.cache.find((r) => r.name === roleName) || null;
}

function log(guild, content) {
  const channel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (channel) channel.send(content).catch(() => {});
}

async function safeAddRole(member, role) {
  if (!role) return false;
  if (member.roles.cache.has(role.id)) return true;
  await member.roles.add(role);
  return true;
}

async function safeRemoveRole(member, role) {
  if (!role) return false;
  if (!member.roles.cache.has(role.id)) return true;
  await member.roles.remove(role);
  return true;
}

client.once("ready", () => {
  console.log(`✅ Online como ${client.user.tag}`);
});

client.on("guildMemberAdd", async (member) => {
  try {
    const unverifiedRole = getRole(member.guild, ROLE_UNVERIFIED_ID, "Não verificado");
    if (unverifiedRole) {
      await safeAddRole(member, unverifiedRole);
    }
  } catch (err) {
    console.error("Erro no guildMemberAdd:", err);
  }
});

client.on("messageCreate", async (message) => {
  try {
    if (!message.guild || message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const [rawCmd, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = rawCmd.toLowerCase();
    const target = message.mentions.members.first();

    const verifiedRole = getRole(message.guild, ROLE_VERIFIED_ID, "Verificado");
    let unverifiedRole = getRole(message.guild, ROLE_UNVERIFIED_ID, "Não verificado");

    if (cmd === "help") {
      const embed = new EmbedBuilder()
        .setTitle("📖 Comandos")
        .setColor(0x2b6cb0)
        .setDescription(
          [
            "**Verificação**",
            "!painel",
            "",
            "**Staff**",
            "!verify @user",
            "!unverify @user",
            "!toggleverify @user",
            "",
            "**Sistema**",
            "!criarunverified",
            "!lockunverified",
            "!unlockunverified",
            "",
            "**Info**",
            "!help",
          ].join("\n")
        );

      return message.reply({ embeds: [embed] });
    }

    if (cmd === "criarunverified") {
      if (!hasPerm(message)) return message.reply("Sem permissão.");

      let role = message.guild.roles.cache.find((r) => r.name === "Não verificado");
      if (role) {
        return message.reply(`Já existe 👍\nID: ${role.id}`);
      }

      role = await message.guild.roles.create({
        name: "Não verificado",
        color: "Red",
        reason: "Sistema de verificação",
      });

      unverifiedRole = role;
      return message.reply(`Cargo criado 👍\nID: ${role.id}`);
    }

    if (cmd === "painel") {
      if (!hasPerm(message)) return message.reply("Sem permissão.");
      if (!VERIFY_CHANNEL_ID) return message.reply("VERIFY_CHANNEL_ID não configurado.");

      const channel = message.guild.channels.cache.get(VERIFY_CHANNEL_ID);
      if (!channel) return message.reply("Canal de verificação não encontrado.");

      const embed = new EmbedBuilder()
        .setTitle("🔒 Verificação")
        .setDescription("Clique no botão abaixo para se verificar.")
        .setColor(0x2b6cb0);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Verificar")
          .setStyle(ButtonStyle.Link)
          .setURL(
            `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(
              REDIRECT_URI
            )}&scope=identify%20guilds.join`
          )
      );

      await channel.send({ embeds: [embed], components: [row] });
      return message.reply("Painel enviado 👍");
    }

    if (cmd === "verify") {
      if (!hasPerm(message)) return message.reply("Sem permissão.");
      if (!target) return message.reply("Mencione alguém.");

      await safeAddRole(target, verifiedRole);
      await safeRemoveRole(target, unverifiedRole);
      log(message.guild, `✔ ${target.user.tag} verificado`);
      return message.reply("Usuário verificado 👍");
    }

    if (cmd === "unverify") {
      if (!hasPerm(message)) return message.reply("Sem permissão.");
      if (!target) return message.reply("Mencione alguém.");

      await safeAddRole(target, unverifiedRole);
      await safeRemoveRole(target, verifiedRole);
      log(message.guild, `❌ ${target.user.tag} desverificado`);
      return message.reply("Usuário agora é NÃO verificado 👍");
    }

    if (cmd === "toggleverify") {
      if (!hasPerm(message)) return message.reply("Sem permissão.");
      if (!target) return message.reply("Mencione alguém.");

      const isVerified = verifiedRole ? target.roles.cache.has(verifiedRole.id) : false;

      if (isVerified) {
        await safeRemoveRole(target, verifiedRole);
        await safeAddRole(target, unverifiedRole);
        log(message.guild, `❌ ${target.user.tag} desverificado`);
        return message.reply("Agora NÃO verificado");
      } else {
        await safeAddRole(target, verifiedRole);
        await safeRemoveRole(target, unverifiedRole);
        log(message.guild, `✔ ${target.user.tag} verificado`);
        return message.reply("Agora verificado");
      }
    }

    if (cmd === "lockunverified") {
      if (!hasPerm(message)) return message.reply("Sem permissão.");
      if (!unverifiedRole) return message.reply("Cargo Não verificado não encontrado.");

      for (const [, channel] of message.guild.channels.cache) {
        await channel.permissionOverwrites.edit(unverifiedRole, {
          ViewChannel: false,
        }).catch(() => {});
      }

      return message.reply("Não verificados não veem canais 👍");
    }

    if (cmd === "unlockunverified") {
      if (!hasPerm(message)) return message.reply("Sem permissão.");
      if (!unverifiedRole) return message.reply("Cargo Não verificado não encontrado.");

      for (const [, channel] of message.guild.channels.cache) {
        await channel.permissionOverwrites.edit(unverifiedRole, {
          ViewChannel: true,
        }).catch(() => {});
      }

      return message.reply("Liberado para não verificados 👍");
    }
  } catch (err) {
    console.error("Erro no comando:", err);
    try {
      await message.reply("Deu erro no comando.");
    } catch {}
  }
});

process.on("unhandledRejection", (err) => {
  console.error("UnhandledRejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("UncaughtException:", err);
});

client.login(TOKEN);
