import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

// Versendet Web-Push-Nachrichten an die Abos der anderen Mitglieder.
// Der Client sammelt die Empfänger-Abos selbst aus Firestore (dort per Rules
// auf Mitglieder beschränkt); diese Route signiert nur mit dem geheimen
// VAPID-Key und baut den Nachrichtentext aus einer festen Vorlage - beliebige
// Texte können hier nicht eingeschleust werden.

export const runtime = "nodejs";

const EVENT_TEXT: Record<string, { verb: string; path: string }> = {
  drive: { verb: "hat eine Fahrt eingetragen", path: "log" },
  fuel: { verb: "hat getankt", path: "log" },
  reservation: { verb: "hat einen Kalendereintrag erstellt", path: "calendar" },
};

const MAX_SUBSCRIPTIONS = 50;

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

// Prüft das Firebase-ID-Token über die Identity-Toolkit-REST-API - so ist
// kein Service-Account nötig, aber nur angemeldete Nutzer dieses
// Firebase-Projekts können die Route verwenden.
async function verifyIdToken(idToken: string): Promise<boolean> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return false;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.users?.[0]?.localId);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "Push ist nicht konfiguriert." }, { status: 500 });
  }

  const idToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!idToken || !(await verifyIdToken(idToken))) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const { type, carId, carName, actorName, detail, subscriptions } =
    (body ?? {}) as Record<string, unknown>;

  const eventText = typeof type === "string" ? EVENT_TEXT[type] : undefined;
  if (!eventText) {
    return NextResponse.json({ error: "Unbekannter Ereignistyp." }, { status: 400 });
  }
  if (typeof carId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(carId)) {
    return NextResponse.json({ error: "Ungültige Auto-ID." }, { status: 400 });
  }
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return NextResponse.json({ error: "Keine Empfänger." }, { status: 400 });
  }

  const validSubs = subscriptions
    .slice(0, MAX_SUBSCRIPTIONS)
    .filter(
      (s): s is { endpoint: string; keys: { p256dh: string; auth: string } } =>
        typeof s?.endpoint === "string" &&
        s.endpoint.startsWith("https://") &&
        typeof s?.keys?.p256dh === "string" &&
        typeof s?.keys?.auth === "string"
    );
  if (validSubs.length === 0) {
    return NextResponse.json({ error: "Keine gültigen Empfänger." }, { status: 400 });
  }

  const cleanCarName = cleanText(carName, 100) || "CarShare";
  const cleanActor = cleanText(actorName, 100) || "Jemand";
  const cleanDetail = cleanText(detail, 200);

  const payload = JSON.stringify({
    title: cleanCarName,
    body: `${cleanActor} ${eventText.verb}${cleanDetail ? `: ${cleanDetail}` : ""}`,
    url: `/${carId}/${eventText.path}`,
  });

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const results = await Promise.allSettled(
    validSubs.map((sub) =>
      webpush.sendNotification(sub, payload, { TTL: 24 * 60 * 60, urgency: "high" })
    )
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;

  return NextResponse.json({ ok: true, sent, failed: results.length - sent });
}
