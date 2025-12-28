import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import P from "pino";
import qrcode from "qrcode-terminal";
import { handleKickCommand } from "./core/command.js";
import { initGroupCache, setupGroupListeners } from "./core/grouprequired.js";
import menuText from "./handlers/menu.js";
const menu = menuText;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const sock = makeWASocket({
        logger: P({
            level: "silent",
        }),
        auth: state,
        generateHighQualityLinkPreview: false,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("scan here!");
            qrcode.generate(qr, {
                small: true,
            });
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
            console.log("ISI OBJEK MESSAGE : ");
            console.dir(msg, { depth: null, colors: true });
            console.log("sender adalah TEST TEST : ", senderId);
            console.log("DATA NOMOR BOT");
            console.dir(sock.user, {
                depth: null,
                colors: true,
            });
            const from = msg.key.remoteJid;
            const rawText = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";
            const [command, ...args] = rawText.split(" ");

            switch (command) {
                case ".menu":
                    sock.sendMessage(
                        from,
                        {
                            text: menu,
                        },
                        { quoted: msg }
                    );
                    break;
                case ".ping":
                    const start = Date.now();
                    const latencySec = ((Date.now() - start) / 1000).toFixed(3);

                    sock.sendMessage(
                        from,
                        {
                            text: "_Response_ : `" + latencySec + "s`",
                        },
                        { quoted: msg }
                    );
                    break;

                case ".kick":
                    let targetId;
                    // mention
                    targetId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

                    // reply
                    if (!targetId) targetId = msg.message?.extendedTextMessage?.contextInfo?.participant;

                    //phone number
                    if (!targetId) {
                        const argsText = rawText.split(" ").slice(1).join("");
                        const cleaned = argsText.replace(/[^0-9]/g, "");
                        if (cleaned) targetId = cleaned + "@s.whatsapp.net";
                    }

                    // information
                    if (!targetId)
                        return sock.sendMessage(
                            from,
                            {
                                text: "Reply/mention/nomor target dulu!",
                            },
                            { quoted: msg }
                        );

                    console.log("TARGET ID : ", targetId);
                    const ok = await handleKickCommand(sock, from, senderId, targetId, msg);
                    if (!ok) return;

                    sock.groupParticipantsUpdate(from, [targetId], "remove").catch((err) => {
                        sock.sendMessage(
                            from,
                            {
                                text: `Gagal kick: ${err.message}`,
                            },
                            { quoted: msg }
                        );
                    });
            }
        }
    });
}

startBot();

// JOIN DAN LEAVE PADA BOT BELUM REALTIME!!!
