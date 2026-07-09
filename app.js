// =====================================================================
// 1. CONFIGURATION — replace every placeholder in this section
// =====================================================================

// Firebase config lives in firebase-config.js (shared with checkin.js).
// GOOGLE_SCRIPT_URL and EVENT_NAME live in config.js (shared with admin.js).

// Temporary payment link — a plain paypal.me link, until a proper PayPal
// Business "Smart Buttons" client-id is set up (see SETUP_INSTRUCTIONS.md,
// section 3).
const PAYPAL_ME_USERNAME = "sameerchilmattur";

// PLACEHOLDER bank details — replace with the real account before going live.
// Shown to registrants who choose "Pay via Bank Transfer".
const BANK_DETAILS = {
  holder: "DE SRS Brundavan e.V.",
  iban: "DE00 1234 5678 9012 3456 00",
  bic: "TESTDEFFXXX"
};

// The list of sevas on offer. Edit freely — add, remove, rename, reprice.
const SEVAS = [
  { id: "tbd-seva",       name: "TBD Seva",           desc: "Special seva to be decided.",                        price: 501 },
  { id: "sarvaseva",      name: "Sarvaseva",          desc: "Complete seva covering all rituals of the day.",     price: 251 },
  { id: "kanakabhisheka", name: "Kanakabhisheka",     desc: "Golden abhisheka offering to the deity.",             price: 151 },
  { id: "pallaki",        name: "Pallaki",            desc: "Palanquin procession seva for the deity.",           price: 121 },
  { id: "annadaana",      name: "Annadaana",          desc: "Sponsor the community meal (prasadam).",             price: 101 },
  { id: "panchamrutha",   name: "Panchamrutha",       desc: "Abhisheka with the five sacred nectars.",            price: 75 },
  { id: "paada-pooje",    name: "Paada Pooje",        desc: "Worship offered at the holy feet.",                  price: 51 },
  { id: "pushpalankara",  name: "Pushpalankara",      desc: "Flower decoration offered to the deity.",            price: 31 },
  { id: "ashothara",      name: "Ashothara",          desc: "108 names chanting offering.",                       price: 21 },
  { id: "free-darshana",  name: "Free Darshana",      desc: "Attend without sponsoring a paid seva.",             price: 0 }
];

// =====================================================================
// 2. FIREBASE INITIALIZATION
// =====================================================================

import { firebaseConfig } from "./firebase-config.js";
import { GOOGLE_SCRIPT_URL, EVENT_NAME } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// =====================================================================
// 3. STATE
// =====================================================================

const quantities = {}; // { sevaId: qty }
SEVAS.forEach(s => (quantities[s.id] = 0));

// =====================================================================
// 4. RENDER SEVA CARDS
// =====================================================================

const sevaListEl = document.getElementById("seva-list");

function renderSevas() {
  sevaListEl.innerHTML = SEVAS.map(seva => `
    <div class="seva-card">
      <label class="seva-select">
        <input type="checkbox" id="select-${seva.id}" data-id="${seva.id}" aria-label="Select ${escapeHtml(seva.name)}">
        <h4>${escapeHtml(seva.name)}</h4>
      </label>
      <p class="desc">${escapeHtml(seva.desc)}</p>
      <p class="price">€${seva.price.toFixed(2)}</p>
      <div class="qty-control">
        <button type="button" data-action="dec" data-id="${seva.id}" aria-label="Decrease ${escapeHtml(seva.name)} quantity">−</button>
        <input type="number" min="0" value="0" id="qty-${seva.id}" data-id="${seva.id}" aria-label="${escapeHtml(seva.name)} quantity">
        <button type="button" data-action="inc" data-id="${seva.id}" aria-label="Increase ${escapeHtml(seva.name)} quantity">+</button>
      </div>
    </div>
  `).join("");

  sevaListEl.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const delta = btn.dataset.action === "inc" ? 1 : -1;
      setQuantity(id, quantities[id] + delta);
    });
  });

  sevaListEl.querySelectorAll("input[type=number]").forEach(input => {
    input.addEventListener("change", () => {
      const id = input.dataset.id;
      setQuantity(id, parseInt(input.value, 10) || 0);
    });
  });

  sevaListEl.querySelectorAll("input[type=checkbox]").forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      const id = checkbox.dataset.id;
      setQuantity(id, checkbox.checked ? Math.max(1, quantities[id]) : 0);
    });
  });
}

function setQuantity(id, value) {
  quantities[id] = Math.max(0, value);
  const input = document.getElementById(`qty-${id}`);
  if (input) input.value = quantities[id];
  const checkbox = document.getElementById(`select-${id}`);
  if (checkbox) checkbox.checked = quantities[id] > 0;
  renderSummary();
  updateRegistrationLock();
  updatePaymentMethodVisibility();
}

// =====================================================================
// 4b. REGISTRATION LOCK — greyed out until at least one seva is selected
// =====================================================================

const registrantFormSection = document.getElementById("registrant-form");
const paymentSection = document.getElementById("payment");
const lockableSections = [registrantFormSection, paymentSection];

function updateRegistrationLock() {
  const hasSelection = SEVAS.some(s => quantities[s.id] > 0);
  lockableSections.forEach(section => section.classList.toggle("locked", !hasSelection));
  registrantFormSection.querySelectorAll("input, textarea, select").forEach(el => {
    el.disabled = !hasSelection;
  });
}

// =====================================================================
// 5. ORDER SUMMARY + TOTAL
// =====================================================================

const summaryListEl = document.getElementById("summary-list");
const summaryTotalEl = document.getElementById("summary-total-amount");

function getSelectedSevas() {
  return SEVAS
    .filter(s => quantities[s.id] > 0)
    .map(s => ({ ...s, qty: quantities[s.id], lineTotal: s.price * quantities[s.id] }));
}

function calculateTotal() {
  return getSelectedSevas().reduce((sum, s) => sum + s.lineTotal, 0);
}

function renderSummary() {
  const selected = getSelectedSevas();
  if (selected.length === 0) {
    summaryListEl.innerHTML = `<li class="summary-empty">No sevas selected yet</li>`;
  } else {
    summaryListEl.innerHTML = selected.map(s => `
      <li><span>${escapeHtml(s.name)} × ${s.qty}</span><span>€${s.lineTotal.toFixed(2)}</span></li>
    `).join("");
  }
  summaryTotalEl.textContent = `€${calculateTotal().toFixed(2)}`;
}

renderSevas();
renderSummary();
updateRegistrationLock();

// =====================================================================
// 6. FORM VALIDATION
// =====================================================================

const form = document.getElementById("details-form");
const formErrorEl = document.getElementById("form-error");

function getFormData() {
  return {
    fullName: form.fullName.value.trim(),
    phone: form.phone.value.trim(),
    email: form.email.value.trim(),
    address: form.address.value.trim(),
    participants: parseInt(form.participants.value, 10) || 1,
    consent: form.consent.checked
  };
}

function validateForm() {
  if (getSelectedSevas().length === 0) {
    formErrorEl.textContent = "Please select at least one seva.";
    return false;
  }
  const data = getFormData();
  if (!data.fullName || !data.phone || !data.email || !data.address) {
    formErrorEl.textContent = "Please fill in all required fields.";
    return false;
  }
  if (!/^\S+@\S+\.\S+$/.test(data.email)) {
    formErrorEl.textContent = "Please enter a valid email address.";
    return false;
  }
  if (data.participants < 1 || data.participants > 6) {
    formErrorEl.textContent = "Number of participants must be between 1 and 6.";
    return false;
  }
  if (!data.consent) {
    formErrorEl.textContent = "Please confirm you agree to the data use note before paying.";
    return false;
  }
  formErrorEl.textContent = "";
  return true;
}

// =====================================================================
// 7. PAYMENT BUTTONS — PayPal link + manual bank transfer
// =====================================================================
// Free Darshana (total €0) skips payment methods entirely and shows a
// single "Confirm Registration" button. Any paid seva shows the PayPal /
// Bank Transfer choice; picking either reveals the shared "Confirm
// Registration" button as the final step once payment is done.

const paymentStatusEl = document.getElementById("payment-status");
const paymentMethodsEl = document.getElementById("payment-methods");
const payPaypalBtn = document.getElementById("pay-paypal");
const payBankBtn = document.getElementById("pay-bank");
const bankDetailsEl = document.getElementById("bank-details");
const bankReferenceEl = document.getElementById("bank-reference");
const confirmFreeBtn = document.getElementById("confirm-free");
const confirmRegistrationBtn = document.getElementById("confirm-registration");

document.getElementById("bank-holder").textContent = BANK_DETAILS.holder;
document.getElementById("bank-iban").textContent = BANK_DETAILS.iban;
document.getElementById("bank-bic").textContent = BANK_DETAILS.bic;

let pendingMethod = null;
let pendingOrderId = null;

function buildPaypalMeUrl(amount) {
  return `https://paypal.me/${PAYPAL_ME_USERNAME}/${amount.toFixed(2)}EUR`;
}

updatePaymentMethodVisibility();

function updatePaymentMethodVisibility() {
  const hasSelection = getSelectedSevas().length > 0;
  const isFreeOnly = hasSelection && calculateTotal() === 0;

  paymentMethodsEl.classList.toggle("hidden", !hasSelection || isFreeOnly);
  confirmFreeBtn.classList.toggle("hidden", !isFreeOnly);

  // Reset any in-progress payment step whenever the selection changes.
  bankDetailsEl.classList.add("hidden");
  confirmRegistrationBtn.classList.add("hidden");
  paymentStatusEl.textContent = "";
  pendingMethod = null;
  pendingOrderId = null;
}

confirmFreeBtn.addEventListener("click", () => {
  if (!validateForm()) {
    paymentStatusEl.textContent = "Please complete the form above before confirming.";
    return;
  }
  completeRegistration("none", 0);
});

payPaypalBtn.addEventListener("click", () => {
  if (!validateForm()) {
    paymentStatusEl.textContent = "Please complete the form above before paying.";
    return;
  }
  const total = calculateTotal();
  pendingMethod = "paypal";
  pendingOrderId = `REG-${Date.now()}`;
  bankDetailsEl.classList.add("hidden");
  window.open(buildPaypalMeUrl(total), "_blank", "noopener");
  paymentStatusEl.textContent = "Complete your payment in the tab that just opened, then click \"Confirm Registration\" below.";
  confirmRegistrationBtn.classList.remove("hidden");
});

payBankBtn.addEventListener("click", () => {
  if (!validateForm()) {
    paymentStatusEl.textContent = "Please complete the form above before paying.";
    return;
  }
  pendingMethod = "bank_transfer";
  pendingOrderId = `REG-${Date.now()}`;
  bankReferenceEl.textContent = pendingOrderId;
  bankDetailsEl.classList.remove("hidden");
  confirmRegistrationBtn.classList.remove("hidden");
  paymentStatusEl.textContent = "Transfer the amount above using the reference shown, then click \"Confirm Registration\" below.";
  alert("Your registration is pending. You will be confirmed after payment completion.");
});

confirmRegistrationBtn.addEventListener("click", () => {
  completeRegistration(pendingMethod, calculateTotal(), pendingOrderId);
});

// =====================================================================
// 8. SAVE REGISTRATION — Firestore + confirmation email
// =====================================================================
// Neither the paypal.me link nor a bank transfer gives an automated capture
// step to confirm here. The registration is saved as "pending" and the
// organiser reconciles payment manually.

function completeRegistration(method, total, orderId = `REG-${Date.now()}`) {
  const formData = getFormData();
  const selected = getSelectedSevas();
  const paymentRequired = total > 0;

  // Saved under the order ID itself (instead of an auto-generated ID) so the
  // QR code only needs to encode this one reference to look the doc back up.
  const registration = {
    fullName: formData.fullName,
    phone: formData.phone,
    email: formData.email,
    address: formData.address,
    participants: formData.participants,
    sevas: selected.map(s => ({ id: s.id, name: s.name, qty: s.qty, lineTotal: s.lineTotal })),
    totalAmount: total,
    currency: "EUR",
    paymentMethod: paymentRequired ? method : "none",
    paymentStatus: paymentRequired ? "pending" : "not_required",
    orderId,
    createdAt: serverTimestamp()
  };

  // Points at checkin.html, which looks the registration up by this ID and
  // displays it — this is what the entrance QR code encodes.
  const checkinUrl = new URL(`checkin.html?id=${encodeURIComponent(orderId)}`, window.location.href).href;

  // Always save the registration.
  saveRegistration(registration, orderId);

  if (paymentRequired) {
    // Paid sevas: the registration is only a REQUEST until an organiser
    // confirms the payment in the admin dashboard. No QR and no confirmation
    // email yet — those are sent when the organiser marks it paid.
    showRequestReceived(orderId, method);
  } else {
    // Free Darshana: nothing to pay, so confirm immediately — show the QR
    // on screen and email the confirmation right away.
    showConfirmation(orderId, checkinUrl);
    sendConfirmationEmail(registration, selected, total, orderId, checkinUrl);
  }
}

async function saveRegistration(registration, orderId) {
  try {
    await setDoc(doc(db, "registrations", orderId), registration);
  } catch (err) {
    // The confirmation is already on screen; log so you can reconcile manually.
    console.error("Firestore write failed:", err);
  }
}

async function sendConfirmationEmail(registration, selected, total, orderId, checkinUrl) {
  const sevaSummaryText = selected.map(s => `${s.name} x${s.qty} — €${s.lineTotal.toFixed(2)}`).join("\n");

  try {
    // Content-Type text/plain avoids a CORS preflight, which Apps Script Web Apps
    // don't handle. The script itself parses the body as JSON on its side.
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        to_name: registration.fullName,
        to_email: registration.email,
        event_name: EVENT_NAME,
        participants: registration.participants,
        seva_summary: sevaSummaryText,
        total_amount: total.toFixed(2),
        payment_status: registration.paymentStatus,
        order_id: orderId,
        checkin_url: checkinUrl
      })
    });
  } catch (err) {
    console.error("Confirmation email send failed:", err);
  }
}

// =====================================================================
// 9. CONFIRMATION VIEW
// =====================================================================

function hideRegistrationSections() {
  document.getElementById("sevas").style.display = "none";
  document.getElementById("order-summary").style.display = "none";
  document.getElementById("registrant-form").style.display = "none";
  document.getElementById("payment").style.display = "none";
}

// Paid registration awaiting the organiser's payment confirmation — no QR yet.
function showRequestReceived(orderId, method) {
  hideRegistrationSections();

  document.getElementById("confirmation-heading").textContent = "Registration request received";
  document.getElementById("confirmation-message").textContent = method === "bank_transfer"
    ? "Thank you. Once we've received and confirmed your bank transfer, we'll email you a confirmation with your entrance QR code."
    : "Thank you. Once we've confirmed your PayPal payment, we'll email you a confirmation with your entrance QR code.";
  document.getElementById("confirmation-order-id").textContent = "Registration reference: " + orderId;

  // No QR until payment is confirmed by an organiser.
  document.getElementById("confirmation-qr-card").classList.add("hidden");

  const confirmation = document.getElementById("confirmation");
  confirmation.classList.remove("hidden");
  confirmation.scrollIntoView({ behavior: "smooth" });
}

// Free Darshana (or an already-confirmed registration) — show the QR now.
function showConfirmation(orderId, checkinUrl) {
  hideRegistrationSections();

  document.getElementById("confirmation-heading").textContent = "Your registration is confirmed";
  document.getElementById("confirmation-message").textContent = "A confirmation has been sent to your email.";
  document.getElementById("confirmation-order-id").textContent = "Registration reference: " + orderId;

  document.getElementById("confirmation-qr-card").classList.remove("hidden");
  renderQrCode(document.getElementById("confirmation-qr"), checkinUrl);

  const confirmation = document.getElementById("confirmation");
  confirmation.classList.remove("hidden");
  confirmation.scrollIntoView({ behavior: "smooth" });
}

// Renders the QR into `container`. Uses the locally-bundled qrcode.min.js
// (same-origin, works fully offline). If that library somehow isn't present,
// falls back to a public QR image API so a code still appears.
function renderQrCode(container, text) {
  container.innerHTML = "";
  if (typeof QRCode !== "undefined") {
    try {
      new QRCode(container, {
        text: text,
        width: 220,
        height: 220,
        colorDark: "#000000",
        colorLight: "#ffffff"
      });
      return;
    } catch (err) {
      console.error("Local QR render failed, using image fallback:", err);
    }
  }
  const img = document.createElement("img");
  img.width = 220;
  img.height = 220;
  img.alt = "Registration QR code";
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(text)}`;
  container.appendChild(img);
}

// =====================================================================
// 10. UTIL
// =====================================================================

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// =====================================================================
// INIT
// =====================================================================
// Seva list and summary are rendered above, right after their functions
// are defined, so they show up even if PayPal/Firebase fail to load.
