import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import P from "pino";
import qrcode from "qrcode-terminal";
import { handleKickCommand } from "./core/command.js";
import { initGroupCache, groupCache } from "./core/grouprequired.js";
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
            console.log("GROUP CACHE AWAL", groupCache);
            console.log("bot is connected");
        }
    });

    sock.ev.on("group-participants.update", (update) => {
        const botId = sock.user.lid;
        const botAdmin = botId.split(":")[0] + botId.slice(botId.indexOf("@"));
        console.log("Update event:", update);
        const id = update.id;
        console.log("Bot ID:", sock.user.id);
        console.log("Bot LID:", sock.user.lid);

        update.participants.forEach((p) => {
            console.log("ISI participants : ", p);
            console.log("ISI ID participants : ", p.id);
            if (p.id === botAdmin) {
                console.log("Bot detected in update for action:", update.action);
                if (update.action === "add") {
                    console.log("Bot joining group:", id);
                    groupCache.set(id, { admins: new Set(), botJoined: true });
                } else if (update.action === "remove") {
                    console.log("Bot leaving group:", id);
                    groupCache.delete(id);
                }
            }

            const current = groupCache.get(id);
            if (!current) return;

            if (update.action === "promote") {
                current.admins.add(p.id);
                console.log("After promote, admins are:", current.admins);
            }
            if (update.action === "demote") {
                current.admins.delete(p.id);
                console.log("After demote, admins are:", current.admins);
            }
        });
        console.log("GROUP CACHE UPDATE (final state):", groupCache);
    });

    sock.ev.on("groups.upsert", (groups) => {
        groups.forEach((meta) => {
            const id = meta.id;

            // Jika grup belum ada di cache, berarti baru
            if (!groupCache.has(id)) {
                // Ambil daftar admin dari metadata peserta
                const admins = new Set(meta.participants.filter((p) => p.admin).map((p) => p.id));

                // Tambahkan ke cache
                groupCache.set(id, {
                    admins,
                    botJoined: true, // tandai bot sudah join grup
                });

                console.log(`Bot baru join grup: ${meta.subject}`);
                console.log("Daftar admin:", Array.from(admins));
            }
        });

        // Bisa log state cache terakhir
        console.log("GROUP CACHE UPDATE (final state):", groupCache);
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

                    console.log("Sebelum handleKickCommand - targetId:", targetId);
                    const ok = await handleKickCommand(sock, from, senderId, targetId, msg);
                    console.log("handleKickCommand result (ok):", ok);

                    if (!ok) {
                        console.log("Kick dibatalkan karena handleKickCommand false");
                        return;
                    }

                    console.log("Memanggil groupParticipantsUpdate dengan targetId:", targetId);

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
