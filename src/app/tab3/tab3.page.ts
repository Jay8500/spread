import { Component } from '@angular/core';
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
} from '@ionic/angular/standalone';
@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
  ],
})
export class Tab3Page {
  constructor(private supabase: Supabase, private router: Router) {}

  async signOut() {
    await this.supabase.client.auth.signOut();
    // After logout, send them to login page and clear history
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
