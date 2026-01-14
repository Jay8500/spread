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
      
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        
        // --- NEW LOGIC START ---
        // Check if there is a token waiting to be uploaded
        const pendingToken = localStorage.getItem('pending_fcm_token');
        if (pendingToken) {
          console.log('Found pending token, uploading now...');
          await this.supabase.updateFcmToken(pendingToken);
          // localStorage.removeItem('pending_fcm_token'); // Clean up is usually handled inside updateFcmToken
        }
        // --- NEW LOGIC END ---

        const currentPath = window.location.pathname;
        if (this.isAtRoot(currentPath)) {
          await this.router.navigateByUrl('/tabs/tab1', { replaceUrl: true });
        }
        this.safeHideSplash();
      }
      // ... rest of your code
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
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') return;

      await PushNotifications.register();

      // 1. Success Listener (You already have this)
      PushNotifications.addListener('registration', async (token) => {
        console.log('FCM Token generated');
        const { data: { session } } = await this.supabase.client.auth.getSession();
        if (session?.user) {
          await this.supabase.updateFcmToken(token.value);
        } else {
          localStorage.setItem('pending_fcm_token', token.value);
        }
      });

      // 2. ERROR LISTENER (ADD THIS!)
      // This will tell you if the APK is failing on specific phones
      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Push registration error: ', JSON.stringify(error));
        // Often returns "SERVICE_NOT_AVAILABLE" if Play Services are missing
      });

      // 3. REFRESH LISTENER (ADD THIS!)
      // If the token changes while the app is running
      PushNotifications.addListener('registration', async (token) => {
        await this.supabase.updateFcmToken(token.value);
      });

      // Listener for Notifications
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ', notification);
      });
    }
  }
