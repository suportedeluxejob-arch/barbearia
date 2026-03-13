import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// ─── Helper: send push to a user by their Firestore userId ──────────────────
async function sendPushToUser(
  userId: string,
  title: string,
  body: string
): Promise<void> {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return;
    const token = userDoc.data()?.fcmToken;
    if (!token) return;

    await messaging.send({
      token,
      notification: { title, body },
      android: {
        notification: {
          sound: "default",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      apns: {
        payload: {
          aps: { sound: "default" },
        },
      },
      webpush: {
        notification: {
          icon: "/pwa-192x192.png",
          badge: "/pwa-64x64.png",
        },
      },
    });
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

// ─── Helper: send push to a barber by their barberId ────────────────────────
async function sendPushToBarber(
  barberId: string,
  title: string,
  body: string
): Promise<void> {
  try {
    // Find users with role=barber linked to this barberId
    const usersSnap = await db
      .collection("users")
      .where("barberId", "==", barberId)
      .get();

    for (const userDoc of usersSnap.docs) {
      const token = userDoc.data()?.fcmToken;
      if (!token) continue;
      await messaging.send({
        token,
        notification: { title, body },
        webpush: { notification: { icon: "/pwa-192x192.png" } },
      });
    }

    // Also notify all admins (as fallback when barber has no linked user)
    const adminsSnap = await db
      .collection("users")
      .where("role", "==", "admin")
      .get();

    for (const adminDoc of adminsSnap.docs) {
      const token = adminDoc.data()?.fcmToken;
      if (!token) continue;
      await messaging.send({
        token,
        notification: { title, body },
        webpush: { notification: { icon: "/pwa-192x192.png" } },
      });
    }
  } catch (error) {
    console.error("Error sending push to barber:", error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 1: New appointment created → notify the barber / admin
// ─────────────────────────────────────────────────────────────────────────────
export const onAppointmentCreated = onDocumentCreated(
  "appointments/{appointmentId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { userId, barberId, date, time } = data;

    // Get client name
    let clientName = "Um cliente";
    try {
      const userSnap = await db.collection("users").doc(userId).get();
      if (userSnap.exists) {
        clientName = userSnap.data()?.name || clientName;
      }
    } catch {}

    // Format date for notification
    let dateLabel = "em breve";
    try {
      const d = new Date(date);
      dateLabel = d.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    } catch {}

    await sendPushToBarber(
      barberId,
      "✂️ Novo Agendamento!",
      `${clientName} quer agendar para ${dateLabel} às ${time}. Confirme no app.`
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 2: Appointment status updated → notify client
// ─────────────────────────────────────────────────────────────────────────────
export const onAppointmentStatusChange = onDocumentUpdated(
  "appointments/{appointmentId}",
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const { userId, barberId, date, time, status } = after;

    // Only act when status changes
    if (before.status === status) return;

    // Get barber name
    let barberName = "Sua barbearia";
    try {
      const barberSnap = await db.collection("barbers").doc(barberId).get();
      if (barberSnap.exists) {
        barberName = barberSnap.data()?.name || barberName;
      }
    } catch {}

    // Format date for notification
    let dateLabel = "em breve";
    try {
      const d = new Date(date);
      dateLabel = d.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    } catch {}

    if (status === "confirmed") {
      await sendPushToUser(
        userId,
        "✅ Horário Confirmado!",
        `${barberName} confirmou seu horário para ${dateLabel} às ${time}. Até lá!`
      );
    } else if (status === "cancelled") {
      await sendPushToUser(
        userId,
        "❌ Agendamento Cancelado",
        `Seu horário de ${dateLabel} às ${time} foi cancelado. Abra o app para remarcar.`
      );
    }
  }
);
