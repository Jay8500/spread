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
    // 1. Validation
    if (!this.email || !this.password)
      return alert('Please fill in all fields');
    if (this.isSignUp && !this.username)
      return alert('Please choose a username');

    // 2. Start Loading
    this.isLoading = true;

    try {
      if (this.isSignUp) {
        // --- SIGN UP LOGIC ---
        const { data, error } = await this.supabase.client.auth.signUp({
          email: this.email,
          password: this.password,
          options: { data: { username: this.username } },
        });

        if (error) throw error;
        // 2. If user is created AND email confirmation is OFF, insert the profile
        if (data?.user) {
          const { error: profileError } = await this.supabase.client
            .from('profiles')
            .insert([
              {
                id: data.user.id,
                username: this.username.toLowerCase(),
                displayname: this.username.toLowerCase(),
                email: this.email,
                vibe: 'good', // Set a default vibe immediately!
              },
            ]);

          if (profileError)
            console.error('Error creating profile:', profileError);
        }
        alert('Account created! You can now login.');
        this.isSignUp = false; // Switch UI to Login mode
        this.email = ''; // Clear fields
        this.password = '';
      } else {
        // --- LOGIN LOGIC ---
        let input = (this.email.trim() || '').toLowerCase();
        if (input.startsWith('@')) input = input.substring(1);

        let finalEmail = input;

        // Lookup email if user typed a username
        if (!input.includes('@')) {
          const { data: profile, error: profileError } =
            await this.supabase.client
              .from('profiles')
              .select('email')
              .eq('username', input)
              .maybeSingle();

          if (profileError || !profile) {
            throw new Error(`Username "${input}" not found.`);
          }
          finalEmail = profile.email;
        }

        const { error } = await this.supabase.client.auth.signInWithPassword({
          email: finalEmail,
          password: this.password,
        });

        if (error) throw error;

        // SUCCESS: Navigate away
        this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      // 3. ALWAYS stop loading at the very end
      this.isLoading = false;
    }
  }

  toggleMode() {
    // Force loading to false so buttons are clickable
    this.isLoading = false;
    this.isSignUp = !this.isSignUp;
    // Clear fields
    this.email = '';
    this.password = '';
    this.username = '';
  }

  // 1. Toggle Password Visibility
  togglePassword() {
    this.showPassword = !this.showPassword;
  }
}
