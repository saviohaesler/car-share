# car-share

A shared-car logbook app: manage multiple vehicles, log trips, plan reservations on a calendar, and track fuel/mileage stats per car — including invite links for new members.

## Features

- **Google sign-in** (Firebase Auth)
- **Multiple cars** with member management and per-person color coding
- **Trip log** with odometer tracking
- **Calendar** for reservations
- **Statistics** on mileage, fuel-ups, and consumption per car
- **Invite links** (valid for 7 days, token-based)
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
```

The values come from the web app config in your Firebase project settings.

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
