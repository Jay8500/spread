import { Component, OnInit } from '@angular/core';
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
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['../login/login.page.scss'],
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
export class SignupPage implements  OnInit {
email = '';
  password = '';
  username = '';
  isLoading = false;
  showPassword = false;

  constructor(private supabase: Supabase, private router: Router) {
    addIcons({ eyeOutline, eyeOffOutline });
  }
  ngOnInit(): void {
    throw new Error('Method not implemented.');
  }

  async handleSignup() {
    if (!this.email || !this.password || !this.username) return alert('Fill all fields');
    this.isLoading = true;

    try {
      const { data, error } = await this.supabase.client.auth.signUp({
        email: this.email,
        password: this.password,
        options: { data: { username: this.username } },
      });

      if (error) throw error;

      if (data?.user) {
        await this.supabase.client.from('profiles').insert([{
          id: data.user.id,
          username: this.username.toLowerCase(),
          email: this.email,
          vibe: 'new_staff' 
        }]);
      }
      
      alert('Account created! Please login.');
      this.router.navigateByUrl('/login');
    } catch (err: any) {
      alert(err.message);
    } finally {
      this.isLoading = false;
    }
  }
  togglePassword() {
    this.showPassword = !this.showPassword;
  }
}
