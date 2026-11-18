# Building & Running the Android `.apk` Locally in Android Studio

**My World** is configured with **Capacitor** (`capacitor.config.ts`) and a pre-generated `android/` Gradle project so you can compile an Android `.apk` locally and install it on your mobile device.

---

## Prerequisites (Local Machine)
- **Node.js 20+**
- **Android Studio** (with Android SDK & Java JDK 17+ bundled)

---

## 1. Enable Email & Password Sign-In for the Mobile APK
**My World** includes a Firebase Authentication sign-in gate (project `crested-carver-k7cdj`) supporting **Email & Password** and **Google Sign-In**:

- **Important for Capacitor Android APK:** Android WebView blocks web OAuth popups (`signInWithPopup`) used by Google Sign-In. Inside the installed APK on your phone, use **Email & Password** to sign up or sign in.
- **One-Time Firebase Console Setup:**
  1. Open the [Firebase Console](https://console.firebase.google.com/) and select project **`crested-carver-k7cdj`**.
  2. Go to **Build → Authentication → Sign-in method**.
  3. Click **Add new provider → Email/Password**, toggle **Enable** on, and click **Save**.
  4. Under **Authentication → Settings → Authorized domains**, confirm `localhost` is listed (Capacitor serves the APK under `https://localhost`).
- **Email Verification:** Newly created Email/Password accounts receive a verification email automatically. All local sanctuary modules work right away; click **I’ve Verified** in the top banner after confirming your email to sync your profile record.

---

## 2. Configure `VITE_API_BASE_URL` (For Gemini AI Features)
- **Offline-first modules** work inside the APK without any backend URL:
  - Personal Notes, Secrets & Passwords Vault (AES-256), Motivational Quotes, Tasks & Reminders, Birthdays, Private Gallery, Calendar, Alarms & **Custom Uploaded Audio/Ringtones**, Creative Ideas Hub, Event Calm Mode, Soundscapes, Analytics, and Stillwater Lanterns.
- **Gemini AI features** (*Gemini Companion*, *Live Voice Sanctuary*, and *Audio Transcription*) route through your deployed Express backend (`server.ts`) so your `GEMINI_API_KEY` stays off the device.

Create a `.env` file in the project root on your computer (no trailing slash):

```env
VITE_API_BASE_URL=https://my-world-appify.ai.studio
```

*(You can replace this with your own deployed Cloud Run / Render / Railway backend URL anytime. Leave it empty if you only want the offline modules.)*

---

## 3. Build, Sync & Generate the `.apk`

1. **Install dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```
   *(If you pull updates that add Capacitor plugins such as `@capacitor/app`, `@capacitor/local-notifications`, or `@capacitor/share`, always re-run `npm install --legacy-peer-deps` and `npm run cap:sync` before rebuilding in Android Studio.)*

2. **Build the web bundle and sync into Android:**
   *(If `android/` does not exist yet, run `npm run cap:add-android` first.)*
   ```bash
   npm run cap:sync
   ```
   *(Every time you edit `.env`, Capacitor plugins, or frontend files, re-run `npm run cap:sync` so `dist/` and native plugins are rebuilt and synced into `android/`.)*

3. **Open the `android/` subfolder in Android Studio:**
   ```bash
   npm run cap:open
   ```
   *(If you open it manually in Android Studio, click **File → Open...** and select the **`android`** subfolder inside your project — **NOT** the outer root folder containing `package.json`. Opening the outer folder prevents Android Studio from showing the **Build → Build Bundle(s) / APK(s)** menu.)*

4. **Compile the `.apk`:**
   - Look at the bottom-right status bar in Android Studio and **wait for Gradle sync / indexing to finish** (the **Build APK(s)** option stays hidden until Gradle finishes syncing).
   - Once synced, select **Build → Build Bundle(s) / APK(s) → Build APK(s)** (for testing) or **Build → Generate Signed Bundle / APK...** (for release).
   - **If you still don't see Build APK(s)** (for example, `android/build.gradle` or `android/gradlew.bat` is missing from a downloaded zip):
     Run this in your project root terminal (PowerShell on Windows) to regenerate `android/` while keeping your permissions:
     ```powershell
     Copy-Item android\app\src\main\AndroidManifest.xml .\AndroidManifest.xml.bak
     Remove-Item -Recurse -Force android
     npm run cap:add-android
     Move-Item -Force .\AndroidManifest.xml.bak android\app\src\main\AndroidManifest.xml
     npm run cap:sync
     ```
     Then close the project in Android Studio and open the **`android`** subfolder again (**File → Open... → select `android`**).
   - Or build directly from the terminal inside `android/`:
     - **macOS / Linux:** `./gradlew assembleDebug`
     - **Windows:** `.\gradlew.bat assembleDebug`
   - Output APK path:
     `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 4. Pre-Configured Android Permissions & Behavior
`android/app/src/main/AndroidManifest.xml` already includes:
- `INTERNET` (Firebase Auth, Gemini backend calls, Google Maps)
- `POST_NOTIFICATIONS`, `VIBRATE`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED` (Android status bar & notification drawer pop-ups for Alarms, Smart Reminders, and Event Calm check-ins)
- `RECORD_AUDIO` & `MODIFY_AUDIO_SETTINGS` (Live Voice Sanctuary & Audio Transcription)
- `ACCESS_COARSE_LOCATION` & `ACCESS_FINE_LOCATION` (Sanctuary Maps near-me & navigation)
- `WAKE_LOCK` (Audio / Soundscapes stability)

### Custom Audio, Notifications & Navigation on Mobile
- **Android System Notifications & Action Buttons:** Smart Reminders, Alarms, and Event Calm check-ins post single, deduplicated Android status bar & heads-up drawer notifications (including custom notification channels) even when minimized on your home screen. Active Alarms post the notification first and then ring, showing **`▶ <Alarm Name>`**, any optional description, and direct **`Snooze 5m`** / **`Dismiss`** action buttons inside the notification drawer, and automatically stop ringing and snooze for 5 minutes after 1 minute if no action is taken. Grant notification permission when prompted on first launch (Android 13+).
- **Profile, Theme & Notification Bell:** Tap your profile avatar/name in the Home header (or the Settings icon on other tabs) to edit your **Preferred Greeting Name**, switch between **Dark Mode** and **Light Mode**, export a local JSON backup, change default chimes, or Sign Out. Tap the **Notification Bell** icon to review any alerts or alarms that arrived or were missed while away.
- **Android Back Button & Security Auto-Lock:** Pressing Android's hardware/gesture Back closes open drawers/overlays or returns cleanly to the previous view / Home instead of closing the app prematurely. Leaving **Secrets Vault** or **Private Gallery** (to Explore Hub or another screen) immediately re-locks them until unlocked with your Master PIN again.
- **Custom Ringtones & Sounds:** Audio files uploaded in **Alarms** or **Tasks & Reminders** (`MP3`, `WAV`, `M4A`, `OGG`, `AAC`, `FLAC`, up to 25 MB) are saved locally in IndexedDB inside the app.

### Privacy & Data Storage Summary
- **Stays 100% Local on Your Phone:** Vault secrets (AES-256 encrypted), Private Gallery photos/videos, Personal Notes, Tasks, Birthdays, Calendar, Alarms, Custom Audio files, Soundscapes, and Analytics live strictly in local IndexedDB / `localStorage` and are never uploaded to Firestore.
- **Cloud Footprint:** Only your Firebase Auth account and basic user profile (`uid`, `displayName`, `email`, `photoUrl`, timestamps) connect to Firebase; Gemini prompts/audio go to your configured `VITE_API_BASE_URL` only when you actively use AI features; Maps loads when opening Sanctuary Maps.
- **Note on `allowBackup`:** `android/app/src/main/AndroidManifest.xml` currently retains Capacitor's default `android:allowBackup="true"`. If you later create a strictly zero-cloud offline fork, change it to `android:allowBackup="false"` so Android Auto Backup never retains local app data.
