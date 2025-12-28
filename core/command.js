import { groupCache } from "./grouprequired.js";
import { MSG } from "./message.js";

function isUserAdmin(from, userId) {
    return groupCache.get(from)?.admins.has(userId);
}

function isBotAdmin(from, sock) {
    const meta = groupCache.get(from);
    if (!meta) return false;

    const botLid = sock.user.lid.split(":")[0] + sock.user.lid.slice(sock.user.lid.indexOf("@")) || false;
    return meta.admins.has(botLid);
}

function isTargetAdmin(from, targetId) {
    return groupCache.get(from)?.admins.has(targetId) || false;
}

export async function handleKickCommand(sock, from, senderId, targetId, msg) {
    console.log({
        senderId,
        targetId,
        isUserAdmin: isUserAdmin(from, senderId),
        isBotAdmin: isBotAdmin(from, sock),
        isTargetAdmin: isTargetAdmin(from, targetId),
    });
    try {
        // only group
        if (!from.endsWith("@g.us")) {
            sock.sendMessage(from, { text: MSG.GROUP_ONLY }, { quoted: msg });
            return false;
        }

        // admin only
        if (!isUserAdmin(from, senderId)) {
            sock.sendMessage(from, { text: MSG.ADMIN_ONLY }, { quoted: msg });
            return false;
        }
        // bot admin only
        if (!isBotAdmin(from, sock)) {
            await sock.sendMessage(from, { text: MSG.BOT_ADMIN }, { quoted: msg });
            return false;
        }

        // if target is admin, proceed
        if (isTargetAdmin(from, targetId)) {
            sock.sendMessage(from, { text: MSG.CANNOT_KICK_ADMIN }, { quoted: msg });
            return false;
        }
    } catch (err) {
        console.error(err);
        sock.sendMessage(from, { text: `Error_message ${err}` }, { quoted: msg });
        return false;
    }
}
