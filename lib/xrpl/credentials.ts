import { MAX_CREDENTIAL_TYPE_LENGTH } from "./constants";
import type { CredentialInfo } from "../types";

/**
 * Encode a credential type string to uppercase hex.
 * Uses raw hex encoding (UTF-8 string -> uppercase hex), NOT the 40-char
 * zero-padded format used for non-standard currency codes.
 *
 * @throws if the type is empty or exceeds MAX_CREDENTIAL_TYPE_LENGTH bytes.
 */
export function encodeCredentialType(type: string): string {
  const buf = Buffer.from(type, "utf-8");
  if (buf.length === 0) {
    throw new Error("Credential type must not be empty");
  }
  if (buf.length > MAX_CREDENTIAL_TYPE_LENGTH) {
    throw new Error(
      `Credential type exceeds maximum length of ${MAX_CREDENTIAL_TYPE_LENGTH} bytes`,
    );
  }
  return buf.toString("hex").toUpperCase();
}

/**
 * Decode a hex-encoded credential type back to a UTF-8 string.
 * Falls back to returning the raw hex if the decoded text contains
 * non-printable characters.
 */
export function decodeCredentialType(hex: string): string {
  const decoded = Buffer.from(hex, "hex").toString("utf-8");
  if (/^[\x20-\x7E]+$/.test(decoded)) {
    return decoded;
  }
  return hex;
}

export function isCredentialExpired(cred: CredentialInfo): boolean {
  return cred.expiresAtMs !== undefined && cred.expiresAtMs < Date.now();
}
