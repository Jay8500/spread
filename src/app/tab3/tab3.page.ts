import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Supabase } from '../services/supabase';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  IonAvatar,
  IonNote,
} from '@ionic/angular/standalone';
import { App } from '@capacitor/app'; // 1. Import the App plugin
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonAvatar,
    IonNote,
    IonIcon,
  ],
})
export class Tab3Page implements OnInit {
  appVersion: string = '';
  userProfile: any = null;
  constructor(private supabase: Supabase, private router: Router) {
    addIcons({ logOutOutline });
  }

  async ngOnInit() {
    this.loadAppInfo();
    this.loadUserData();
  }
  async loadAppInfo() {
   try {
    const info = await App.getInfo();
    console.log('App Info received:', info); // Check your console for this!
    
    // If testing on Web, sometimes info.version is undefined
    this.appVersion = info.version || '1.0.0-web'; 
  } catch (error) {
    console.error('Error getting app info:', error);
    this.appVersion = '1.0.0-dev'; // Fallback
  }
  }

  async loadUserData() {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (user) {
      const { data } = await this.supabase.client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      this.userProfile = data;
    }
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  }

  async signOut() {
    await this.supabase.client.auth.signOut();
    // After logout, send them to login page and clear history
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
