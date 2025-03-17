import { supabaseAdmin } from './supabase-admin';

// Example function to get all users (admin access)
export async function getAllUsers() {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*');
  
  if (error) throw error;
  return data;
}

// Example function to update user data (admin access)
export async function updateUserById(userId: string, updateData: Partial<any>) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Example function to delete user (admin access)
export async function deleteUserById(userId: string) {
  const { error } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', userId);
  
  if (error) throw error;
  return true;
}

// Example function to create a new subscription (admin access)
export async function createSubscription(userId: string, subscriptionData: any) {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .insert({
      user_id: userId,
      ...subscriptionData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Example function to get all subscriptions (admin access)
export async function getAllSubscriptions() {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*');
  
  if (error) throw error;
  return data;
} 