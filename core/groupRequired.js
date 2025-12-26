// groupCache.js
export const groupRequired = new Map();

/**
 * Normalisasi JID WhatsApp
 * - Hilangkan ":xx" di belakang
 * - Ganti @lid menjadi @s.whatsapp.net
 */
export function normalizeJid(jid) {
  if (!jid) return jid;
  const [local, domain] = jid.split("@");
  const cleanLocal = local.split(":")[0]; // hapus :xx
  return cleanLocal + "@" + domain;
}

/**
 * Inisialisasi cache grup
 * @param {import('@whiskeysockets/baileys').AnyWASocket} sock
 */
export async function initGroupCache(sock) {
  const groups = await sock.groupFetchAllParticipating();

  for (const id in groups) {
    const meta = groups[id];

    // ambil semua peserta admin dan normalisasi JID
    const admins = new Set(
      meta.participants
        .filter((p) => p.admin) // cuma admin
        .map((p) => normalizeJid(p.id))
    );

    // cek botAdmin
    const botAdmin = admins.has(normalizeJid(sock.user.id));

    // simpan ke Map
    groupRequired.set(id, { admins, botAdmin });

    // Debug output
    console.log(`\n[Group] ${meta.subject} (${id})`);
    console.log("Admins:", Array.from(admins));
    console.log("Bot admin:", botAdmin);
    console.log("nomor Bot", normalizeJid(sock.user.id))
  }
}

/**
 * Optional: helper untuk nge-print cache (debug)
 */
export function printGroupCache() {
  console.log("\n===== Group Cache =====");
  for (const [id, data] of groupRequired.entries()) {
    console.log(`Group: ${id}`);
    console.log("Admins:", Array.from(data.admins));
    console.log("Bot admin:", data.botAdmin);
    console.log("------------------------");
  }
}

