import { GarminConnect } from 'garmin-connect'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const USER = 'me'

type StoredTokens = { oauth1: unknown; oauth2: unknown }

async function loadStoredTokens(): Promise<StoredTokens | null> {
  const { data, error } = await supabaseAdmin
    .from('garmin_auth')
    .select('oauth1, oauth2')
    .eq('user_id', USER)
    .maybeSingle()
  if (error) {
    console.error('[garminClient] token load error:', error)
    return null
  }
  if (!data?.oauth1 || !data?.oauth2) return null
  return { oauth1: data.oauth1, oauth2: data.oauth2 }
}

async function saveTokens(client: GarminConnect): Promise<void> {
  try {
    const tokens = client.exportToken()
    const { error } = await supabaseAdmin
      .from('garmin_auth')
      .upsert(
        { user_id: USER, oauth1: tokens.oauth1, oauth2: tokens.oauth2, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    if (error) console.error('[garminClient] token save error:', error)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[garminClient] exportToken failed:', msg)
  }
}

// Returns an authenticated Garmin client, reusing a cached OAuth token when
// possible. A full login() is only performed when no valid token exists —
// repeated logins trip Garmin's rate limit ("Ticket not found or MFA").
// The package auto-refreshes the short-lived oauth2 token from the long-lived
// oauth1 token, so cached sessions stay valid for ~a year.
export async function getGarminClient(): Promise<GarminConnect> {
  const client = new GarminConnect({
    username: process.env.GARMIN_EMAIL ?? '',
    password: process.env.GARMIN_PASSWORD ?? '',
  })

  const stored = await loadStoredTokens()
  if (stored) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.loadToken(stored.oauth1 as any, stored.oauth2 as any)
      // Triggers oauth2 refresh-if-expired and validates the session.
      await client.getUserSettings()
      await saveTokens(client) // persist any refreshed oauth2
      return client
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[garminClient] cached token invalid, falling back to login:', msg)
    }
  }

  await client.login()
  await saveTokens(client)
  return client
}
