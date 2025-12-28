export const groupCache = new Map();

export async function initGroupCache(sock) {
    const groups = await sock.groupFetchAllParticipating();
    console.log("GROUPS ===========");
    console.dir(groups, { depth: null, colors: true });
    console.log("==============");

    for (const id in groups) {
        const meta = groups[id];
        const participants = meta.participants || [];
        const admins = new Set(participants.filter((p) => p.admin).map((p) => p.id));
        console.log("ISI ADMINDS : ");
        console.dir(admins, { depth: null, colors: true });
        console.log("==============");
        const botId = sock.user.lid;
        const botAdmins = botId.split(":")[0] + botId.slice(botId.indexOf("@"));
        console.log("BOT ADMIN", botAdmins);
        groupCache.set(id, { admins, botJoined: true });

        console.log("ADMIN ADALAH : ", admins);
    }
}

// export function setupGroupListeners(sock) {}
