// services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tadlkpakxwsrchhsfazd.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhZGxrcGFreHdzcmNoaHNmYXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU1MjMsImV4cCI6MjA4MDgwMTUyM30.pFQypIaP0Yk-aTNMlh24BFNB3Ue6T7-I9w1hKLjmPAA';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('YOUR_SUPABASE')) {
    console.error("Supabase URL and Anon Key must be provided in services/supabaseClient.ts");
    // We don't throw an error to prevent the app from crashing on Netlify preview builds
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
