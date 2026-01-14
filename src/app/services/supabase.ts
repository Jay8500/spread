import { inject, Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
@Injectable({
  providedIn: 'root',
})
export class Supabase {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      'https://wpryjxkaefdijkxzfwnr.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwcnlqeGthZWZkaWpreHpmd25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNjUwMzAsImV4cCI6MjA4Mjc0MTAzMH0.WNmwtA-kNjhcPkpfeNS8ilK4v6PDHzy_boN0tbnh9wY'
    );
  }

  // This is where we will add your RPC and Realtime functions
  get client() {
    return this.supabase;
  }

  // Get current user profile (Handle & Points)
  async getProfile() {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    return data;
  }

  // Search users by @handle
  async searchUsers(searchTerm: string) {
    // 1. Get current logged-in user
    const {
      data: { user },
    } = await this.client.auth.getUser();

    const cleanTerm = searchTerm.startsWith('@')
      ? searchTerm.substring(1)
      : searchTerm;

    return await this.client
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .ilike('username', `%${cleanTerm}%`)
      .neq('id', user?.id) // <--- THIS LINE excludes you from the list!
      .limit(5)
      .then((res) => res.data || []);
  }

  // --- ROOMS & TABS ---
  async getPersonalRooms() {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) return { data: [], error: 'No user' };

    // Just get the raw rows from room_members where I am a member
    return await this.client
      .from('room_members')
      .select('room_id, user_id')
      .eq('user_id', user.id);
  }

  // Add this helper to fetch a profile by ID (Safe Fallback)
  async getProfileById(userId: string) {
    return await this.client
      .from('profiles')
      .select('id, username, avatar_url, vibe')
      .eq('id', userId)
      .single();
  }
  // Add this helper method to get messages for a specific room
  async getLatestMessage(roomId: string) {
    return await this.client
      .from('messages')
      .select('content, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1); // Don't use .single() here, it causes 406 if empty
  }

  // Load Circles Tab (Groups)
  async getCircles() {
    return await this.supabase
      .from('rooms')
      .select(
        `
        *,
        room_members!inner(user_id)
      `
      )
      .eq('is_group', true)
      .eq(
        'room_members.user_id',
        (
          await this.supabase.auth.getUser()
        ).data.user?.id
      );
  }

  // --- ACTIONS (RPC) ---

  // Handshake: Search result -> Start Chat
  async startChat(targetUserId: string) {
    const { data, error } = await this.supabase.rpc(
      'get_or_create_personal_room',
      {
        target_user_id: targetUserId,
      }
    );
    return data; // Returns the Room UUID
  }

  // Create Circle & Earn 10 Points
  async createCircle(name: string) {
    const { data, error } = await this.supabase.rpc('create_new_circle', {
      circle_name: name,
    });
    return data;
  }

  // --- MESSAGING & REALTIME ---

  // Send a message
  async sendMessage(roomId: string, content: string) {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    return await this.supabase
      .from('messages')
      .insert({ room_id: roomId, user_id: user?.id, content });
  }

  // The Realtime "Ping" Listener
  listenToMessages(roomId: string, callback: (payload: any) => void) {
    return this.supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        callback
      )
      .subscribe();
  }

  async signIn() {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: 'jay@test.com',
      password: 'yourpassword',
    });
    return { data, error };
  }

  // 1. The Listener that fixes the "Stuck on Loading" issue
  authChanges(callback: (event: any, session: any) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }

  async updateFcmToken(token: string) {
    // Use getSession instead of getUser for a quicker check
    const {
      data: { session },
    } = await this.client.auth.getSession();

    if (!session?.user) {
      console.warn('FcmToken update deferred: No active session found.');
      // Optional: Store token in LocalStorage and try again after login
      localStorage.setItem('pending_fcm_token', token);
      return;
    }

    const { error } = await this.client
      .from('profiles')
      .update({ fcm_token: token })
      .eq('id', session.user.id);

    if (error) {
      console.error('Error updating FCM token:', error);
    } else {
      console.log('FCM Token successfully synced to Supabase');
      localStorage.removeItem('pending_fcm_token');
    }
  }

  // Add to your SupabaseService class
  async getTodos() {
    const { data, error } = await this.supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false });
    return data;
  }

  async addTodo(task: string, dueAt?: string) {
    const user = await this.supabase.auth.getUser();
    return await this.supabase.from('todos').insert({
      task,
      user_id: user.data.user?.id,
      due_at: dueAt,
    });
  }

  // Update the completion status of a specific task
  async updateTodoStatus(todoId: string, isCompleted: boolean) {
    const { data, error } = await this.supabase
      .from('todos')
      .update({ is_completed: isCompleted }) // Column to update
      .eq('id', todoId) // Matches the specific Task ID
      .select(); // Returns the updated data

    return { data, error };
  }

  async deleteTodo(todoId: string) {
    const { error } = await this.client.from('todos').delete().eq('id', todoId);

    return { error };
  }
}
