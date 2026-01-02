import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonButton,
  IonInput,
  IonSpinner,
  IonIcon, // 1. Ensure this is imported from standalone
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eyeOutline, eyeOffOutline } from 'ionicons/icons';
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
    // IonHeader,
    // IonTitle,
    // IonToolbar,
    // IonText,
    IonButton,
    IonInput,
    // IonLoading,
    IonSpinner,
    IonIcon, // Added this
  ],
})
export class LoginPage {
  email = '';
  password = '';
  username = ''; // New field
  isSignUp = false;
  isLoading = false;

  // Add these variables to your component class
  showPassword = false;

  constructor(private supabase: Supabase, private router: Router) {
    addIcons({ eyeOutline, eyeOffOutline });
  }

  async handleAuth() {
    if (!this.email || !this.password)
      return alert('Please fill in all fields');
    if (this.isSignUp && !this.username)
      return alert('Please choose a username');

    this.isLoading = true;

    try {
      if (this.isSignUp) {
        // --- SIGN UP ---
        const { data, error } = await this.supabase.client.auth.signUp({
          email: this.email,
          password: this.password,
          options: { data: { username: this.username } },
        });

        if (error) throw error;

        if (data.user) {
          await this.supabase.client.from('profiles').insert([
            {
              id: data.user.id,
              username: this.username.toLowerCase(),
              email: this.email,
            },
          ]);
        }

        alert('Account created! You can now login.');
        this.isSignUp = false;
      } else {
        // 1. Prepare the input
        let input = (this.email.trim() || '').toLowerCase();
        if (input.startsWith('@')) {
          input = input.substring(1);
        }
        let finalEmail = input; // Default to what was typed

        // 2. Lookup logic if it's a username (no @)
        if (!input.includes('@')) {
          const { data: profile, error: profileError } =
            await this.supabase.client
              .from('profiles')
              .select('email')
              .eq('username', input.toLowerCase())
              .maybeSingle();

          if (profileError || !profile) {
            this.isLoading = false;
            return alert(`Username "${input}" not found.`);
          }
          finalEmail = profile.email;
          console.log('Found email for login:', finalEmail);
        }
        const { error } = await this.supabase.client.auth.signInWithPassword({
          email: finalEmail,
          password: this.password,
        });

        if (error) throw error;
        this.isLoading = false;
        // Navigate only if successful
        // setTimeout(() => {
        //   this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
        // }, 100);
      }
    } catch (err: any) {
      this.isLoading = false;
      alert(err.message);
    } finally {
      // THIS IS THE KEY: This runs every single time,
      // ensuring the "Authenticating" overlay turns off.
      setTimeout(() => {
        this.isLoading = false;
      }, 200); // We add a 200ms delay to let the Ionic animation finish
    }
    this.isLoading = false;
  }

  toggleMode() {
    this.isSignUp = !this.isSignUp;
    // Clear fields when switching for a better user experience
    this.email = '';
    this.password = '';
    this.username = '';
  }

  // 1. Toggle Password Visibility
  togglePassword() {
    this.showPassword = !this.showPassword;
  }
}
