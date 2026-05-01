require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();

const {
  TOKEN,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  GUILD_ID,
  ROLE_VERIFIED_ID,
  ROLE_UNVERIFIED_ID,
  PORT = 3000,
} = process.env;

const required = {
  TOKEN,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  GUILD_ID,
};

for (const [key, value] of Object.entries(required)) {
  if (!value) console.warn(`Falta configurar ${key} no .env`);
}

app.get("/", (req, res) => {
  res.status(200).send("OAuth server online");
});

app.get("/login", (req, res) => {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "identify guilds.join");
  res.redirect(url.toString());
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Código ausente.");

  try {
    const tokenRes = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: REDIRECT_URI,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenRes.data.access_token;

    const userRes = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const user = userRes.data;

    await axios.put(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}`,
      { access_token: accessToken },
      { headers: { Authorization: `Bot ${TOKEN}` } }
    );

    if (ROLE_VERIFIED_ID) {
      await axios.put(
        `https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}/roles/${ROLE_VERIFIED_ID}`,
        {},
        { headers: { Authorization: `Bot ${TOKEN}` } }
      );
    }

    if (ROLE_UNVERIFIED_ID) {
      await axios.delete(
        `https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}/roles/${ROLE_UNVERIFIED_ID}`,
        { headers: { Authorization: `Bot ${TOKEN}` } }
      ).catch(() => {});
    }

    return res.status(200).send(`
      <html>
        <head><meta charset="utf-8"><title>Verificado</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1>✔ Verificado com sucesso</h1>
          <p>Você já pode voltar para o Discord.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Erro na verificação:", err.response?.data || err.message || err);
    return res.status(500).send(`
      <html>
        <head><meta charset="utf-8"><title>Erro</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1>Erro na verificação</h1>
          <p>Confira redirect URI, CLIENT_SECRET, GUILD_ID e permissões do bot.</p>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`OAuth rodando na porta ${PORT}`);
});
