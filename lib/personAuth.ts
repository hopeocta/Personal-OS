// Athleten-Auth: einfaches Passwort pro Person, gespeichert in PERSON_PASSWORDS env.
// Format: "p1:passwort1,p2:passwort2"
// Cookie: "p_auth" = "<personId>.<hmac-sig>"

export const PERSON_COOKIE = 'p_auth'

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
function fromHex(hex: string) {
  const buf = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) buf[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return buf
}

async function hmacKey() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET not set')
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function createPersonCookie(personId: string) {
  const key = await hmacKey()
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(personId))
  return `${personId}.${toHex(sig)}`
}

export async function verifyPersonCookie(cookie: string): Promise<string | null> {
  try {
    const dot = cookie.lastIndexOf('.')
    if (dot === -1) return null
    const personId = cookie.slice(0, dot)
    const sig = cookie.slice(dot + 1)
    const key = await hmacKey()
    const ok = await crypto.subtle.verify('HMAC', key, fromHex(sig), new TextEncoder().encode(personId))
    return ok ? personId : null
  } catch {
    return null
  }
}

export function getPersonPasswords(): Record<string, string> {
  const raw = process.env.PERSON_PASSWORDS ?? ''
  return Object.fromEntries(raw.split(',').filter(Boolean).map(s => s.trim().split(':')))
}

export function checkPersonPassword(personId: string, password: string): boolean {
  const map = getPersonPasswords()
  return map[personId] === password
}
