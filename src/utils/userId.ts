// =============================================================================
// MindersPay — Generador de user_id determinístico a partir del # de celular
// -----------------------------------------------------------------------------
// El mismo número de celular SIEMPRE produce el mismo user_id, en cualquier
// dispositivo (web, mobile). Esto permite que Amplitude (y cualquier otro
// sistema downstream) reconozca al usuario como una sola persona aunque
// cambie de dispositivo.
//
// Cómo funciona:
//   1. Normalizamos el teléfono (solo dígitos, sin "+", espacios, guiones).
//   2. Calculamos un hash SHA-256 con Web Crypto API.
//   3. Tomamos los primeros 16 caracteres en hex como id estable.
//   4. Lo persistimos en localStorage para reuso inmediato en futuras
//      sesiones del mismo dispositivo.
//
// IMPORTANTE para que esto funcione cross-platform (web ↔ mobile):
// el mobile app debe usar EXACTAMENTE la misma normalización y el mismo
// hash: SHA-256(phone.replace(/\D/g, '')), primeros 16 chars hex, prefijo
// "user_". Y el código de país tiene que entrar igual (+54 9 en el caso
// de Argentina en este onboarding).
// =============================================================================

const STORAGE_KEY_USER_ID = 'minders_user_id';
const STORAGE_KEY_USER_PHONE = 'minders_user_phone';

/**
 * Normaliza un teléfono a su forma canónica: solo dígitos.
 * Ejemplos:
 *   "+54 9 11 2345-6789" → "5491123456789"
 *   "+54 9 (11) 2345 6789" → "5491123456789"
 *   "5491123456789" → "5491123456789"
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Detecta si un string parece un teléfono (al menos 8 dígitos).
 * Sirve para distinguir teléfono vs email en un mismo input.
 */
export function looksLikePhone(value: string): boolean {
  if (!value) return false;
  const digits = normalizePhone(value);
  return digits.length >= 8;
}

/**
 * Genera un user_id determinístico a partir del teléfono.
 * El mismo teléfono → el mismo user_id, en cualquier dispositivo.
 */
export async function generateUserIdFromPhone(phone: string): Promise<string> {
  const normalized = normalizePhone(phone);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16); // 16 chars hex = 64 bits, suficientemente único
  return `user_${hashHex}`;
}

/** Guarda el user_id en localStorage para reuso en sesiones futuras. */
export function persistUserId(userId: string, phone: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_USER_ID, userId);
    localStorage.setItem(STORAGE_KEY_USER_PHONE, normalizePhone(phone));
  } catch (e) {
    // localStorage puede no estar disponible (modo privado / SSR). Seguimos.
    console.warn('[MindersPay] No se pudo persistir user_id:', e);
  }
}

/** Recupera el user_id y phone guardados, si existen. */
export function getPersistedIdentity(): {
  userId: string | null;
  phone: string | null;
} {
  try {
    return {
      userId: localStorage.getItem(STORAGE_KEY_USER_ID),
      phone: localStorage.getItem(STORAGE_KEY_USER_PHONE),
    };
  } catch {
    return { userId: null, phone: null };
  }
}

/** Limpia el user_id persistido. Útil para logout. */
export function clearPersistedIdentity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_USER_ID);
    localStorage.removeItem(STORAGE_KEY_USER_PHONE);
  } catch {
    // ignorar
  }
}
