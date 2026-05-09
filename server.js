require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();

// 🔧 CONFIG
const {
  TOKEN,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  GUILD_ID,
  ROLE_VERIFIED_ID,
  ROLE_UNVERIFIED_ID,
} = process.env;

// ⚠️ PORT correto pro Render
const PORT = process.env.PORT || 3000;

// 🧠 checagem básica
const required = {
  TOKEN,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  GUILD_ID,
};

for (const [key, value] of Object.entries(required)) {
  if (!value) console.warn(`⚠️ Falta configurar ${key} no .env`);
}

// 🔒 memória simples pra evitar reuse do code
const usedCodes = new Set();

// 🟢 status
app.get("/", (req, res) => {
  res.status(200).send("OAuth server online");
});

// 🔐 login manual
app.get("/login", (req, res) => {
  const url = new URL("https://discord.com/oauth2/authorize");

  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "identify guilds.join");

  res.redirect(url.toString());
});

// 🔄 callback OAuth
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Código ausente.");

  // 🚫 bloqueia reuse do code
  if (usedCodes.has(code)) {
    return res.status(400).send("Código OAuth já utilizado.");
  }
  usedCodes.add(code);

  try {
    // 🔑 troca code por token
    const tokenRes = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // 👤 pega info do usuário
    const userRes = await axios.get(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const user = userRes.data;

    // ➕ adiciona no servidor
    await axios.put(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}`,
      { access_token: accessToken },
      {
        headers: {
          Authorization: `Bot ${TOKEN}`,
        },
      }
    );

    // ⏳ pequeno delay pra evitar burst
    await new Promise(r => setTimeout(r, 500));

    // ✔ cargo verificado
    if (ROLE_VERIFIED_ID) {
      await axios.put(
        `https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}/roles/${ROLE_VERIFIED_ID}`,
        {},
        {
          headers: {
            Authorization: `Bot ${TOKEN}`,
          },
        }
      );
    }

    // ❌ remove não verificado
    if (ROLE_UNVERIFIED_ID) {
      await axios.delete(
        `https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}/roles/${ROLE_UNVERIFIED_ID}`,
        {
          headers: {
            Authorization: `Bot ${TOKEN}`,
          },
        }
      ).catch(() => {});
    }

    // 🎉 sucesso
    return res.status(200).send(`
      <html>
        <head><meta charset="utf-8"><title>Verificado</title></head>
        <body style="font-family: Arial; text-align:center; padding:40px;">
          <h1>✔ Verificado com sucesso</h1>
          <p>Pode voltar pro Discord agora.</p>
        </body>
      </html>
    `);

  } catch (err) {
    // ⛔ rate limit
    if (err.response?.status === 429) {
      return res.status(429).send(`
        <html>
          <head><meta charset="utf-8"><title>Calma aí</title></head>
          <body style="font-family: Arial; text-align:center; padding:40px;">
            <h1>Muitos acessos</h1>
            <p>Espere alguns segundos e tente novamente.</p>
          </body>
        </html>
      `);
    }

    console.error("Erro OAuth:", err.response?.data || err.message || err);

    return res.status(500).send(`
      <html>
        <head><meta charset="utf-8"><title>Erro</title></head>
        <body style="font-family: Arial; text-align:center; padding:40px;">
          <h1>Erro na verificação</h1>
          <p>Tente novamente em alguns segundos.</p>
        </body>
      </html>
    `);
  }
});

// 🚀 start
app.listen(PORT, () => {
  console.log(`🚀 OAuth rodando na porta ${PORT}`);
});
