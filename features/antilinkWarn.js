import fs from "fs/promises";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "antilink-warnings.json");

// Map untuk akses cepat di memory
export const antilinkWarnings = new Map();

let saveTimeout = null;
let isSaving = false;
let isLoaded = false;

// Load data saat bot start (hanya sekali)
async function loadWarnings() {
    if (isLoaded) return;

    try {
        // Pastikan folder data exists
        await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });

        const data = await fs.readFile(DATA_FILE, "utf-8");
        const entries = JSON.parse(data);

        entries.forEach(([key, value]) => {
            antilinkWarnings.set(key, value);
        });

        isLoaded = true;
        console.log(`✅ Loaded ${antilinkWarnings.size} warning records`);
    } catch (error) {
        if (error.code === "ENOENT") {
            // File belum ada, buat baru
            console.log("📝 Creating new warnings database...");
            await saveWarningsNow();
            isLoaded = true;
        } else {
            console.error("❌ Error loading warnings:", error);
        }
    }
}

// Simpan dengan debounce (tunggu 5 detik setelah perubahan terakhir)
function scheduleSave() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
        await saveWarningsNow();
    }, 5000);
}

// Fungsi internal untuk save
async function saveWarningsNow() {
    if (isSaving) return;

    isSaving = true;
    try {
        const data = JSON.stringify([...antilinkWarnings], null, 2);
        await fs.writeFile(DATA_FILE, data, "utf-8");
        // console.log('💾 Warnings saved');
    } catch (error) {
        console.error("❌ Error saving warnings:", error);
    } finally {
        isSaving = false;
    }
}

// Force save (untuk shutdown atau manual save)
export async function forceSave() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }

    await saveWarningsNow();
    console.log("💾 Warnings force saved");
}

// ========== OPERASI UTAMA (SUPER CEPAT) ==========

/**
 * Tambah warning untuk user
 * @param {string} senderId - ID user (format: phone@s.whatsapp.net)
 * @returns {number} Total warning count
 */
export function addWarning(senderId) {
    const current = antilinkWarnings.get(senderId) || 0;
    const next = current + 1;
    antilinkWarnings.set(senderId, next);
    scheduleSave(); // Save async, tidak blocking
    return next;
}

/**
 * Get warning count user
 * @param {string} senderId - ID user
 * @returns {number} Warning count
 */
export function getWarnings(senderId) {
    return antilinkWarnings.get(senderId) || 0;
}

/**
 * Reset warning user (setelah kick atau manual)
 * @param {string} senderId - ID user
 */
export function resetWarnings(senderId) {
    antilinkWarnings.delete(senderId);
    scheduleSave();
}

/**
 * Reset semua warnings (untuk admin)
 */
export function resetAllWarnings() {
    antilinkWarnings.clear();
    scheduleSave();
}

/**
 * Get semua user yang punya warning
 * @returns {Array} Array of {senderId, count}
 */
export function getAllWarnings() {
    return Array.from(antilinkWarnings.entries()).map(([senderId, count]) => ({
        senderId,
        count,
    }));
}

/**
 * Get total users dengan warning
 * @returns {number}
 */
export function getTotalUsers() {
    return antilinkWarnings.size;
}

// ========== INITIALIZATION & CLEANUP ==========

// Load data saat modul di-import
await loadWarnings();

// Graceful shutdown handlers
process.on("SIGINT", async () => {
    console.log("\n🛑 Bot stopping... Saving data...");
    await forceSave();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log("\n🛑 Bot terminating... Saving data...");
    await forceSave();
    process.exit(0);
});

// Auto-save setiap 5 menit (backup)
setInterval(async () => {
    if (antilinkWarnings.size > 0) {
        await saveWarningsNow();
    }
}, 5 * 60 * 1000);

export default {
    addWarning,
    getWarnings,
    resetWarnings,
    resetAllWarnings,
    getAllWarnings,
    getTotalUsers,
    forceSave,
};
