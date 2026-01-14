import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  inject,
  signal,
  computed,
} from '@angular/core';
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
  IonFab,
  IonFabButton,
  IonLabel,
  IonIcon,
} from '@ionic/angular/standalone';
import { Supabase } from '../services/supabase';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { addIcons } from 'ionicons';
import {
  imageOutline,
  videocamOutline,
  videocam,
  mic,
  micOff,
  cameraReverse,
  videocamOff,
  call,
} from 'ionicons/icons';
import { Video } from '../video';
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
    IonIcon,
    IonTitle,
    IonContent,
    IonFooter,
    IonInput,
    // IonFab,
    IonFabButton,
    IonButton,
    // IonIcon,
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
  public video = inject(Video);
  // Signal for the remote user ID
  friendId = signal<string>('');

  public SOUNDS = {
    // A subtle "pop" or "click" for sending
    send: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
    // A gentle "ding" or "chirp" for receiving
    received:
      'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3',
    // A tiny "tap" sound for the button click itself
    tap: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  };

  private sendAudio = new Audio(this.SOUNDS.send);
  private receiveAudio = new Audio(this.SOUNDS.received);

  // Helper to play sounds without lag
  private playEffect(audio: HTMLAudioElement) {
    audio.currentTime = 0; // Reset to start if already playing
    audio.play().catch(() => {
      // Browsers sometimes block audio until first user interaction
      console.log('Audio playback waiting for user interaction');
    });
  }

  friendProfile = signal<any>({ aura_status: 'good' });
  canCall = computed(() => {
    const profile = this.friendProfile();
    return profile?.aura_status !== 'busy' && profile?.aura_status !== 'sad';
  });
  constructor(private route: ActivatedRoute, private supabase: Supabase) {
    addIcons({
      imageOutline,
      videocamOutline,
      videocam,
      mic,
      micOff,
      cameraReverse,
      videocamOff,
      call,
    });
  }

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
    this.video.initPeer(this.currentUserId);

    // Fetch friend's ID from the room/conversation members
    await this.getFriendDetails();
    // 3. Load the history
    await this.loadMessages();

    // 4. Listen for live updates
    this.setupRealtime();
  }

  async getFriendDetails() {
    // 1. Find the other user's ID from the messages in this room
    const { data: latestMsg } = await this.supabase.client
      .from('messages')
      .select('user_id')
      .eq('room_id', this.roomId)
      .neq('user_id', this.currentUserId) // Not me
      .limit(1)
      .single();

    if (latestMsg) {
      const fId = latestMsg.user_id;
      this.friendId.set(fId);
      console.log('Friend identified as:', fId);

      // 2. Fetch their actual profile for the "Aura" and "Mood"
      const { data: profile } = await this.supabase.client
        .from('profiles')
        .select('*')
        .eq('id', fId)
        .single();

      if (profile) {
        this.friendProfile.set(profile);
      }

      // 3. Optional: Listen for their vibe changes live
      this.supabase.client
        .channel(`vibe-${fId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${fId}`,
          },
          (payload) => {
            this.friendProfile.set(payload.new);
          }
        )
        .subscribe();
    }
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
            if (payload.new.user_id !== this.currentUserId) {
              this.playEffect(this.receiveAudio);
            }
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

  // Default wallpaper (can be a color or an image URL)
  public wallpaperUrl: string =
    'https://www.transparenttextures.com/patterns/cubes.png';

  // You could later save this to Supabase so it persists
  setWallpaper(url: string) {
    this.wallpaperUrl = url;
  }
  async sendMessage() {
    if (!this.newMessage.trim()) return;
    const messageContent = this.newMessage;
    this.newMessage = '';
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {
        // Silently fail if testing on a browser that doesn't support vibration
      });
    }
    this.playEffect(this.sendAudio);
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

  // Inside your class

  async updateVibe(newVibe: string) {
    const { error } = await this.supabase.client
      .from('profiles')
      .update({ vibe: newVibe })
      .eq('id', this.currentUserId);

    if (!error) {
      // Play a tiny sound or haptic when vibe changes
      Haptics.impact({ style: ImpactStyle.Light });
      console.log('Vibe updated to:', newVibe);
    }
  }

  changeWallpaper() {
    const custom = prompt('Enter Image URL for Wallpaper:');
    if (custom) {
      this.wallpaperUrl = custom;
      // Fastly store in local storage so it stays when you refresh
      localStorage.setItem('chat-wallpaper', custom);
    }
  }

  async startVideoCall() {
    if (!this.canCall()) return;
    this.playEffect(new Audio(this.SOUNDS.tap));

    const target = this.friendId();
    if (target) {
      // 1. SAVE TO SUPABASE (This triggers the ringing on the other end)
      const { data, error } = await this.supabase.client
        .from('calls')
        .insert({
          caller_id: this.currentUserId,
          receiver_id: target,
          peer_id: this.currentUserId, // We use UserID as PeerID
          status: 'ringing',
        })
        .select()
        .single();

      if (error) {
        console.error('Could not log the call:', error);
        return;
      }

      // 2. START THE PEERJS STREAM
      console.log('Initiating WebRTC call to:', target);
      await this.video.callUser(target);
    }
  }
  async endCall() {
    this.playEffect(new Audio(this.SOUNDS.tap));

    // 1. Stop local camera tracks
    this.video
      .localStream()
      ?.getTracks()
      .forEach((t) => t.stop());

    // 2. Close the PeerJS call
    if (this.video.currentCall) {
      this.video.currentCall.close();
    }

    // 3. Reset UI
    this.video.remoteStream.set(null);
    this.video.localStream.set(null);

    await this.supabase.client
    .from('calls')
    .update({ status: 'ended' })
    .eq('caller_id', this.currentUserId)
    .eq('status', 'ringing'); // Find the active call
  }
}
