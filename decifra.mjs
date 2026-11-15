// Decifra data.enc nel browser (e nei test Node): PBKDF2-SHA256 310.000 iterazioni + AES-GCM 256.
const ITERAZIONI = 310000;
const da64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function chiave(password, sale, uso) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: sale, iterations: ITERAZIONI, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, [uso]);
}

export async function decifra(pacchetto, password) {
  if (!pacchetto || pacchetto.v !== 1) throw new Error("formato non riconosciuto");
  const k = await chiave(password, da64(pacchetto.sale), "decrypt");
  const chiaro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: da64(pacchetto.iv) }, k, da64(pacchetto.dati));
  return new TextDecoder().decode(chiaro);
}
