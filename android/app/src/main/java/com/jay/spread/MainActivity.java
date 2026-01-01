package com.jay.spread; // 1. Updated to match your App ID

import android.os.Bundle; // 2. Required for onCreate
import androidx.core.splashscreen.SplashScreen; // 3. Required for the splash screen
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 4. This line prevents the crash! It must come BEFORE super.onCreate
        SplashScreen.installSplashScreen(this);
        
        super.onCreate(savedInstanceState);
    }
}