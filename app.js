// =====================================================================
// 1. CONFIGURATION — replace every placeholder in this section
// =====================================================================

// Firebase project config (Firebase console → Project settings → Your apps → SDK config)
const firebaseConfig = {
  apiKey: "AIzaSyBwG-okIIgGisDmLcp39NtNSWbxDsdy4l4",
  authDomain: "desrsb2026.firebaseapp.com",
  projectId: "desrsb2026",
  storageBucket: "desrsb2026.firebasestorage.app",
  messagingSenderId: "401456213585",
  appId: "1:401456213585:web:34b43a500e0337bba59270",
  measurementId: "G-GFLSTH27ZZ"
};

// EmailJS config (emailjs.com → Account → General)
const EMAILJS_PUBLIC_KEY = "YOUR_EMAILJS_PUBLIC_KEY";
const EMAILJS_SERVICE_ID = "YOUR_EMAILJS_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "YOUR_EMAILJS_TEMPLATE_ID";

// Event name shown in the confirmation email
const EVENT_NAME = "Raghavendra Aradhane";

// The list of sevas on offer. Edit freely — add, remove, rename, reprice.
const SEVAS = [
  { id: "archana",      name: "Archana",              desc: "Name and star offered during archana.",        price: 5 },
  { id: "abhisheka",    name: "Abhisheka",            desc: "Sacred bathing ritual for the deity.",         price: 21 },
  { id: "ganapati-homa", name: "Ganapati Homa",       desc: "Fire ritual invoking Lord Ganapati.",          price: 51 },
  { id: "kalyanotsava", name: "Kalyanotsavam",        desc: "Divine wedding ceremony seva.",                price: 101 },
  { id: "anna-daana",   name: "Anna Daana Seva",      desc: "Sponsor the community meal (prasadam).",       price: 31 },
  { id: "deepa-seva",   name: "Deepa Seva",           desc: "Lamp-lighting offering.",                       price: 11 }
];

// =====================================================================
// 2. FIREBASE + EMAILJS INITIALIZATION
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// emailjs is loaded globally via the <script> tag in index.html
emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

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
      <h4>${escapeHtml(seva.name)}</h4>
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
}

function setQuantity(id, value) {
  quantities[id] = Math.max(0, value);
  const input = document.getElementById(`qty-${id}`);
  if (input) input.value = quantities[id];
  renderSummary();
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
    consent: form.consent.checked
  };
}

function validateForm() {
  const data = getFormData();
  if (!data.fullName || !data.phone || !data.email || !data.address) {
    formErrorEl.textContent = "Please fill in all required fields.";
    return false;
  }
  if (!/^\S+@\S+\.\S+$/.test(data.email)) {
    formErrorEl.textContent = "Please enter a valid email address.";
    return false;
  }
  if (!data.consent) {
    formErrorEl.textContent = "Please confirm you agree to the data use note before paying.";
    return false;
  }
  if (calculateTotal() <= 0) {
    formErrorEl.textContent = "Please select at least one seva.";
    return false;
  }
  formErrorEl.textContent = "";
  return true;
}

// =====================================================================
// 7. PAYPAL BUTTONS
// =====================================================================

const paymentStatusEl = document.getElementById("payment-status");

function buildSevaDescription() {
  return getSelectedSevas().map(s => `${s.name} x${s.qty}`).join(", ").slice(0, 120);
}

paypal.Buttons({
  style: { layout: "vertical", color: "gold", shape: "rect", label: "pay" },

  createOrder: function (data, actions) {
    if (!validateForm()) {
      paymentStatusEl.textContent = "Please complete the form above before paying.";
      return Promise.reject(new Error("Form invalid"));
    }
    const total = calculateTotal();
    return actions.order.create({
      purchase_units: [{
        amount: { value: total.toFixed(2), currency_code: "EUR" },
        description: buildSevaDescription() || EVENT_NAME
      }]
    });
  },

  onApprove: function (data, actions) {
    paymentStatusEl.textContent = "Processing your payment…";
    return actions.order.capture().then(function (details) {
      return handleSuccessfulPayment(details);
    });
  },

  onCancel: function () {
    paymentStatusEl.textContent = "Payment cancelled. You can try again when ready.";
  },

  onError: function (err) {
    console.error("PayPal error:", err);
    paymentStatusEl.textContent = "Something went wrong with the payment. Please try again or contact us.";
  }
}).render("#paypal-button-container");

// =====================================================================
// 8. ON SUCCESSFUL PAYMENT — save to Firestore, send confirmation email
// =====================================================================

async function handleSuccessfulPayment(details) {
  const formData = getFormData();
  const selected = getSelectedSevas();
  const total = calculateTotal();
  const orderId = details.id;

  const registration = {
    fullName: formData.fullName,
    phone: formData.phone,
    email: formData.email,
    address: formData.address,
    sevas: selected.map(s => ({ id: s.id, name: s.name, qty: s.qty, lineTotal: s.lineTotal })),
    totalAmount: total,
    currency: "EUR",
    paypalOrderId: orderId,
    paypalPayerEmail: details.payer && details.payer.email_address ? details.payer.email_address : null,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "registrations"), registration);
  } catch (err) {
    console.error("Firestore write failed:", err);
    // Payment already succeeded — don't block the confirmation on a storage error,
    // but surface it so you notice and can reconcile manually.
    paymentStatusEl.textContent = "Payment succeeded, but we had trouble saving your registration. Please contact us with your order ID: " + orderId;
  }

  const sevaSummaryText = selected.map(s => `${s.name} x${s.qty} — €${s.lineTotal.toFixed(2)}`).join("\n");

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_name: formData.fullName,
      to_email: formData.email,
      event_name: EVENT_NAME,
      seva_summary: sevaSummaryText,
      total_amount: total.toFixed(2),
      order_id: orderId
    });
  } catch (err) {
    console.error("EmailJS send failed:", err);
  }

  showConfirmation(orderId);
}

// =====================================================================
// 9. CONFIRMATION VIEW
// =====================================================================

function showConfirmation(orderId) {
  document.getElementById("sevas").style.display = "none";
  document.getElementById("order-summary").style.display = "none";
  document.getElementById("registrant-form").style.display = "none";
  document.getElementById("payment").style.display = "none";

  const confirmation = document.getElementById("confirmation");
  confirmation.classList.remove("hidden");
  document.getElementById("confirmation-order-id").textContent = "Order reference: " + orderId;
  confirmation.scrollIntoView({ behavior: "smooth" });
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

renderSevas();
renderSummary();
