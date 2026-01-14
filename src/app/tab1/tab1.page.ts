import { Component, OnInit, ViewChild } from '@angular/core';
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
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
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
  person,
  trashOutline,
  timeOutline,
  sparklesOutline, // New for Vault
} from 'ionicons/icons';
import { Supabase } from '../services/supabase';
import { filter } from 'rxjs';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
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
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    // THE ESSENTIAL IMPORTS FOR FORM ELEMENTS:
    IonInput, // For the newTask text
    IonCheckbox, // For the toggle status
    // IonDatetime, // For the schedule date
    // IonDatetimeButton, // For the trigger button
  ],
})
export class Tab1Page {
  @ViewChild('taskInput') taskInput!: IonInput;
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
      trashOutline,
      timeOutline,
      sparklesOutline,
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
        if (event.urlAfterRedirects.includes('/tabs/tab1')) {
          // 1. ఒకవేళ personalChats లో ఆల్రెడీ డేటా ఉంటే మళ్ళీ నెట్‌వర్క్ కాల్ చేయొద్దు
          if (this.personalChats.length === 0) {
            console.log('Fetching chats for the first time...');
            this.loadChats();
          }
        }
      });
  }

  async ionViewWillEnter() {
    // 1. కేవలం యూజర్ ఉందో లేదో తనిఖీ చేయి
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }
    this.currentUserId = user.id;

    // 2. ప్రొఫైల్ ని బ్యాక్‌గ్రౌండ్‌లో లోడ్ చేయి (దీనివల్ల స్క్రీన్ మెరవదు)
    this.fetchProfile();

    // 3. లిస్ట్ ఖాళీగా ఉంటేనే లోడ్ చేయి (ముఖ్యమైన పాయింట్)
    if (this.personalChats.length === 0) {
      await this.loadChats();
      this.setupListPresence();
    }
  }

  async loadChats() {
    try {
      if (!this.currentUserId) return;

      const { data: myMemberships } = await this.supabase.client
        .from('room_members')
        .select('room_id')
        .eq('user_id', this.currentUserId);

      if (!myMemberships || myMemberships.length === 0) {
        this.personalChats = [];
        return;
      }

      const chatPromises = myMemberships.map(async (m: any) => {
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

        // ఇక్కడ సేఫ్టీ చెక్: ఒకవేళ వేరే మెంబర్ లేకపోతే అసలు ఈ చాట్ ని చూపించొద్దు
        if (!otherMember || !otherMember.profiles) return null;

        const { data: messages } = await this.supabase.getLatestMessage(
          m.room_id
        );
        const latestMsg = messages?.[0];
        const profile: any = otherMember.profiles;
        const rawVibe = profile?.vibe || 'good';

        return {
          room_id: m.room_id,
          profiles: profile,
          lastMsgText: latestMsg?.content || 'Start a conversation',
          lastMsgDate: latestMsg?.created_at || null,
          vibe: `vibe-${rawVibe}`,
          vibeLabel: rawVibe.toUpperCase(),
        };
      });

      const results = await Promise.all(chatPromises);

      // ఇక్కడ జాగ్రత్తగా ఫిల్టర్ చేయాలి - room_id కచ్చితంగా ఉండాలి
      this.personalChats = results.filter(
        (c) => c !== null && c.room_id !== undefined
      );

      this.personalChats.sort((a, b) => {
        const dateA = a.lastMsgDate ? new Date(a.lastMsgDate).getTime() : 0;
        const dateB = b.lastMsgDate ? new Date(b.lastMsgDate).getTime() : 0;
        return dateB - dateA;
      });
    } catch (err) {
      console.error('Load Chats Error:', err);
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
    if (!this.personalChats || this.personalChats.length === 0) return;

    this.personalChats.forEach((chat) => {
      // ఇక్కడ కూడా రూమ్ ఐడి ఉందో లేదో చెక్ చేయాలి
      if (!chat || !chat.room_id) return;

      const channel = this.supabase.client.channel(`room-${chat.room_id}`);
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const usersArray = Object.values(state).flat();
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
    // 1. తక్షణమే మోడల్ ఓపెన్ చేయి (don't use await here)
    this.isTodoModalOpen = true;

    // 2. బ్యాక్‌గ్రౌండ్‌లో డేటా లోడ్ చెయ్
    this.supabase.getTodos().then((data) => {
      this.todos = data || [];
    });

    // 3. కీబోర్డ్ ఆటోమేటిక్ గా ఓపెన్ అవ్వడానికి
    setTimeout(() => {
      if (this.taskInput) {
        this.taskInput.setFocus();
      }
    }, 300); // 300ms is the sweet spot for animations
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
    await Haptics.impact({ style: ImpactStyle.Medium });
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
