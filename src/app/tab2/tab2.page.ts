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
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import {
  calendarClearOutline,
  shieldCheckmarkOutline,
  camera,
  logOutOutline,
} from 'ionicons/icons'; 
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
    // IonNote,
    IonIcon,
    IonSpinner,
  ],
})
export class Tab2Page {
  appVersion: string = '';
  userProfile: any = null;
  isUploading = false;

  constructor(private supabase: Supabase, private router: Router) {
    addIcons({ 
      calendarClearOutline, 
      shieldCheckmarkOutline, 
      camera, 
      logOutOutline 
    });
  }

  async loadAppInfo() {
    try {
      const info = await App.getInfo();
      this.appVersion = info.version || '1.0.0';
    } catch (error) {
      this.appVersion = '1.0.0';
    }
  }

  async ionViewWillEnter() {
    await this.loadAppInfo();
    await this.fetchProfile();
  }

  async fetchProfile() {
    const { data: { session } } = await this.supabase.client.auth.getSession();
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

  getInitials(username: string): string {
    return username ? username[0].toUpperCase() : '?';
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file || file.size > 2 * 1024 * 1024) {
      alert('Max 2MB allowed.');
      return;
    }

    this.isUploading = true;
    try {
      const userId = this.userProfile.id;
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await this.supabase.client.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = this.supabase.client.storage.from('avatars').getPublicUrl(filePath);

      const { error: updateError } = await this.supabase.client
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);
        
      if (updateError) throw updateError;
      this.userProfile.avatar_url = `${publicUrl}?t=${new Date().getTime()}`;
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      this.isUploading = false;
    }
  }

  async signOut() {
    await this.supabase.client.auth.signOut();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}