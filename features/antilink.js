import { isUserAdmin } from "../lib/guard.js";
export function handleAntilink(from, senderId) {
     return !isUserAdmin(from, senderId);
}
