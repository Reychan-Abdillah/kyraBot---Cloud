import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import P from "pino";
import qrcode from "qrcode-terminal";
import menuText from "./handlers/menu.js";

const menu = menuText;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const sock = makeWASocket({
    logger: P({ level: "silent" }),
    auth: state,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
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

      if (connection === "open") {
        console.log("✅ Bot connected");
      }
    }
    if (connection === "open") {
      console.log("bot is connected");
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    for (const msg of m.messages) {
      if (!msg.message) continue;
      const text =
        msg.message.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";
      const sender = msg.pushName || "user";
      const from = msg.key.remoteJid;
      if (text === ".menu") {
        sock.sendMessage(from, {
          text: menu,
          quoted: msg,
        });
      }

      if (text === ".ping") {
        const start = Date.now();
        const latencySec = ((Date.now() - start) / 1000).toFixed(3);

        sock.sendMessage(from, {
          text: "_Response_ : `" + latencySec + "s`",
          quoted: msg,
        });
      }

      if (text.startsWith(".kick")) {
        let target;
        // mention
        target =  
          msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

        // reply
        if (!target)
          target = msg.message?.extendedTextMessage?.contextInfo?.participant;

        //phone number
        if (!target) {
          const cleaned = text.split(" ")[1]?.replace(/[^0-9]/g, "");
          if (cleaned) target = cleaned + "@s.whatsapp.net";
        }

        // information
        if (!target)
          return sock.sendMessage(from, {
            text: "Reply/mention/nomor target dulu!",
          });

        sock.groupParticipantsUpdate(from, [target], "remove").catch((err) => {
          sock.sendMessage(from, {
            text: `Gagal kick: ${err.message}`,
          });
        });
      }
    }
  });
}

startBot();

// ⚡ Optimasi tambahan biasanya cuma bisa lewat:

// Server / koneksi internet lebih cepat → latency WA ke server tidak bisa dikurangi di kode

// Cluster / multiple bot → kalau bot menangani grup sangat banyak → skala horizontal

// Batasi pesan masuk per tick → tapi lo udah pakai messages[0] → optimal
