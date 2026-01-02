import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { PushNotifications } from '@capacitor/push-notifications';
import { Router } from '@angular/router'; // Add this
import { Supabase } from './services/supabase';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  constructor(private supabase: Supabase, private router: Router) {}
  async ngOnInit() {
    // 1. Initialize Auth and Routing
    this.listenToAuth();

    // 2. Setup Push Notifications (only if not on Web)
    if (Capacitor.getPlatform() !== 'web') {
      await this.setupPush();
    }
  }

  private listenToAuth() {
    this.supabase.authChanges(async (event: any, session: any) => {
      console.log('Auth Event:', event);

      // Handle Signed In or Initial Session with a user
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        const currentPath = window.location.pathname;

        if (this.isAtRoot(currentPath)) {
          await this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
        }
        this.safeHideSplash();
      }

      // Handle Signed Out or Initial Session without a user
      else if (
        event === 'SIGNED_OUT' ||
        (event === 'INITIAL_SESSION' && !session)
      ) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        this.safeHideSplash();
      }
    });
  }

  /**
   * Validation: Only hide splash screen if running on native device
   * and after navigation has been determined.
   */
  private async safeHideSplash() {
    if (Capacitor.getPlatform() !== 'web') {
      // Small delay ensures the Angular view has rendered behind the splash
      setTimeout(async () => {
        await SplashScreen.hide({
          fadeOutDuration: 400, // Smooth fade out for a premium feel
        });
      }, 500);
    }
  }

  private isAtRoot(path: string): boolean {
    return (
      path === '/login' || path === '/' || path === '' || path === '/undefined'
    );
  }

  async setupPush() {
    // Permission and Registration Logic
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') return;

    await PushNotifications.register();

    // Listener for Registration
    PushNotifications.addListener('registration', async (token) => {
      const {
        data: { session },
      } = await this.supabase.client.auth.getSession();
      if (session?.user) {
        await this.supabase.updateFcmToken(token.value);
      } else {
        localStorage.setItem('pending_fcm_token', token.value);
      }
    });

    // Listener for Notifications
    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        console.log('Push received: ', notification);
      }
    );
  }
}
