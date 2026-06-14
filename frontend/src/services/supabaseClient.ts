
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vnxchkdafuaiurvscvoy.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZueGNoa2RhZnVhaXVydnNjdm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjY5NzYsImV4cCI6MjA4NjU0Mjk3Nn0.t62QcmO8vOPDAtDAHecBFYaCd0ELnnJjLC0ir_xJ6P0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Sign in with Google OAuth (redirect flow). Call from login screen. */
export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
};

/** Sign out from Supabase Auth. */
export const signOutSupabase = async () => {
  await supabase.auth.signOut();
};
