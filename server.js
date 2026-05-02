require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();

// 🔐 proteção global contra crash
process.on("uncaughtException", (err) => {
  console.error("🔥 UncaughtException:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🔥 UnhandledRejection:", err);
});

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

const PORT = process.env.PORT || 3000;

// ⚡ axios com timeout (IMPORTANTE)
const api = axios.create({
  timeout: 10000,
});

// 🟢 status
app.get("/", (req, res) => {
  res.status(200).send("OAuth server online");
});

// 🔐 login
app.get("/login", (req, res) => {
  const url = new URL("https://discord.com/oauth2/authorize");

  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "identify guilds.join");

  res.redirect(url.toString());
});

// 🔄 callback
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Código ausente.");

  try {
    const tokenRes = await api.post(
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

    const userRes = await api.get("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const user = userRes.data;

    // entra no server
    await api.put(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}`,
      { access_token: accessToken },
      {
        headers: {
          Authorization: `Bot ${TOKEN}`,
        },
      }
    );

    // verifica
    if (ROLE_VERIFIED_ID) {
      await api.put(
        `https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}/roles/${ROLE_VERIFIED_ID}`,
        {},
        { headers: { Authorization: `Bot ${TOKEN}` } }
      );
    }

    // remove não verificado
    if (ROLE_UNVERIFIED_ID) {
      await api
        .delete(
          `https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}/roles/${ROLE_UNVERIFIED_ID}`,
          { headers: { Authorization: `Bot ${TOKEN}` } }
        )
        .catch(() => {});
    }

return res.status(200).send(`
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Verificado</title>

  <style>
    body {
      margin: 0;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #0f172a, #1e293b);
      font-family: Arial, sans-serif;
      color: white;
    }

    .card {
      background: rgba(255,255,255,0.05);
      padding: 40px;
      border-radius: 16px;
      text-align: center;
      box-shadow: 0 0 20px rgba(0,0,0,0.4);
      backdrop-filter: blur(10px);
      width: 320px;
      animation: fadeIn 0.6s ease-out;
    }

    /* CHECK ANIMADO */
    .check {
      font-size: 70px;
      color: #22c55e;
      opacity: 0;
      transform: scale(0.3) rotate(-20deg);
      animation: popCheck 0.7s ease forwards;
      animation-delay: 0.2s;
    }

    h1 {
      margin: 10px 0;
      font-size: 22px;
      opacity: 0;
      animation: fadeInUp 0.6s ease forwards;
      animation-delay: 0.6s;
    }

    p {
      opacity: 0;
      font-size: 14px;
      animation: fadeInUp 0.6s ease forwards;
      animation-delay: 0.8s;
    }

    .btn {
      margin-top: 20px;
      display: inline-block;
      padding: 10px 20px;
      background: #2563eb;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      opacity: 0;
      animation: fadeInUp 0.6s ease forwards;
      animation-delay: 1s;
      transition: 0.2s;
    }

    .btn:hover {
      background: #1d4ed8;
      transform: scale(1.05);
    }

    /* ANIMAÇÕES */
    @keyframes popCheck {
      0% {
        opacity: 0;
        transform: scale(0.2) rotate(-30deg);
      }
      70% {
        transform: scale(1.2) rotate(10deg);
      }
      100% {
        opacity: 1;
        transform: scale(1) rotate(0deg);
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(15px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>

<body>
  <div class="card">
    <div class="check">✔</div>

    <h1>Verificado com sucesso</h1>
    <p>Você já pode voltar para o Discord.</p>

    <a class="btn" href="https://discord.com/channels/@me">
      Abrir Discord
    </a>
  </div>
</body>
</html>
`);

  } catch (err) {
    console.error("❌ OAuth error:", err.response?.data || err.message);

    return res.status(500).send(`
      <html>
        <body style="font-family: Arial; text-align:center; padding:40px;">
          <h1>Erro na verificação</h1>
          <p>Tente novamente ou contate suporte.</p>
        </body>
      </html>
    `);
  }
});

// 🚀 start
app.listen(PORT, () => {
  console.log(`🚀 OAuth rodando na porta ${PORT}`);
});
