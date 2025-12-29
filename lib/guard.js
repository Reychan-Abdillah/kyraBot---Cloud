import { groupCache } from "./groupCache.js";

export function isUserAdmin(from, senderId) {
     return groupCache.get(from)?.admins.has(senderId);
}

export function isBotAdmin(from, sock) {
     const meta = groupCache.get(from);
     if (!meta) return false;

     const botLid = sock.user.lid.split(":")[0] + sock.user.lid.slice(sock.user.lid.indexOf("@")) || false;
     return meta.admins.has(botLid);
}

export function isTargetAdmin(from, targetId) {
     return groupCache.get(from)?.admins.has(targetId) || false;
}
