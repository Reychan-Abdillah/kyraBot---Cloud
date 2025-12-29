import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import P from "pino";
import qrcode from "qrcode-terminal";
import { handleAntilink } from "./features/antilink.js";
import { addWarning, antilinkWarnings, resetWarnings } from "./features/antilinkWarn.js";
import { handleKick } from "./features/kick.js";
import { groupUpate, initGroupCache, newGroup } from "./lib/groupCache.js";
import { menuText } from "./lib/message.js";
const menu = menuText;
const antilinkWarningsMap = antilinkWarnings;

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
            newGroup(sock);
            groupUpate(sock);
            // console.log("GROUP CACHE AWAL", groupCache);
            console.log("bot is connected");
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const linkRegex = /(https?:\/\/|www\.|wa\.me\/|chat\.whatsapp\.com\/)/i;
        const validMessages = m.messages.filter((msg) => {
            if (!msg.message) return false;
            const rawText = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";
            return rawText.startsWith(".") || linkRegex.test(rawText);
        });
        if (validMessages.length === 0) return;

        for (const msg of validMessages) {
            // console.log("Pesan diterima:", msg);
            const senderId = msg.key.participant || msg.key.remoteJid;
            const from = msg.key.remoteJid;
            const rawText = msg.message.conversation || msg.message?.extendedTextMessage?.text || "";
            const [command, ...args] = rawText.split(" ");

            const antilinkDel = false; // Aktifkan delete
            const antilinkKick = false; // Aktifkan kick
            const antilinkWarn = true; // Aktifkan warn

            if (linkRegex.test(rawText) && from.endsWith("@g.us")) {
                const shouldAct = handleAntilink(from, senderId, sock);
                if (!shouldAct) continue;

                if (antilinkKick) {
                    sock.sendMessage(from, { delete: msg.key }).catch(console.log);
                    sock.groupParticipantsUpdate(from, [senderId], "remove").catch(console.log);
                } else if (antilinkWarn) {
                    try {
                        // Hapus pesan
                        if (antilinkDel) {
                            sock.sendMessage(from, { delete: msg.key });
                        }

                        // Tambah warning
                        const warningCount = addWarning(senderId);

                        // Jika sudah 3 warning, kick user
                        if (warningCount >= 3) {
                            sock.sendMessage(from, { delete: msg.key }).catch(console.log);
                            sock.sendMessage(from, {
                                text:
                                    `⚠️ *Link Terdeteksi*\n\n` +
                                    `@${
                                        senderId.split("@")[0]
                                    } telah mencapai batas peringatan (${warningCount}/3)\n\n` +
                                    `❌ Maaf, Anda akan dikeluarkan dari grup.`,
                                mentions: [senderId],
                            });

                            // Kick user
                            sock.groupParticipantsUpdate(from, [senderId], "remove");

                            // Reset warning setelah kick
                            resetWarnings(senderId);
                        } else {
                            // Kirim peringatan (masih ada kesempatan)
                            const remaining = 3 - warningCount;
                            sock.sendMessage(from, { delete: msg.key }).catch(console.log);
                            sock.sendMessage(from, {
                                text:
                                    `⚠️ *Link Terdeteksi*\n\n` +
                                    `@${senderId.split("@")[0]} mendapat peringatan!\n\n` +
                                    `📊 Peringatan: ${warningCount}/3\n` +
                                    `🔄 Sisa kesempatan: ${remaining}x`,
                                mentions: [senderId],
                            });
                        }
                    } catch (error) {
                        console.error("Error antilink warn:", error);
                    }
                } else if (antilinkDel) {
                    sock.sendMessage(from, { delete: msg.key }).catch(console.log);
                }
                continue;
            }

            switch (command) {
                case ".menu":
                    sock.sendMessage(from, { text: menu }, { quoted: msg });
                    break;
                case ".ping":
                    const start = Date.now();
                    const latencySec = ((Date.now() - start) / 1000).toFixed(3);
                    sock.sendMessage(from, { text: "_Response_ : `" + latencySec + "s`" }, { quoted: msg });
                    break;
                case ".kick":
                    let targetId;
                    // mention
                    targetId = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                    // reply
                    if (!targetId) targetId = msg.message?.extendedTextMessage?.contextInfo?.participant;
                    // phone number
                    if (!targetId) {
                        const argsText = rawText.split(" ").slice(1).join("");
                        const cleaned = argsText.replace(/[^0-9]/g, "");
                        if (cleaned) targetId = cleaned + "@s.whatsapp.net";
                    }
                    // information
                    if (!targetId) {
                        sock.sendMessage(from, { text: "Reply/mention/nomor target dulu!" }, { quoted: msg });
                        continue;
                    }

                    const ok = handleKick(sock, from, senderId, targetId, msg);
                    if (!ok) continue;

                    sock.groupParticipantsUpdate(from, [targetId], "remove").catch((err) => {
                        sock.sendMessage(from, { text: `Gagal kick: ${err.message}` }, { quoted: msg });
                    });
                    break;
            }
        }
    });
}

startBot();
