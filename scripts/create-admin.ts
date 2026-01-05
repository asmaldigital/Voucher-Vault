import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your secrets.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdminUser() {
  const email = 'admin@supersave.co.za';
  const password = 'SuperSaveAdmin2026!';

  console.log(`Attempting to create admin user: ${email}...`);

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'admin' }
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('Admin user already exists.');
    } else {
      console.error('Error creating user:', error.message);
      process.exit(1);
    }
  } else {
    console.log('Admin user created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
  }
}

createAdminUser();
