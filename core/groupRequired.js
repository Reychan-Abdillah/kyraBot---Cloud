export const groupCache = new Map();

export async function initGroupCache(sock) {
  const groups = await sock.groupFetchAllParticipating();
console.log("GROUPS ===========");
console.dir(groups, { depth: null, colors: true });
console.log("==============");

  for (const id in groups) {
    const meta = groups[id];
    const participants = meta.participants || [];
    const admins = new Set(
      participants.filter((p) => p.admin).map((p) => p.id)
    );
    const botId = sock.user.lid
    const botAdmins = botId.split(":")[0] + botId.slice(botId.indexOf("@"));
    console.log("BOT ADMIN", botAdmins)
    groupCache.set(id, { admins, botJoined: true});

    console.log("ADMIN ADALAH : ", admins)
  }
}

export function setupGroupListeners(sock) {
  sock.ev.on("group-participants.update", (update) => {
     console.log("Update event:", update);
    const id = update.id;

    update.participants.forEach((p) => {
      if (p.id === sock.user.id) {
        if (update.action === "add") {
          groupCache.set(id, { admins: new Set(), botJoined: true });
        } else if (update.action === "remove") {
          groupCache.delete(id);
        }
      }

      const current = groupCache.get(id);
      if (!current) return;

      if (update.action === "promote") current.admins.add(p.id);
      if (update.action === "demote") current.admins.delete(p.id);
    });
  });
}

export function isUserAdmin(groupId, userId) {
  return groupCache.get(groupId)?.admins.has(userId) || false;
}
