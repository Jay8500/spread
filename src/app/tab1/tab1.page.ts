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
  IonButtons,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubbleEllipsesOutline,
  chevronForwardOutline,
  searchOutline,
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
    IonListHeader,
    IonIcon,
    IonNote, //IonButtons
  ],
})
export class Tab1Page {
  searchResults: any[] = [];
  personalChats: any[] = [];

  constructor(private supabase: Supabase, private router: Router) {
    // Register icons so they show up in the UI
    addIcons({
      chatbubbleEllipsesOutline,
      chevronForwardOutline,
      searchOutline,
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
    // 1. Get the session quickly (Fixes the LockManager error)
    const {
      data: { session },
    } = await this.supabase.client.auth.getSession();
    this.currentUserId = session?.user?.id || '';

    // 2. Only proceed if we actually have a user
    if (this.currentUserId) {
      await this.loadChats();
      this.setupListPresence();
    } else {
      // If no session, send them back to login
      this.router.navigate(['/login']);
    }
  }

  async loadChats() {
    try {
      const { data: memberships, error } =
        await this.supabase.getPersonalRooms();
      if (error) throw error;

      const chatPromises = (memberships || []).map(async (member: any) => {
        const { data: messages } = await this.supabase.getLatestMessage(
          member.room_id
        );

        // FIX: Check if we got an array and take the first item
        const msg = messages && messages.length > 0 ? messages[0] : null;

        return {
          ...member,
          lastMsgText: msg?.content || null,
          lastMsgDate: msg?.created_at || null,
        };
      });

      const updatedChats = await Promise.all(chatPromises);

      // Only show chats that actually have messages
      const activeChats = updatedChats.filter(
        (chat) => chat.lastMsgDate !== null
      );

      activeChats.sort((a, b) => {
        const dateA = a.lastMsgDate ? new Date(a.lastMsgDate).getTime() : 0;
        const dateB = b.lastMsgDate ? new Date(b.lastMsgDate).getTime() : 0;
        return dateB - dateA;
      });

      this.personalChats = [...activeChats];
    } catch (err) {
      console.error('Fetch Error:', err);
    }
  }
  async onSearch(event: any) {
    const query = event.target.value?.trim();
    const cleanQuery = query?.startsWith('@') ? query.substring(1) : query;

    if (cleanQuery?.length > 1) {
      const results = await this.supabase.searchUsers(cleanQuery);

      // DEBUG: Let's see exactly what IDs we have in our recent list
      console.log('Current Personal Chats:', this.personalChats);

      const existingChatIds = this.personalChats
        .map((chat) => {
          // We check both the profile ID and the user_id field just in case
          return chat.profiles?.id || chat.user_id;
        })
        .filter((id) => !!id);

      console.log('List of existing IDs:', existingChatIds);

      this.searchResults = (results || []).map((user) => {
        // Check if the searched user's ID exists in our ID list
        const match = existingChatIds.some(
          (id) => String(id) === String(user.id)
        );
        return {
          ...user,
          isExisting: match,
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

  getInitials(username: string): string {
    if (!username) return '?';

    // Split by space or underscore to get initials
    const parts = username.split(/[ _.]/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return username[0].toUpperCase();
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
}
