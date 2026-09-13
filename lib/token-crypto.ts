/**
 * Encrypt and decrypt secrets we have to STORE and later SEND BACK — third-party
 * OAuth tokens, starting with Square's (Square integration, step 1).
 *
 * ── Why encrypt, when the till keys are hashed? ─────────────────────────────
 * A till key (lib/pos-orders.ts) is only ever COMPARED, so we keep a one-way hash
 * and can never reproduce it. A Square token is different: we must present it to
 * Square on every request, so we need it back. Encryption is the strongest thing
 * that still allows that. A leaked database or backup is useless without the key,
 * and the key lives only in the server's environment, never in the database.
 *
 * ── The format ───────────────────────────────────────────────────────────────
 *   v1:<base64( 12-byte IV | 16-byte auth tag | ciphertext )>
 * AES-256-GCM: authenticated, so a tampered value fails to decrypt rather than
 * decrypting to garbage. A fresh random IV every time, so the same token encrypts
 * differently each save. The `v1:` prefix leaves room to rotate the scheme later.
 *
 * ⚠️ Losing or changing TOKEN_ENCRYPTION_KEY makes every stored token unreadable —
 * each connected Square account would have to reconnect. Nothing leaks either way.
 */

import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12; // the standard GCM nonce size
const TAG_BYTES = 16;

function encryptionKey(): Buffer {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64-encoded.");
  }
  return key;
}

/** Is a usable key configured? Settings uses this so a broken setup shows a message
 *  instead of a "Connect" button that can only fail (the M18 rule). */
export function tokenCryptoConfigured(): boolean {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, ciphertext]).toString("base64")}`;
}

export function decryptToken(stored: string): string {
  const [version, body] = stored.split(":", 2);
  if (version !== VERSION || !body) {
    throw new Error("Unrecognised encrypted token format.");
  }
  const raw = Buffer.from(body, "base64");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  // Throws if the value was tampered with or encrypted under a different key.
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
