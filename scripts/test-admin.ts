import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllUsers, createSubscription } from '../utils/admin-db';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Create admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  }
);

async function testDirectAdminAccess() {
  console.log('\n=== Testing Direct Admin Access ===');
  
  try {
    // Test 1: Get all users directly using supabaseAdmin
    console.log('\nTest 1: Getting users directly with supabaseAdmin...');
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .limit(5);
    
    if (error) throw error;
    console.log('Success! Found', users.length, 'users');
    console.log('First user:', users[0]);

    // Test 2: Create a test subscription
    if (users.length > 0) {
      console.log('\nTest 2: Creating test subscription...');
      const { data: subscription, error: subError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id: users[0].id,
          status: 'active',
          price_id: 'test_price_id',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (subError) throw subError;
      console.log('Success! Created subscription:', subscription);
    }

  } catch (error) {
    console.error('Error in direct admin access tests:', error);
  }
}

async function testApiRoutes() {
  console.log('\n=== Testing Admin API Routes ===');
  const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  try {
    // Test 1: Get all users via API
    console.log('\nTest 1: Getting users via API...');
    const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_API_KEY}`
      }
    });
    const data = await response.json();
    
    if (!response.ok) throw new Error(data.error || 'API request failed');
    console.log('Success! Found', data.users.length, 'users');

    if (data.users.length > 0) {
      const testUser = data.users[0];

      // Test 2: Update a user via API
      console.log('\nTest 2: Updating user via API...');
      const updateResponse = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${ADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUser.id,
          updateData: {
            updated_at: new Date().toISOString()
          }
        })
      });
      const updateData = await updateResponse.json();
      
      if (!updateResponse.ok) throw new Error(updateData.error || 'Update failed');
      console.log('Success! Updated user:', updateData.user);
    }

  } catch (error) {
    console.error('Error in API route tests:', error);
  }
}

async function runTests() {
  console.log('Starting admin client tests...');
  
  await testDirectAdminAccess();
  await testApiRoutes();
  
  console.log('\nTests completed!');
  process.exit(0);
}

runTests(); 