// =====================================================================
// Organiser dashboard — list registrations, mark payments, resend QR email.
// =====================================================================
// Access is gated by Firebase Authentication. Only the admin account (per
// firestore.rules) can list registrations or update payment status; a
// non-admin visitor can sign in but Firestore will refuse to return data.

import { firebaseConfig } from "./firebase-config.js";
import { GOOGLE_SCRIPT_URL, EVENT_NAME } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---- Elements ----
const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const refreshBtn = document.getElementById("refresh-btn");
const statusEl = document.getElementById("admin-status");
const tbody = document.getElementById("admin-tbody");
const summaryEl = document.getElementById("admin-summary");
const filtersEl = document.getElementById("admin-filters");

let registrations = [];
let activeFilter = "all";

// =====================================================================
// AUTH
// =====================================================================

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = "Sign-in failed. Check your email and password.";
    console.error("Sign-in error:", err);
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    loadRegistrations();
  } else {
    dashboardView.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    loginView.classList.remove("hidden");
    registrations = [];
  }
});

// =====================================================================
// LOAD + RENDER
// =====================================================================

refreshBtn.addEventListener("click", loadRegistrations);

filtersEl.querySelectorAll(".admin-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    activeFilter = chip.dataset.filter;
    filtersEl.querySelectorAll(".admin-chip").forEach((c) => c.classList.toggle("is-active", c === chip));
    renderTable();
  });
});

async function loadRegistrations() {
  statusEl.textContent = "Loading registrations…";
  tbody.innerHTML = "";
  try {
    const snap = await getDocs(query(collection(db, "registrations"), orderBy("createdAt", "desc")));
    registrations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    statusEl.textContent = "";
    renderSummary();
    renderTable();
  } catch (err) {
    console.error("Failed to load registrations:", err);
    statusEl.textContent = "Could not load registrations. Make sure this account is the admin set in the Firestore rules.";
  }
}

function renderSummary() {
  const paid = registrations.filter((r) => r.paymentStatus === "paid");
  const pending = registrations.filter((r) => r.paymentStatus === "pending");
  const free = registrations.filter((r) => r.paymentStatus === "not_required");
  const sum = (list) => list.reduce((t, r) => t + (r.totalAmount || 0), 0);

  summaryEl.innerHTML = `
    <div class="admin-stat"><span class="admin-stat-num">${registrations.length}</span><span class="admin-stat-label">Registrations</span></div>
    <div class="admin-stat admin-stat-good"><span class="admin-stat-num">€${sum(paid).toFixed(2)}</span><span class="admin-stat-label">Collected (${paid.length} paid)</span></div>
    <div class="admin-stat admin-stat-warn"><span class="admin-stat-num">€${sum(pending).toFixed(2)}</span><span class="admin-stat-label">Awaiting payment (${pending.length})</span></div>
    <div class="admin-stat"><span class="admin-stat-num">${free.length}</span><span class="admin-stat-label">Free Darshana</span></div>
  `;
}

function renderTable() {
  const rows = registrations.filter((r) => activeFilter === "all" || r.paymentStatus === activeFilter);

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="admin-empty">No registrations in this view.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r) => {
    const sevas = (r.sevas || []).map((s) => `${escapeHtml(s.name)} ×${s.qty}`).join(", ");
    const date = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toLocaleString() : "—";
    return `
      <tr>
        <td>${escapeHtml(date)}</td>
        <td>${escapeHtml(r.fullName || "")}${r.firstVisit === "yes" ? ' <span class="badge badge-free">1st visit</span>' : ""}</td>
        <td class="admin-contact">${escapeHtml(r.email || "")}<br>${escapeHtml(r.phone || "")}</td>
        <td>${sevas}</td>
        <td>${escapeHtml(String(r.participants || 1))}</td>
        <td>€${(r.totalAmount || 0).toFixed(2)}</td>
        <td>${escapeHtml(methodLabel(r.paymentMethod))}</td>
        <td>${statusBadge(r.paymentStatus)}</td>
        <td>${actionButtons(r)}</td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleAction(btn.dataset.action, btn.dataset.id, btn));
  });
}

function methodLabel(m) {
  if (m === "paypal") return "PayPal";
  if (m === "bank_transfer") return "Bank transfer";
  return "—";
}

function statusBadge(status) {
  if (status === "paid") return `<span class="badge badge-paid">Paid</span>`;
  if (status === "not_required") return `<span class="badge badge-free">Free</span>`;
  return `<span class="badge badge-pending">Not paid</span>`;
}

function actionButtons(r) {
  if (r.paymentStatus === "pending") {
    return `<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-action="mark-paid" data-id="${escapeHtml(r.id)}">Mark as paid</button>`;
  }
  if (r.paymentStatus === "paid") {
    return `<button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-action="resend" data-id="${escapeHtml(r.id)}">Resend email</button>`;
  }
  return "";
}

// =====================================================================
// ACTIONS
// =====================================================================

async function handleAction(action, id, btn) {
  const reg = registrations.find((r) => r.id === id);
  if (!reg) return;

  btn.disabled = true;
  const original = btn.textContent;

  if (action === "mark-paid") {
    btn.textContent = "Saving…";
    try {
      await updateDoc(doc(db, "registrations", id), {
        paymentStatus: "paid",
        paidAt: serverTimestamp()
      });
      reg.paymentStatus = "paid";
    } catch (err) {
      console.error("Failed to mark paid:", err);
      alert("Could not update payment status. Please try again.");
      btn.disabled = false;
      btn.textContent = original;
      return;
    }
    btn.textContent = "Sending email…";
    await sendConfirmationEmail(reg);
    renderSummary();
    renderTable();
    return;
  }

  if (action === "resend") {
    btn.textContent = "Sending…";
    await sendConfirmationEmail(reg);
    btn.disabled = false;
    btn.textContent = original;
    alert("Confirmation email re-sent to " + reg.email);
  }
}

async function sendConfirmationEmail(reg) {
  const checkinUrl = new URL(`checkin.html?id=${encodeURIComponent(reg.orderId)}`, window.location.href).href;
  const sevaSummaryText = (reg.sevas || [])
    .map((s) => `${s.name} x${s.qty} — €${Number(s.lineTotal).toFixed(2)}`)
    .join("\n");

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        to_name: reg.fullName,
        to_email: reg.email,
        event_name: EVENT_NAME,
        participants: reg.participants,
        seva_summary: sevaSummaryText,
        total_amount: Number(reg.totalAmount).toFixed(2),
        payment_status: reg.paymentStatus,
        order_id: reg.orderId,
        checkin_url: checkinUrl
      })
    });
  } catch (err) {
    console.error("Confirmation email send failed:", err);
    alert("Payment was saved, but the confirmation email could not be sent. You can retry with 'Resend email'.");
  }
}

// =====================================================================
// UTIL
// =====================================================================

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
