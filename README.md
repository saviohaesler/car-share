# CarShare

Fahrtenbuch-App für gemeinsam genutzte Autos: mehrere Fahrzeuge verwalten, Fahrten protokollieren, Reservierungen im Kalender planen und Tank-/Kilometerstatistiken pro Auto einsehen — inklusive Einladungslinks für neue Mitglieder.

## Features

- **Google-Login** (Firebase Auth)
- **Mehrere Autos** mit Mitgliederverwaltung und individueller Farbzuordnung pro Person
- **Fahrtenbuch** mit Kilometerstand-Tracking
- **Kalender** für Reservierungen
- **Statistiken** zu Kilometern, Tankfüllungen und Verbrauch je Auto
- **Einladungslinks** (7 Tage gültig, tokenbasiert)
- Dark-/Light-Mode

## Tech-Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Firebase](https://firebase.google.com) — Authentication & Firestore
- Tailwind CSS

## Setup

### 1. Repository & Dependencies

```bash
git clone https://github.com/saviohaesler/CarShare.git
cd CarShare
npm install
```

### 2. Firebase-Projekt

1. Projekt in der [Firebase Console](https://console.firebase.google.com/) anlegen
2. **Authentication** → Google als Anbieter aktivieren
3. **Firestore Database** anlegen
4. Unter *Projekteinstellungen* eine neue Web-App registrieren und die Config-Werte kopieren

### 3. Umgebungsvariablen

`.env.local` im Projektroot anlegen:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Die Werte stammen aus der Web-App-Config in den Firebase-Projekteinstellungen.

### 4. Firestore Security Rules deployen

Die serverseitigen Zugriffsregeln liegen in [`firestore.rules`](firestore.rules) und **müssen deployed werden**, damit Mitgliedschafts- und Owner-Checks nicht nur im Client, sondern auch auf dem Server gelten:

```bash
npm install -g firebase-tools   # falls noch nicht installiert
firebase login
firebase use <projekt-id>
firebase deploy --only firestore:rules
```

Ohne deployte Regeln kann jeder angemeldete Nutzer beliebige Daten lesen und schreiben.

### 5. Entwicklungsserver starten

```bash
npm run dev
```

App unter [http://localhost:3000](http://localhost:3000) öffnen.

## Einladungen

Einladungslinks enthalten einen zufälligen Token aus der `invites`-Collection und sind 7 Tage gültig. Alte Links im Format `/invite/{carId}` funktionieren für den Beitritt nicht mehr (bestehende Mitglieder werden weiterhin korrekt weitergeleitet). Optional kann in der Firebase Console eine [TTL-Policy](https://firebase.google.com/docs/firestore/ttl) auf `invites.expiresAt` gesetzt werden, damit abgelaufene Einladungen automatisch gelöscht werden.

## Deployment

Am einfachsten über [Vercel](https://vercel.com/new) — die Umgebungsvariablen aus Schritt 3 müssen dort ebenfalls hinterlegt werden.
