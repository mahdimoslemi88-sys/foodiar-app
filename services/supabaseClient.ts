// services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// مقادیری که از داشبورد Supabase کپی کردید را اینجا جایگزین کنید
const supabaseUrl = 'YOUR_SUPABASE_PROJECT_URL'; 
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'YOUR_SUPABASE_PROJECT_URL') {
    console.error("Supabase URL and Anon Key must be provided in services/supabaseClient.ts");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
