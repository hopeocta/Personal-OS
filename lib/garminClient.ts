import { GarminConnect } from 'garmin-connect'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type StoredTokens = { oauth1: unknown; oauth2: unknown }

async function loadStoredTokens(userId: string): Promise<StoredTokens | null> {
  const { data, error } = await supabaseAdmin
    .from('garmin_auth')
    .select('oauth1, oauth2')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error(`[garminClient] token load error (${userId}):`, error)
    return null
  }
  if (!data?.oauth1 || !data?.oauth2) return null
  return { oauth1: data.oauth1, oauth2: data.oauth2 }
}

async function saveTokens(client: GarminConnect, userId: string): Promise<void> {
  try {
    const tokens = client.exportToken()
    const { error } = await supabaseAdmin
      .from('garmin_auth')
      .upsert(
        { user_id: userId, oauth1: tokens.oauth1, oauth2: tokens.oauth2, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    if (error) console.error(`[garminClient] token save error (${userId}):`, error)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[garminClient] exportToken failed (${userId}):`, msg)
  }
}

// Returns an authenticated Garmin client for the given userId, reusing a cached
// OAuth token when possible. Pass creds only from the setup script — never from
// the cron (which must not log in with wrong credentials for another person).
// A full login() is only performed when creds are explicitly provided AND no
// valid token exists. Repeated logins trip Garmin's rate limit ("Ticket not found or MFA").
export async function getGarminClient(
  userId: string,
  creds?: { email: string; password: string }
): Promise<GarminConnect> {
  const client = new GarminConnect({
    username: creds?.email ?? process.env.GARMIN_EMAIL ?? '',
    password: creds?.password ?? process.env.GARMIN_PASSWORD ?? '',
  })

  const stored = await loadStoredTokens(userId)
  if (stored) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.loadToken(stored.oauth1 as any, stored.oauth2 as any)
      // Triggers oauth2 refresh-if-expired and validates the session.
      await client.getUserSettings()
      await saveTokens(client, userId) // persist any refreshed oauth2
      return client
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[garminClient] cached token invalid (${userId}), falling back to login:`, msg)
    }
  }

  // Only login if creds were explicitly provided (setup script).
  // In cron context (no creds), a missing token means skip this person.
  if (!creds) {
    throw new Error(`[garminClient] no valid token for ${userId} and no creds provided — run setup script`)
  }

  await client.login()
  await saveTokens(client, userId)
  return client
}
