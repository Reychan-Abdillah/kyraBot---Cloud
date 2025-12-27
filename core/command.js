import { MSG } from "./message.js";
import { groupCache } from "./grouprequired.js";

function isUserAdmin(groupId, userId) {
  return groupCache.get(groupId)?.admins.has(userId) || false;
} 

export  async function handleKickCommand(
  sock,
  from,
  senderId,
  msg
) {
  try {
    // only group
    if (!from.endsWith("@g.us")) {
     sock.sendMessage(from, { text: MSG.GROUP_ONLY, quoted: msg });
     return false
    }

    // admin only
    if (!isUserAdmin(from, senderId)) {
      sock.sendMessage(from, { text: MSG.ADMIN_ONLY, quoted: msg });
      return false;
    }

    return true

  } catch (err) {
    console.error(err);
    sock.sendMessage(from, { text: `Error_message ${err}`, quoted: msg });
    return false
  }
}
