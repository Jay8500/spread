import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonAvatar,
  IonLabel,
  IonList,
  IonItem,
  IonNote,
  IonIcon,
  IonListHeader, // Added this for the section title
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personOutline, mailOutline, calendarOutline } from 'ionicons/icons'; // Added extra icons
import { Supabase } from '../services/supabase';
@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonAvatar,
    IonLabel,
    IonList,
    IonItem,
    IonNote, // Use this in HTML to clear yellow warning
    IonIcon,
    IonListHeader, // Use this in HTML to clear yellow warning
  ],
})
export class Tab2Page {
  userProfile: any = null;

  constructor(private supabase: Supabase) {
    // Register all icons used in the HTML
    addIcons({ personOutline, mailOutline, calendarOutline });
  }

  async ionViewWillEnter() {
    await this.fetchProfile();
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
        // We merge the email from the auth session into the profile
        this.userProfile = {
          ...data,
          email: session.user.email,
        };
      }
    }
  }

  getInitials(username: string): string {
    if (!username) return '?';
    return username[0].toUpperCase();
  }
}
