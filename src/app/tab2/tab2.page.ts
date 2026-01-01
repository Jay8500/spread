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
  IonListHeader,
  IonSpinner, // Added this for the section title
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personOutline,
  mailOutline,
  calendarOutline,
  camera,
} from 'ionicons/icons'; // Added extra icons
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
    IonSpinner,
    IonListHeader, // Use this in HTML to clear yellow warning
  ],
})
export class Tab2Page {
  userProfile: any = null;
  isUploading = false; // Track upload state

  constructor(private supabase: Supabase) {
    // Register all icons used in the HTML
    addIcons({ personOutline, mailOutline, calendarOutline, camera });
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

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate size (e.g., 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image is too large. Max 2MB.');
      return;
    }

    this.isUploading = true;
    try {
      const userId = this.userProfile.id;
      const fileExt = file.name.split('.').pop();
      // CHANGE 1: Simplify filename
      const fileName = `${Math.random()}.${fileExt}`;

      // CHANGE 2: Create a folder structure: "userId/fileName"
      // This matches the SQL policy: (storage.foldername(name))[1] = auth.uid()
      const filePath = `${userId}/${fileName}`;
      // 1. Upload to Supabase Storage
      const { error: uploadError } = await this.supabase.client.storage
        .from('avatars') // Ensure this bucket is created in Supabase
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const {
        data: { publicUrl },
      } = this.supabase.client.storage.from('avatars').getPublicUrl(filePath);

      // 3. Update Profiles Table
      // 3. Update Profiles Table
      const { error: updateError } = await this.supabase.client
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);
      if (updateError) throw updateError;

      // 4. Update UI instantly
      this.userProfile.avatar_url = `${publicUrl}?t=${new Date().getTime()}`;
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      this.isUploading = false;
    }
  }
}
