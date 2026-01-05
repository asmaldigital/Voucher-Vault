import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

async function fetchConfig() {
  const response = await fetch('/api/config');
  if (!response.ok) {
    throw new Error('Failed to fetch Supabase configuration');
  }
  return response.json();
}

export function initSupabase(): Promise<SupabaseClient> {
  if (!initPromise) {
    initPromise = (async () => {
      const config = await fetchConfig();
      
      if (!config.supabaseUrl || !config.supabaseAnonKey) {
        throw new Error('Missing Supabase configuration');
      }
      
      supabaseInstance = createClient(config.supabaseUrl, config.supabaseAnonKey);
      return supabaseInstance;
    })();
  }
  
  return initPromise;
}

export async function getSupabaseAsync(): Promise<SupabaseClient> {
  return initSupabase();
}

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    throw new Error('Supabase not initialized. Use getSupabaseAsync() instead.');
  }
  return supabaseInstance;
}

export function isSupabaseReady(): boolean {
  return supabaseInstance !== null;
}

export type { User, Session } from '@supabase/supabase-js';
