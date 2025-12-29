export const groupCache = new Map();

export async function initGroupCache(sock) {
     try {
          const groups = await sock.groupFetchAllParticipating();
          // console.log("GROUPS ===========");
          // console.dir(groups, { depth: null, colors: true });
          // console.log("==============");

          for (const id in groups) {
               const meta = groups[id];
               const participants = meta.participants || [];
               const admins = new Set(participants.filter((p) => p.admin).map((p) => p.id));
               // console.log("ISI ADMINDS : ");
               // console.dir(admins, { depth: null, colors: true });
               // console.log("==============");
               const botId = sock.user.lid;
               const botAdmins = botId.split(":")[0] + botId.slice(botId.indexOf("@"));
               // console.log("BOT ADMIN", botAdmins);
               groupCache.set(id, { admins, botJoined: true });
          }
          console.log("✅ Semua data grup siap. Total grup:", groupCache.size);
     } catch (err) {
          console.error("Gagal inisialisasi group cache:", err);
     }
}

export function groupUpate(sock) {
     sock.ev.on("group-participants.update", (update) => {
          const botId = sock.user.lid;
          const botAdmin = botId.split(":")[0] + botId.slice(botId.indexOf("@"));
          // console.log("Update event:", update);
          const id = update.id;
          // console.log("Bot ID:", sock.user.id);
          // console.log("Bot LID:", sock.user.lid);

          update.participants.forEach((p) => {
               // console.log("ISI participants : ", p);
               // console.log("ISI ID participants : ", p.id);
               if (p.id === botAdmin) {
                    if (update.action === "remove") {
                         // console.log("Bot leaving group:", id);
                         groupCache.delete(id);
                    }
               }

               const current = groupCache.get(id);
               if (!current) return;

               if (update.action === "promote") {
                    current.admins.add(p.id);
                    // console.log("After promote, admins are:", current.admins);
               }
               if (update.action === "demote") {
                    current.admins.delete(p.id);
                    // console.log("After demote, admins are:", current.admins);
               }
          });
          // console.log("GROUP CACHE UPDATE (final state):", groupCache);
     });
}

export function newGroup(sock) {
     sock.ev.on("groups.upsert", (groups) => {
          groups.forEach((meta) => {
               const id = meta.id;

               if (!groupCache.has(id)) {
                    const admins = new Set(meta.participants.filter((p) => p.admin).map((p) => p.id));

                    groupCache.set(id, {
                         admins,
                         botJoined: true,
                    });

                    // console.log(`Bot baru join grup: ${meta.subject}`);
                    // console.log("Daftar admin:", Array.from(admins));
               }
          });

          // console.log("GROUP CACHE UPDATE (final state):", groupCache);
     });
}
