import { Component, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFooter,
  IonInput,
  IonButton,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonLabel,
} from '@ionic/angular/standalone';
import { Supabase } from '../services/supabase';

@Component({
  selector: 'app-chat-detail',
  templateUrl: './chat-detail.page.html',
  styleUrls: ['./chat-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFooter,
    IonInput,
    IonButton,
    IonButtons,
    IonBackButton, // IonList, IonItem, IonLabel
  ],
})
export class ChatDetailPage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;
  chatName: string = 'Conversation';
  roomId: string = '';
  messages: any[] = [];
  newMessage: string = '';
  currentUserId: string = '';
  subscription: any;
  public router = inject(Router);
  isOtherTyping: boolean = false;
  constructor(private route: ActivatedRoute, private supabase: Supabase) {}

  async ngOnInit() {
    // 1. Get the Room ID from the URL
    this.roomId = this.route.snapshot.paramMap.get('id')!;
    console.log('Chatting in Room:', this.roomId);
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras.state?.['name']) {
      this.chatName = nav.extras.state['name'];
    }
    // 2. Get Jay's ID
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    this.currentUserId = user?.id || '';
    console.log('Logged in as:', this.currentUserId);

    // 3. Load the history
    await this.loadMessages();

    // 4. Listen for live updates
    this.setupRealtime();
  }

  async loadMessages() {
    const { data } = await this.supabase.client
      .from('messages')
      .select('*')
      .eq('room_id', this.roomId)
      .order('created_at', { ascending: true });
    this.messages = data || [];
    this.scrollToBottom();
  }

  setupRealtime() {
    // Assign to class property so onTyping can find it
    this.subscription = this.supabase.client.channel(`room-${this.roomId}`);

    this.subscription
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${this.roomId}`,
        },
        (payload: any) => {
          const exists = this.messages.some((m) => m.id === payload.new['id']);
          if (!exists) {
            this.messages.push(payload.new);
            this.scrollToBottom();
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = this.subscription.presenceState();

        // Convert the object values into a single flat array without using .flat()
        const usersArray: any = Object.values(state).reduce(
          (acc: any, val: any) => acc.concat(val),
          []
        );

        // Check if any OTHER user in the room is typing
        this.isOtherTyping = usersArray.some(
          (user: any) => user.user_id !== this.currentUserId && user.isTyping
        );
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await this.subscription.track({
            user_id: this.currentUserId,
            isTyping: false,
          });
        }
      });
  }

  onTyping(event: any) {
    const typing = event.target.value.length > 0;
    if (this.subscription) {
      this.subscription.track({
        user_id: this.currentUserId,
        isTyping: typing,
      });
    }
  }

  async sendMessage() {
    if (!this.newMessage.trim()) return;
    const messageContent = this.newMessage;
    this.newMessage = '';

    // ADD THIS LINE: Force typing status to false immediately on send
    if (this.subscription) {
      this.subscription.track({ user_id: this.currentUserId, isTyping: false });
    }

    const { data } = await this.supabase.client
      .from('messages')
      .insert({
        room_id: this.roomId,
        user_id: this.currentUserId,
        content: messageContent,
      })
      .select()
      .single();

    if (data) {
      this.messages.push(data);
      this.scrollToBottom();
    }
  }

  ionViewWillLeave() {
    if (this.subscription) {
      this.supabase.client.removeChannel(this.subscription);
    }
  }

  scrollToBottom() {
    setTimeout(() => {
      this.content.scrollToBottom(300);
    }, 100);
  }
}
