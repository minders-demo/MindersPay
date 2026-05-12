// =============================================================================
// MindersPay — Generador de user_id determinístico a partir del celular
// -----------------------------------------------------------------------------
// El mismo número de celular SIEMPRE produce el mismo user_id, en cualquier
// dispositivo. Para lograrlo, web y mobile deben usar la misma forma canónica:
// teléfono internacional en formato E.164, por ejemplo:
//   Colombia:  +573004567890
//   Argentina: +5491123456789
//   México:    +525512345678
//
// Regla clave:
//   1. El usuario debe ingresar el país/indicativo. La app NO agrega +54 9.
//   2. Normalizamos a E.164: "+" + solo dígitos.
//   3. Para hashear usamos esos mismos dígitos, sin el signo "+".
//   4. Calculamos SHA-256 y tomamos los primeros 16 caracteres hex.
// =============================================================================

const STORAGE_KEY_USER_ID = 'minders_user_id';
const STORAGE_KEY_USER_PHONE = 'minders_user_phone';
const STORAGE_KEY_USER_PHONE_E164 = 'minders_user_phone_e164';

/**
 * Convierte un teléfono internacional escrito por el usuario a formato E.164.
 * No inventa ni prepende país. Si falta el "+", el teléfono se considera inválido
 * para identificación cross-platform.
 *
 * Ejemplos:
 *   "+57 300 456 7890"      → "+573004567890"
 *   "+54 9 11 2345-6789"    → "+5491123456789"
 *   "+52 (55) 1234 5678"    → "+525512345678"
 */
export function normalizePhoneToE164(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) return '';

  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/**
 * Devuelve solo los dígitos del teléfono canónico.
 * Se mantiene este helper porque el hash se calcula sin el signo "+".
 */
export function normalizePhone(phone: string): string {
  return normalizePhoneToE164(phone).replace(/\D/g, '');
}

/**
 * Valida formato E.164 básico:
 *   + seguido de 8 a 15 dígitos, empezando por 1-9.
 */
export function isValidE164Phone(phone: string): boolean {
  const e164 = normalizePhoneToE164(phone);
  return /^\+[1-9]\d{7,14}$/.test(e164);
}

/**
 * Detecta si un string parece un teléfono internacional válido.
 * Sirve para distinguir teléfono vs email en el login.
 */
export function looksLikePhone(value: string): boolean {
  return isValidE164Phone(value);
}

/**
 * Genera un user_id determinístico a partir del teléfono en formato E.164.
 * El mismo teléfono internacional → el mismo user_id en web y mobile.
 */
export async function generateUserIdFromPhone(phone: string): Promise<string> {
  if (!isValidE164Phone(phone)) {
    throw new Error('El teléfono debe estar en formato internacional. Ejemplo: +573004567890');
  }

  const normalizedDigits = normalizePhone(phone);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedDigits);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);

  return `user_${hashHex}`;
}

/** Guarda el user_id y el teléfono normalizado para reuso en sesiones futuras. */
export function persistUserId(userId: string, phone: string): void {
  try {
    const phoneE164 = normalizePhoneToE164(phone);
    localStorage.setItem(STORAGE_KEY_USER_ID, userId);
    localStorage.setItem(STORAGE_KEY_USER_PHONE, normalizePhone(phone));
    localStorage.setItem(STORAGE_KEY_USER_PHONE_E164, phoneE164);
  } catch (e) {
    console.warn('[MindersPay] No se pudo persistir user_id:', e);
  }
}

/** Recupera el user_id y phone guardados, si existen. */
export function getPersistedIdentity(): {
  userId: string | null;
  phone: string | null;
  phoneE164: string | null;
} {
  try {
    return {
      userId: localStorage.getItem(STORAGE_KEY_USER_ID),
      phone: localStorage.getItem(STORAGE_KEY_USER_PHONE),
      phoneE164: localStorage.getItem(STORAGE_KEY_USER_PHONE_E164),
    };
  } catch {
    return { userId: null, phone: null, phoneE164: null };
  }
}

/** Limpia el user_id persistido. Útil para logout. */
export function clearPersistedIdentity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_USER_ID);
    localStorage.removeItem(STORAGE_KEY_USER_PHONE);
    localStorage.removeItem(STORAGE_KEY_USER_PHONE_E164);
  } catch {
    // ignorar
  }
}
