function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

function loadJSONV6(key, fallback) {
  try { return JSON.parse(storageGet(key) || "null") ?? fallback; } catch { return fallback; }
}
