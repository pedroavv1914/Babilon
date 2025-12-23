import { supabase } from './supabaseClient'

export async function getUserId() {
  const { data } = await supabase.auth.getUser()
  return data.user?.id || null
}

