import { MSG } from "../lib/message.js";
import { isUserAdmin, isBotAdmin, isTargetAdmin } from "../lib/guard.js";

export function handleKick(sock, from, senderId, targetId, msg) {
     // console.log({
     //     senderId,
     //     targetId,
     //     isUserAdmin: isUserAdmin(from, senderId),
     //     isBotAdmin: isBotAdmin(from, sock),
     //     isTargetAdmin: isTargetAdmin(from, targetId),
     // });
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
               sock.sendMessage(from, { text: MSG.BOT_ADMIN }, { quoted: msg });
               return false;
          }

          // if target is admin, proceed
          if (isTargetAdmin(from, targetId)) {
               sock.sendMessage(from, { text: MSG.CANNOT_KICK_ADMIN }, { quoted: msg });
               return false;
          }

          // all checks passed
          return true;
     } catch (err) {
          console.error(err);
          sock.sendMessage(from, { text: `Error_message ${err}` }, { quoted: msg });
          return false;
     }
}
