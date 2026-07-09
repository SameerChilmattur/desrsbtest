# Seva Registration Site — Setup Guide

This gives you a free, working ticketing page: choose sevas → fill in details →
pay via PayPal (which also accepts Visa/Mastercard as a guest, no PayPal
account needed) or a direct bank transfer → get an email confirmation with an
entrance QR code → the registration is saved in Firestore for your records.

Total time: roughly 30–45 minutes the first time.

---

## 0. What you're setting up

| Piece | Service | Cost |
|---|---|---|
| Hosting | GitHub Pages | Free |
| Database (stores registrations) | Firebase Firestore | Free tier |
| Confirmation email | Google Apps Script + Gmail | Free (~500 emails/day via your Gmail account) |
| Payment (PayPal link + bank transfer) | paypal.me | Free to set up — PayPal's normal transfer fees apply if the payer uses a card; a plain bank transfer has none |

---

## 1. Firebase / Firestore setup

1. Go to **console.firebase.google.com** → **Add project** → name it (e.g. `srs-brundavan-sevas`) → create.
2. In the left sidebar: **Build → Firestore Database → Create database**.
   - Choose **Start in production mode**.
   - **Location: pick a European region** (e.g. `eur3 (europe-west)`). This matters for GDPR — it keeps registrant data stored in the EU. You cannot change this after creation, so double-check before confirming.
3. Once created, go to the **Rules** tab and replace the default rules with the contents of `firestore.rules` (included in this folder). Click **Publish**. (If you'd already published an earlier version, re-publish — the rules were updated to support the entrance QR check-in feature: any registration can be looked up by its exact reference/ID, but the collection still can't be listed or browsed.)
4. Go to **Project settings** (gear icon, top left) → scroll to **Your apps** → click the **</> (Web)** icon to register a new web app.
   - Give it any nickname (e.g. "Seva site"). You don't need Firebase Hosting — skip that checkbox.
5. Firebase will show you a config object like:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "srs-brundavan-sevas.firebaseapp.com",
     projectId: "srs-brundavan-sevas",
     storageBucket: "srs-brundavan-sevas.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
   Copy these values into `firebase-config.js`, replacing the placeholder `firebaseConfig` object. It's used by both `app.js` (the registration form) and `checkin.js` (the entrance check-in page), so you only need to edit it in this one place.

You'll see submitted registrations later under **Firestore Database → Data → registrations**.

---

## 2. Google Apps Script setup (confirmation emails)

This sends confirmation emails through your own Gmail account — completely
free, with a much higher ceiling (~500 emails/day, not per month) than a
third-party email service, and no external vendor involved.

1. Go to **script.google.com** and log in with the Gmail account you want
   confirmation emails to be sent *from* (e.g. a Gmail address for the Verein).
2. Click **New project**.
3. Delete the placeholder code in the editor, and paste in the entire contents
   of `Code.gs` (included in this folder).
4. Click the **Save** icon (or Ctrl/Cmd+S). Give the project a name, e.g.
   "Seva Registration Email".
5. Click **Deploy → New deployment**.
   - Click the gear icon next to "Select type" → choose **Web app**.
   - Description: anything, e.g. "Registration confirmations".
   - **Execute as:** *Me (your Gmail address)*.
   - **Who has access:** *Anyone*. (This just means anyone can call the
     endpoint to trigger an email send — it can't read your Gmail or do
     anything else. Still, treat the URL as something you don't publish
     unnecessarily, since anyone with it could trigger emails from your
     account.)
   - Click **Deploy**.
6. The first time, Google will ask you to **authorize** the script — click
   through the consent screens (you'll see an "unverified app" warning
   because this is your own private script, not a public one; click
   **Advanced → Go to [project name] (unsafe)** to proceed — this is normal
   and expected for personal scripts).
7. Copy the **Web app URL** shown after deployment. It looks like:
   `https://script.google.com/macros/s/AKfycb.../exec`
8. In `app.js`, replace `YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL` with this URL.

**Testing the script directly:** you can test it's working before wiring it
into the site by running this in your browser's console (replace the URL):

```js
fetch("https://script.google.com/macros/s/AKfycb.../exec", {
  method: "POST",
  headers: { "Content-Type": "text/plain;charset=utf-8" },
  body: JSON.stringify({
    to_name: "Test User",
    to_email: "your-own-email@example.com",
    event_name: "Sri Raghavendra Aradhana Mahotsava 2026",
    seva_summary: "Archana x1 — €5.00",
    total_amount: "5.00",
    order_id: "TEST123",
    checkin_url: "https://example.com/checkin.html?id=TEST123"
  })
});
```
You should receive a test confirmation email within a few seconds, including
an inline QR code image (it'll point at whatever URL you passed as
`checkin_url` — use your real site URL once it's live, e.g.
`https://yourusername.github.io/srs-brundavan-sevas/checkin.html?id=TEST123`).

**If you ever update `Code.gs` later:** you'll need to **Deploy → Manage
deployments → edit (pencil icon) → New version → Deploy** for changes to take
effect — saving the file alone doesn't update the live Web App.

---

## 3. Payment setup (PayPal link + bank transfer)

The site currently uses two lightweight payment methods that need no PayPal
Business account or API keys — good enough to launch with, though both rely
on you manually reconciling payments (see the limitations at the bottom).

**PayPal button:**
1. In `app.js`, find `PAYPAL_ME_USERNAME` near the top and set it to your
   paypal.me username (create one free at **paypal.me** if you don't have
   one — it works with a personal or business PayPal account).
2. That's it — the "Pay with PayPal" button opens
   `paypal.me/<username>/<amount>EUR` in a new tab. PayPal's own checkout
   page there lets the payer pay from their PayPal balance/bank, or as a
   guest with a Visa/Mastercard, without needing an account.

**Bank transfer button:**
1. In `app.js`, find the `BANK_DETAILS` object near the top and replace the
   placeholder `holder`, `iban`, and `bic` with your real account details.
2. The "Pay via Bank Transfer" button then shows these details plus a unique
   reference number for each registrant.

**How confirmation works:** neither method gives an automatic "payment
received" signal back to the site (a plain paypal.me link and a bank
transfer both happen outside the site entirely). Every registration is
saved with `paymentStatus: "pending"`, and you confirm it manually by
matching incoming PayPal/bank payments — using the reference number shown to
the registrant — against the entries in **Firestore Database → Data →
registrations**.

**Charity rate:** If DE SRS Brundavan e.V. is registered gemeinnützig, apply
for PayPal's discounted charity transaction rate from your PayPal account
settings — no cost to apply, it just lowers the fee PayPal takes on
card/PayPal-balance payments (a bank transfer has no such fee at all).

**Upgrading later (optional):** if manual reconciliation becomes too much
work, the next step up is a real PayPal Business "Smart Buttons"
integration (`developer.paypal.com` → Apps & Credentials → Create App for a
Client ID), which gives inline card entry and an automatic capture
confirmation instead of a redirect. That's a code change from the current
setup, not just a config value — ask if you want it built.

---

## 4. Editing the seva list

Open `app.js` and find the `SEVAS` array near the top:

```js
const SEVAS = [
  { id: "archana", name: "Archana", desc: "Name and star offered during archana.", price: 5 },
  ...
];
```

Add, remove, rename, or reprice entries freely — each needs a unique `id`, a `name`, a short `desc`, and a `price` in euros. The page rebuilds itself automatically from this list.

Also update `EVENT_NAME` near the top of the same file, and the hero text (event title, description) directly in `index.html`.

---

## 5. Publishing on GitHub Pages

1. Create a new **public** GitHub repository (e.g. `srs-brundavan-sevas`).
2. Upload all files from this folder needed to run the site — `index.html`, `style.css`, `app.js`, `firebase-config.js`, `checkin.html`, `checkin.js`, `qrcode.min.js`, and `logo.jpeg` — to the repo root. (Do **not** upload `firestore.rules`, `Code.gs`, or this instructions file — none are needed on the live site. `Code.gs` in particular gets deployed separately on script.google.com, per Step 2 above, not on GitHub.)
3. In the repo: **Settings → Pages**.
   - Under **Source**, choose **Deploy from a branch**.
   - Branch: `main`, folder: `/ (root)` → **Save**.
4. GitHub will give you a URL like `https://yourusername.github.io/srs-brundavan-sevas/` within a minute or two. That's your live registration page.

---

## 6. Testing before you share the link

1. Open the page, select a seva, fill in the form with your own details, and click through both payment buttons — send yourself a small real PayPal payment (or just note it, since it's not automatically captured) and check the bank details panel shows correctly.
2. Confirm you receive the confirmation email, including the inline QR code.
3. Check **Firestore Database → Data → registrations** in the Firebase console to confirm the entry was saved correctly, under a document ID matching the order reference you were shown.
4. Scan the QR code (or open its link directly) and confirm `checkin.html` shows your test registration's details.
5. Once everything checks out, do one more full run-through with a real small payment before sharing the link widely.

---

## 7. Notes and known limitations (MVP scope)

- **Payment confirmation is manual, not automatic.** A plain paypal.me link and a bank transfer both happen entirely outside the site, so there's no capture/webhook to verify — every registration is saved as `paymentStatus: "pending"` and you reconcile it yourself against incoming payments, using the reference number shown to each registrant. This also means someone could click "Confirm Registration" without actually paying; for a small community event that's a reasonable trade-off, but it's worth knowing about. If you want automatic verification later, the next step up is a real PayPal Business "Smart Buttons" integration (see the "Upgrading later" note in Section 3) — happy to help build that if you want more assurance down the line.
- **No admin dashboard yet** — you view registrations directly in the Firebase console (Firestore Database → Data). If you want a nicer admin view (searchable table, export to CSV), that's a separate small addition.
- **Entrance QR check-in** — after confirming, each registrant gets a QR code (on-screen and in their email) linking to `checkin.html?id=<reference>`. Scanning it shows their name, participant count, sevas, and payment status — phone/email/address are intentionally left off that page so a lost or photographed QR code doesn't leak contact details. It's a read-only lookup: scanning doesn't mark anyone as "arrived." If you want a volunteer-facing "mark as checked in" button at the door, that's a natural next addition.
- **GDPR** — the Firestore region is set to the EU as long as you picked a European location in Step 1. Consider linking a fuller Datenschutzerklärung from the footer if your Verein has one elsewhere on its website.
