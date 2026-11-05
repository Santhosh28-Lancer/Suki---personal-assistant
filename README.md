<div align="center">

# 💙 Suki

### Your personal companion

A mobile assistant focused on private, on-device records, everyday productivity, and optional AI-powered assistance.

**Built by [Phanthom](https://github.com/Santhosh28-Lancer)**

[Repository](https://github.com/Santhosh28-Lancer/Suki---personal-assistant) · [Developer Profile](https://github.com/Santhosh28-Lancer)

</div>

---

## ✨ About Suki

Suki is an Android-first personal assistant built with React Native, Expo, TypeScript, and native Android modules.

The current implementation combines a conversational interface with practical tools for managing personal expenses and notes. Local records are stored on the device, while selected online features can use a separately deployed backend.

The project is under active development. Features marked as planned are not yet implemented.

## 🚀 Current features

- **Personal chat interface** — a conversational home screen with offline responses for a small set of common prompts.
- **Expense records** — capture and manage expense entries locally.
- **Notes** — save and manage personal notes on the device.
- **Local database** — SQLite-backed storage for expense and note records.
- **Data export** — export expenses and notes as Excel (.xlsx) or CSV, with date-range options.
- **Voice input** — speech-recognition integration for voice interaction.
- **Image capture and text recognition** — capture an image, detect readable text, and hand it to a compatible visual-search app.
- **PDF selection** — select a PDF for optional online analysis through a configured backend.
- **Android integration** — native Kotlin PDF-picker module and custom launcher/splash assets.

## 🧰 Technology stack

| Area | Technology |
|---|---|
| Mobile framework | React Native |
| App platform and tooling | Expo SDK 58 |
| Language | TypeScript |
| Android native code | Kotlin |
| Navigation | Expo Router |
| Local storage | Expo SQLite |
| Voice | Expo Speech Recognition |
| Image text recognition | Google ML Kit Text Recognition |
| Data export | SheetJS (xlsx) |
| Icons | Lucide React Native |

## 📱 Platform

The project configuration includes Android, iOS, and web targets. The custom native PDF-picker module is Android-specific, so native functionality should be validated separately on each platform.

Android application ID:

`com.sukiai.app`

## 🛠️ Getting started

### Requirements

- Node.js and npm
- Git
- Android Studio and Android SDK for Android builds
- A compatible Java Development Kit for the installed Android Gradle Plugin

### Install dependencies

Clone the repository:

```bash
git clone https://github.com/Santhosh28-Lancer/Suki---personal-assistant.git
cd Suki---personal-assistant
npm install
```

### Start the development server

```bash
npx expo start
```

For Android:

```bash
npx expo run:android
```

This project includes native Android code. Use a development build or a locally built native app for features that require those native modules; Expo Go alone is not sufficient for custom native modules.

### Validate the TypeScript project

```bash
npm run typecheck
```

## 🌐 Optional online AI and PDF analysis

Offline expense and note management does not require an AI backend.

Online chat and PDF analysis require a separately deployed backend. Configure the public app endpoint using an environment variable:

```env
EXPO_PUBLIC_API_URL=https://your-backend.example.com/chat
```

Use your actual HTTPS backend URL. Do not commit API keys, private credentials, or production secrets to this repository. Keep secrets on the backend, not in the mobile app.

PDF analysis sends the selected PDF to the configured backend for processing. It is **not** performed entirely on-device. The app asks for confirmation before uploading the document.

## 🗺️ Development roadmap

These are future milestones, not claims about features already shipped:

- Persistent chat history
- Long-term personal memory
- Android app-usage awareness and permission handling
- More capable context-aware AI conversations
- Further accessibility, reliability, and UI refinements

## 🔐 Privacy notes

- Expense and note records are stored locally using SQLite.
- Online chat requires the configured backend.
- PDF analysis uploads the selected document to that backend after user confirmation.
- Avoid placing secrets or private credentials in source code or committed environment files.

Review the app's permissions and backend configuration before using it with sensitive information.

## 👤 Author

**Phanthom** — [@Santhosh28-Lancer](https://github.com/Santhosh28-Lancer)

Explore more projects: [github.com/Santhosh28-Lancer](https://github.com/Santhosh28-Lancer)

---

<div align="center">

Made with 💙 by **Phanthom**

</div>
