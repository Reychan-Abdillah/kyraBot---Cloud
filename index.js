import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import P from "pino";
import qrcode from "qrcode-terminal";
import menuText from "./handlers/menu.js";
import {
  initGroupCache,
  setupGroupListeners,
  groupCache,
} from "./core/grouprequired.js";
import { handleKickCommand } from "./core/command.js";
const menu = menuText;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const sock = makeWASocket({
    logger: P({ level: "silent" }),
    auth: state,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("scan here!");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("❌ Logged out. Stop bot.");
        return;
      }

      if (statusCode === 401 || statusCode === 403 || statusCode === 405) {
        console.log("🚨 Session bermasalah / kemungkinan diblok. STOP.");
        return;
      }

      console.log("🔁 Reconnecting...");
      setTimeout(startBot, 15000);
    }
    if (connection === "open") {
      await initGroupCache(sock);
      setupGroupListeners(sock);
      console.log("bot is connected");
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    for (const msg of m.messages) {
      if (!msg.message) continue;
      const senderId = msg.key.participant || msg.key.remoteJid;
      console.log("sender adalah TEST TEST : ", senderId)
      console.log('DATA NOMOR BOT')
      console.dir(sock.user, { depth: null, colors: true });
      const from = msg.key.remoteJid;
      const rawText =
        msg.message.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";
      const [command, ...args] = rawText.split(" ");
      switch (command) {
        case ".menu":
          sock.sendMessage(from, {
            text: menu,
            quoted: msg,
          });
          break;
        case ".ping":
          const start = Date.now();
          const latencySec = ((Date.now() - start) / 1000).toFixed(3);

          sock.sendMessage(from, {
            text: "_Response_ : `" + latencySec + "s`",
            quoted: msg,
          });
          break;

        case ".kick":
          const valid = await handleKickCommand(sock, from, senderId, msg);
          if (!valid) return;
          let target;
          // mention
          target =
            msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

          // reply
          if (!target)
            target = msg.message?.extendedTextMessage?.contextInfo?.participant;

          //phone number
          if (!target) {
            const argsText = rawText.split(" ").slice(1).join(""); // gabungkan semua argumen setelah .kick
            const cleaned = argsText.replace(/[^0-9]/g, "");
            if (cleaned) target = cleaned + "@s.whatsapp.net";
          }

          // information
          if (!target)
            return sock.sendMessage(from, {
              text: "Reply/mention/nomor target dulu!",
            });

          sock
            .groupParticipantsUpdate(from, [target], "remove")
            .catch((err) => {
              sock.sendMessage(from, {
                text: `Gagal kick: ${err.message}`,
              });
            });
      }
    }
  });
}

startBot();
