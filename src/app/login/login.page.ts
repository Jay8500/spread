import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
  IonLoading,
  IonSpinner,
} from '@ionic/angular/standalone';
import { Supabase } from '../services/supabase';
@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    // IonText,
    IonButton,
    IonInput,
    IonLoading,
    IonSpinner,
  ],
})
export class LoginPage {
  email = '';
  password = '';
  username = ''; // New field
  isSignUp = false;
  isLoading = false;

  constructor(private supabase: Supabase, private router: Router) {}

  async handleAuth() {
    if (!this.email || !this.password)
      return alert('Please fill in all fields');
    if (this.isSignUp && !this.username)
      return alert('Please choose a username');

    this.isLoading = true;

    try {
      if (this.isSignUp) {
        // 1. SIGN UP
        const { data, error } = await this.supabase.client.auth.signUp({
          email: this.email,
          password: this.password,
          options: {
            data: { username: this.username }, // Store username in metadata
          },
        });

        if (error) throw error;

        // 2. CREATE PROFILE RECORD (CRITICAL FOR CHAT)
        if (data.user) {
          const { error: profileError } = await this.supabase.client
            .from('profiles')
            .insert([
              {
                id: data.user.id,
                username: this.username.toLowerCase(),
                email: this.email,
              },
            ]);

          if (profileError)
            console.error('Profile creation error:', profileError);
        }

        alert('Account created! Please login.');
        this.isSignUp = false; // Switch to login view
      } else {
        // LOGIN
        const { error } = await this.supabase.client.auth.signInWithPassword({
          email: this.email,
          password: this.password,
        });
        if (error) throw error;
        this.router.navigate(['/tabs/tab1'], { replaceUrl: true });
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      this.isLoading = false;
    }
  }
}
