import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { PushNotifications } from '@capacitor/push-notifications';
import { Router } from '@angular/router'; // Add this
import { Supabase } from './services/supabase';
import { Capacitor } from '@capacitor/core';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  constructor(private supabase: Supabase, private router: Router) {}
  ngOnInit() {
    this.listenToAuth(); // Start watching the user status
    this.setupPush();
  }

  listenToAuth() {
    this.supabase.authChanges((event: any, session: any) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        // 1. Check the ACTUAL browser URL
        const currentPath = window.location.pathname;

        // 2. LOGIC: If the user is ALREADY inside the tabs or chat, DON'T move them.
        // We only move them to /tabs/tab1 if they are on /login or /
        if (
          currentPath === '/login' ||
          currentPath === '/' ||
          currentPath === ''
        ) {
          console.log('User is at login/root, moving to Tab 1');
          this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
        } else {
          console.log(
            'User is already at:',
            currentPath,
            'keeping them there.'
          );
        }
      }

      if (event === 'SIGNED_OUT') {
        this.router.navigateByUrl('/login', { replaceUrl: true });
      }
    });
  }

  async setupPush() {
    // 3. Add this check to stop the "Plugin not implemented" error on Web
    if (Capacitor.getPlatform() === 'web') {
      console.log('Push Notifications skipped: Running on Web');
      return;
    }

    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);

      // Wait a second to make sure the session is active
      const {
        data: { session },
      } = await this.supabase.client.auth.getSession();

      if (session?.user) {
        // If user is logged in, save it!
        await this.supabase.updateFcmToken(token.value);
        console.log('FCM Token synced to Supabase for user:', session.user.id);
      } else {
        console.log(
          'Token received but no user logged in yet. Will save on sign-in.'
        );
        // Optional: Store token in localStorage to save it once they log in
        localStorage.setItem('pending_fcm_token', token.value);
      }
    });
    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        console.log('Push received: ', notification);
      }
    );
  }
}
