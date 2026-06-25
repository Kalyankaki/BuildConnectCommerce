import "server-only";
/**
 * Customer notifications on order status changes (B.8). Mirrors the payments flag pattern:
 * a `mock` notifier records a successful send offline; real email (Resend) / SMS (Twilio)
 * activate when their env keys are present. No SDKs — uses fetch.
 */
import type { orders } from "@/db/schema";

type Order = typeof orders.$inferSelect;
export type NotifyChannel = "email" | "sms";
export interface NotifyResult {
  channel: NotifyChannel;
  provider: "mock" | "resend" | "twilio";
  sent: boolean;
}

const MESSAGES: Record<string, string> = {
  booked: "Your booking is confirmed — we've received your deposit. We'll reach out to schedule.",
  scheduled: "Your job is scheduled. See your tracking page for the appointment windows.",
  in_progress: "Your renovation job is now in progress.",
  completed: "All done! Your job is complete and the balance has been charged. Thank you!",
  closed: "Your order is now closed. We hope you love the result!",
  canceled: "Your order has been canceled. Reach out if you have any questions.",
  needs_quote: "Thanks! We'll follow up to schedule a site visit and finalize your quote.",
};

export function messageForStatus(status: string): string {
  return MESSAGES[status] ?? `Your order status is now: ${status}.`;
}

async function sendEmail(to: string, subject: string, body: string): Promise<NotifyResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) {
    console.log(`[notify:mock:email] -> ${to}: ${subject}`);
    return { channel: "email", provider: "mock", sent: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text: body }),
    });
    return { channel: "email", provider: "resend", sent: res.ok };
  } catch {
    return { channel: "email", provider: "resend", sent: false };
  }
}

async function sendSms(to: string, body: string): Promise<NotifyResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.log(`[notify:mock:sms] -> ${to}: ${body}`);
    return { channel: "sms", provider: "mock", sent: true };
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    return { channel: "sms", provider: "twilio", sent: res.ok };
  } catch {
    return { channel: "sms", provider: "twilio", sent: false };
  }
}

/** Notify the customer about a new order status. Email always; SMS if a phone is on file. */
export async function notifyOrderStatus(
  order: Pick<Order, "id" | "customerEmail" | "customerPhone">,
  storeName: string,
  toStatus: string,
): Promise<{ message: string; results: NotifyResult[] }> {
  const message = messageForStatus(toStatus);
  const subject = `${storeName}: order ${order.id.slice(0, 8)} — ${toStatus}`;
  const results: NotifyResult[] = [];
  results.push(await sendEmail(order.customerEmail, subject, message));
  if (order.customerPhone) results.push(await sendSms(order.customerPhone, `${storeName}: ${message}`));
  return { message, results };
}
