# car-share

A shared-car logbook app: manage multiple vehicles, log trips, plan reservations on a calendar, and track fuel/mileage stats per car — including invite links for new members.

**Live Demo:** [https://carshare.lazolab.com](https://carshare.lazolab.com)

## Features

- **Google sign-in** (Firebase Auth)
- **Multiple cars** with member management and per-person color coding
- **Trip log** with odometer tracking
- **Calendar** for reservations
- **Statistics** on mileage, fuel-ups, and consumption per car
- **Invite links** (valid for 7 days, token-based)
- **Push notifications** (Web Push) when someone logs a trip, adds a calendar entry, or refuels — works on iPhone as an installed home-screen web app (iOS 16.4+)
- Dark/light mode

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Firebase](https://firebase.google.com) — Authentication & Firestore
- Tailwind CSS

## Setup

### 1. Clone & install dependencies

```bash
git clone https://github.com/saviohaesler/CarShare.git
cd car-share
npm install
```

### 2. Firebase project

1. Create a project in the [Firebase Console](https://console.firebase.google.com/)
2. **Authentication** → enable Google as a sign-in provider
3. Create a **Firestore Database**
4. Under *Project settings*, register a new web app and copy the config values

### 3. Environment variables

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Web Push (VAPID) — generate with: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

The Firebase values come from the web app config in your Firebase project settings. The VAPID key pair signs the Web Push messages sent by the `/api/notify` route handler; keep `VAPID_PRIVATE_KEY` secret.

### Push notifications

Enable the toggle under **Profile → Benachrichtigungen**. On iPhone the site must first be installed via Safari **Share → Add to Home Screen** and opened from there (iOS 16.4+). Notifications are sent to the other car members when someone logs a trip, creates a calendar entry, or records a fuel stop.

### 4. Deploy Firestore security rules

The server-side access rules live in [`firestore.rules`](firestore.rules) and **must be deployed** so that membership/owner checks are enforced server-side, not just on the client:

```bash
npm install -g firebase-tools   # if not already installed
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules
```

Without deployed rules, any signed-in user can read and write arbitrary data.

### 5. Start the dev server

```bash
npm run dev
```

Open the app at [http://localhost:3000](http://localhost:3000).

## Invites

Invite links contain a random token from the `invites` collection and are valid for 7 days. Old links in the `/invite/{carId}` format no longer work for joining (existing members are still redirected correctly). Optionally, a [TTL policy](https://firebase.google.com/docs/firestore/ttl) can be set on `invites.expiresAt` in the Firebase Console to automatically delete expired invites.

## Deployment

Easiest via [Vercel](https://vercel.com/new) — the environment variables from step 3 need to be configured there as well.
