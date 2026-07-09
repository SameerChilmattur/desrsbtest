// Entrance check-in lookup — scanned from the QR code shown on a
// registrant's confirmation screen / email. Reads ?id=<orderId> and shows
// that registration's details for the volunteer at the door.
//
// Only name, participant count, sevas, and payment status are shown here —
// phone/email/address are deliberately left out, since a photographed or
// misplaced QR code would otherwise leak that contact info to anyone who
// scans it, not just entrance staff.

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const cardEl = document.getElementById("checkin-card");

const STATUS_LABELS = {
  pending: "Payment pending",
  not_required: "No payment required",
  confirmed: "Payment confirmed"
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderMessage(heading, body) {
  cardEl.innerHTML = `<h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p>`;
}

function renderRegistration(reg) {
  const sevaRows = reg.sevas
    .map(s => `<li><span>${escapeHtml(s.name)} × ${s.qty}</span><span>€${s.lineTotal.toFixed(2)}</span></li>`)
    .join("");
  const statusLabel = STATUS_LABELS[reg.paymentStatus] || reg.paymentStatus;

  cardEl.innerHTML = `
    <svg class="confirm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <h2>${escapeHtml(reg.fullName)}</h2>
    <p class="checkin-participants">${reg.participants} participant${reg.participants === 1 ? "" : "s"}</p>
    <ul class="checkin-sevas">${sevaRows}</ul>
    <p class="checkin-total">Total: €${reg.totalAmount.toFixed(2)}</p>
    <p class="checkin-status checkin-status-${escapeHtml(reg.paymentStatus)}">${escapeHtml(statusLabel)}${reg.paymentMethod !== "none" ? " · " + escapeHtml(reg.paymentMethod) : ""}</p>
    <p class="confirmation-order-id">Reference: ${escapeHtml(reg.orderId)}</p>
  `;
}

async function loadRegistration() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    renderMessage("No registration ID", "Scan the QR code from a registration confirmation to look someone up.");
    return;
  }

  try {
    const snap = await getDoc(doc(db, "registrations", id));
    if (!snap.exists()) {
      renderMessage("Not found", `No registration matches reference "${id}".`);
      return;
    }
    renderRegistration(snap.data());
  } catch (err) {
    console.error("Check-in lookup failed:", err);
    renderMessage("Lookup failed", "Could not load this registration. Please try again.");
  }
}

loadRegistration();
