# Building the Android `.apk` Locally in Android Studio

**My World** is configured with **Capacitor** (`capacitor.config.ts`) and an `android/` Gradle project so you can compile an Android `.apk` on your own machine.

## Prerequisites (Local Machine)
- **Node.js 20+**
- **Android Studio** (with Android SDK & Java JDK 17+ bundled)

## Step-by-Step Build Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **(Optional) Enable Gemini AI features inside the standalone APK:**
   Local-first modules (Personal Notes, Encrypted Vault, Quotes, Tasks, Birthdays, Private Gallery, Calendar, Alarms, Creative Ideas, Soundscapes, Analytics, and Stillwater Lanterns) run 100% offline inside the APK.

   To also connect **Gemini Companion**, **Live Voice Sanctuary**, and **Audio Transcription** from inside the APK, set `VITE_API_BASE_URL` to your deployed **My World** Express server URL before building:
   ```bash
   VITE_API_BASE_URL="https://your-deployed-server-url" npm run cap:sync
   ```
   If you only want the offline sanctuary features, run:
   ```bash
   npm run cap:sync
   ```

3. **Create the `android/` project (if not already present) and sync assets:**
   ```bash
   npx cap add android
   npm run cap:sync
   ```

4. **Open in Android Studio:**
   ```bash
   npm run cap:open
   ```
   Or open the `android/` folder directly inside Android Studio.

5. **Build the `.apk`:**
   - In Android Studio, wait for Gradle sync to finish.
   - Choose **Build → Build Bundle(s) / APK(s) → Build APK(s)** (for a debug APK) or **Build → Generate Signed Bundle / APK...** (for release).
   - Alternatively, build from the terminal inside `android/`:
     ```bash
     ./gradlew assembleDebug
     ```
     The generated APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.
