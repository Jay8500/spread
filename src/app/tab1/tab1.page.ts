import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonIcon,
  IonListHeader,
  IonNote,
  IonModal,
  IonChip,
  IonButtons,
  IonButton,
  IonCheckbox,
  IonDatetime,
  IonDatetimeButton,
  IonInput,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubbleEllipsesOutline,
  chevronForwardOutline,
  searchOutline,
  gitNetworkOutline, // New for Mind Map
  cashOutline, // New for Money
  lockClosedOutline,
  checkboxOutline,
  addOutline,
  person, // New for Vault
} from 'ionicons/icons';
import { Supabase } from '../services/supabase';
import { filter } from 'rxjs';
@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  standalone: true,
  styleUrls: ['tab1.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonAvatar,
    IonIcon,
    IonNote,
    IonModal,
    IonButtons,
    IonButton,
    IonListHeader,
    // THE ESSENTIAL IMPORTS FOR FORM ELEMENTS:
    IonInput, // For the newTask text
    IonCheckbox, // For the toggle status
    // IonDatetime, // For the schedule date
    IonDatetimeButton, // For the trigger button
  ],
})
export class Tab1Page {
  userProfile: any = null;
  searchResults: any[] = [];
  personalChats: any[] = [];
  selectedDate: string = new Date().toISOString();
  constructor(private supabase: Supabase, private router: Router) {
    // Register icons so they show up in the UI
    addIcons({
      chatbubbleEllipsesOutline,
      checkboxOutline,
      chevronForwardOutline,
      searchOutline,
      gitNetworkOutline,
      cashOutline,
      lockClosedOutline,
      addOutline,
      'profile-icon': person,
    });
    // 2. LISTEN FOR NAVIGATION (This is the fix!)
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        // Check if we just landed on Tab 1
        if (event.urlAfterRedirects.includes('/tabs/tab1')) {
          console.log('Tab 1 became active - Refreshing data...');
          this.loadChats();
        }
      });
  }

  async ionViewWillEnter() {
    // 1. Force a refresh of the user state
    const {
      data: { user },
      error,
    } = await this.supabase.client.auth.getUser();

    if (error || !user) {
      console.error('Auth error or no user:', error);
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    this.currentUserId = user.id;

    // 2. Now that we are 100% sure we have a user, load the profile and chats
    await Promise.all([this.fetchProfile(), this.loadChats()]);

    this.setupListPresence();
  }

  async loadChats() {
    try {
      // Use the ID we just verified in ionViewWillEnter
      if (!this.currentUserId) return;

      // 1. Get my room memberships
      const { data: myMemberships } = await this.supabase.client
        .from('room_members')
        .select('room_id')
        .eq('user_id', this.currentUserId);

      if (!myMemberships || myMemberships.length === 0) {
        this.personalChats = [];
        return;
      }

      // 2. Map through rooms to find the "Other Person" and their messages
      const chatPromises = myMemberships.map(async (m: any) => {
        // Find the member in this room who IS NOT ME
        const { data: otherMember } = await this.supabase.client
          .from('room_members')
          .select(
            `
          user_id,
          profiles:user_id (id, username, avatar_url, vibe)
        `
          )
          .eq('room_id', m.room_id)
          .neq('user_id', this.currentUserId)
          .single();

        if (!otherMember) return null;

        // Get the latest message
        const { data: messages } = await this.supabase.getLatestMessage(
          m.room_id
        );
        const latestMsg = messages?.[0];
        const profile = otherMember.profiles;
        // Inside your Tab 1 loadChats() loop:
        // Use 'as any' or bracket notation if TypeScript complains
        const rawVibe = (profile as any)?.vibe || 'good';
        return {
          room_id: m.room_id,
          profiles: profile,
          lastMsgText: latestMsg?.content || 'Start a conversation',
          lastMsgDate: latestMsg?.created_at || null,
          vibe: `vibe-${rawVibe}`, // This matches your SCSS classes like .vibe-good
          vibeLabel: rawVibe.toUpperCase(),
        };
      });

      const results = await Promise.all(chatPromises);
      this.personalChats = results.filter((c) => c !== null);

      // Sort by date
      this.personalChats.sort((a, b) => {
        const dateA = a.lastMsgDate ? new Date(a.lastMsgDate).getTime() : 0;
        const dateB = b.lastMsgDate ? new Date(b.lastMsgDate).getTime() : 0;
        return dateB - dateA;
      });
    } catch (err) {
      console.error('Final Fallback Load Error:', err);
    }
  }

  async onSearch(event: any) {
    const query = event.target.value?.toLowerCase().trim();
    const cleanQuery = query?.startsWith('@') ? query.substring(1) : query;

    if (cleanQuery?.length > 1) {
      const results = await this.supabase.searchUsers(cleanQuery);

      this.searchResults = (results || []).map((user: any) => {
        // Ensure we are grabbing the ID and username correctly
        // Sometimes it's user.id, sometimes it's user.profiles.id
        const userId = user.id;

        const isExisting = this.personalChats.some(
          (chat) => chat.profiles?.id === userId || chat.user_id === userId
        );

        return {
          ...user,
          username: user.username, // Force a flat username for the UI
          isExisting: isExisting,
        };
      });
    } else {
      this.searchResults = [];
    }
  }

  async startChat(targetUserId: string) {
    // Check our local list first
    const existingChat = this.personalChats.find(
      (c) => c.profiles?.id === targetUserId
    );

    if (existingChat) {
      console.log('Redirecting to existing room...');
      this.searchResults = []; // Clear search
      this.router.navigate(['/chat-detail', existingChat.room_id]);
      return;
    }

    // If truly new, then create it
    const roomId = await this.supabase.startChat(targetUserId);
    if (roomId) {
      this.searchResults = [];
      await this.loadChats();
      this.router.navigate(['/chat-detail', roomId]);
    }
  }
  // 4. Open an existing chat room
  goToChat(chat: any) {
    if (chat.room_id) {
      this.router.navigate(['/chat-detail', chat.room_id], {
        state: { name: chat.profiles?.username },
      });
    }
  }

  getInitials(username: string | undefined | null): string {
    // 1. Safety check: If no username, return a generic placeholder
    if (!username) return '??';
    // 2. Remove @ if it exists
    const cleanName = username.startsWith('@')
      ? username.substring(1)
      : username;
    // 3. Handle names with spaces, dots, or underscores
    const parts = cleanName.split(/[ _.]/).filter((p) => p.length > 0);
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    // 4. Fallback: just take the first two letters of the name
    return cleanName.substring(0, 2).toUpperCase();
  }

  currentUserId: string = ''; // Add this line at the top with your other properties
  typingStates: { [key: string]: boolean } = {};
  setupListPresence() {
    this.personalChats.forEach((chat) => {
      const channel = this.supabase.client.channel(`room-${chat.room_id}`);

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const usersArray = Object.values(state).reduce(
            (acc: any, val: any) => acc.concat(val),
            []
          );

          // Check if the OTHER person in this specific room is typing
          this.typingStates[chat.room_id] = usersArray.some(
            (u: any) => u.user_id !== this.currentUserId && u.isTyping
          );
        })
        .subscribe();
    });
  }

  // Newly Added Dashboard Methods
  openMindMap() {
    console.log('Opening Mind Map...');
    // Replace with your actual route: this.router.navigate(['/mind-map']);
  }

  openMoney() {
    console.log('Opening Money Tracker...');
    // Replace with your actual route: this.router.navigate(['/money']);
  }

  openVault() {
    console.log('Opening Vault...');
    // Replace with your actual route: this.router.navigate(['/vault']);
  }

  isTodoModalOpen = false;
  newTask = '';
  todos: any = [];
  async openTodoModal() {
    this.isTodoModalOpen = true;
    // Refresh list every time modal opens to ensure it's up to date
    this.todos = await this.supabase.getTodos();
  }

  async addNewTask() {
    if (!this.newTask.trim()) return;

    const { data, error } = await this.supabase.addTodo(this.newTask);

    if (!error) {
      this.newTask = ''; // Clear input
      this.todos = await this.supabase.getTodos(); // Refresh list
    }
  }

  async toggleTodo(todo: any) {
    // Update the completion status in Supabase
    await this.supabase.updateTodoStatus(todo.id, !todo.is_completed);
  }

  async deleteTodo(todoId: string) {
    const { error } = await this.supabase.deleteTodo(todoId);

    if (!error) {
      // Filter out the deleted todo from the local list for an instant UI update
      this.todos = this.todos.filter((t: any) => t.id !== todoId);
      console.log('Task deleted successfully');
    } else {
      console.error('Error deleting task:', error);
    }
  }

  async fetchProfile() {
    const {
      data: { session },
    } = await this.supabase.client.auth.getSession();
    if (session?.user) {
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!error && data) {
        this.userProfile = { ...data, email: session.user.email };
      }
    }
  }

  goToProfile() {
    this.router.navigate(['/tabs/tab2'], { replaceUrl: true });
  }
}
