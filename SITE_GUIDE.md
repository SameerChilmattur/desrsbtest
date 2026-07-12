# Site Guide — What's in each file, and how to make simple changes

A quick-reference for editing this site without needing to re-learn the whole
codebase each time. For *setting up* Firebase/PayPal/email from scratch, see
`SETUP_INSTRUCTIONS.md` instead — this doc is for day-to-day tweaks once
everything is already running.

**Workflow for any change:** edit the file → test locally (run `serve.ps1`,
open `http://localhost:8000/`) → commit & push to GitHub → if GitHub Pages is
on, the live site updates automatically in a minute or two.

---

## 1. What's in this folder

| File | What it is | Edit for |
|---|---|---|
| `index.html` | The public registration page — structure/text only | Wording, labels, page structure |
| `style.css` | **All** visual styling, for every page (registration, admin, check-in) | Colors, fonts, sizes, spacing, images |
| `app.js` | Registration page logic + the seva list, PayPal username, bank details | Sevas & prices, payment details, form behaviour |
| `config.js` | Shared settings: event name, email script URL | Event name |
| `firebase-config.js` | Firebase project connection details | Only if you move to a different Firebase project |
| `admin.html` / `admin.js` | Organiser dashboard (login, registrations list, mark-as-paid) | Dashboard text/behaviour |
| `checkin.html` / `checkin.js` | Entrance QR scan-and-lookup page | Check-in page text/behaviour |
| `Code.gs` | Google Apps Script — sends the confirmation email (with QR) | Email wording, sender name |
| `firestore.rules` | Security rules for the database — who can read/write what | Admin email, security logic (careful) |
| `logo.jpeg` | Your organisation logo (top of every page) | Replace the file to change the logo |
| `guru.jpg` | The faint background watermark image | Replace the file to change the watermark |
| `qrcode.min.js` | Third-party QR code library, bundled locally | **Don't edit** |
| `SETUP_INSTRUCTIONS.md` | One-time setup: Firebase, PayPal, Gmail, GitHub Pages | Deployment/service setup |
| `serve.ps1` | Local test server (not part of the live site) | Don't need to touch |

**Rule of thumb:** *text and layout* → `index.html`; *how it looks* →
`style.css`; *sevas, prices, payment accounts* → top of `app.js`.

---

## 2. Common changes — colors, fonts, sizes

All colors and fonts are defined **once**, at the very top of `style.css`,
as "variables" — change a value there and it updates everywhere on the site
(registration, admin, and check-in pages all share this one file).

```css
:root {
  --color-bg: #ddc79a;          /* page background (beige) */
  --color-bg-alt: #d3ba86;      /* slightly darker background accent */
  --color-surface: #fbf6ec;     /* card / input background (cream) */
  --color-surface-raised: #f6efe0; /* slightly raised card background */
  --color-text: #3a2414;        /* main body text (dark brown) */
  --color-text-muted: #6f5c46;  /* secondary/lighter text */
  --color-gold: #b3781a;        /* headings, buttons, accents */
  --color-gold-soft: #8f5c12;   /* softer gold accent */
  --color-vermillion: #a5320a;  /* small flame-divider icons */
  --color-error: #b3261e;       /* form error messages */
  --color-wine: #6d1f2c;        /* the big hero title color */
  --font-display: 'Cormorant Garamond', Georgia, serif;  /* headings */
  --font-body: 'Work Sans', -apple-system, sans-serif;   /* body text */
  --radius: 10px;               /* how rounded cards/buttons are */
}
```

**To change a color:** replace the hex code after the color you want to
change, e.g. `--color-gold: #b3781a;` → `--color-gold: #1a6b3a;` for green.
Any standard color picker (search "hex color picker") gives you a code like
`#rrggbb` to paste in.

**To change the font:** replace the font name in `--font-display` (used for
all headings) or `--font-body` (used for everything else). If you pick a new
Google Font, also update the `<link href="https://fonts.googleapis.com/...">`
line near the top of `index.html`, `admin.html`, and `checkin.html` to load it.

**To resize the big page title** ("Sri Raghavendra Aradhana Mahotsava
2026"), find this block further down `style.css`:

```css
.hero h1 {
  font-size: clamp(2.5rem, 6.8vw, 3.9rem);
  color: var(--color-wine);
}
```

`clamp(min, preferred, max)` means: never smaller than `2.5rem`, never
bigger than `3.9rem`, and scale in between based on screen width. To make it
bigger overall, raise the first and third numbers a bit, e.g.
`clamp(2.8rem, 7vw, 4.3rem)`. (`1rem` ≈ 16px, so `2.5rem` ≈ 40px.)

**To resize other text** (seva card titles, form labels, buttons, etc.),
search `style.css` for the relevant class name (e.g. `.seva-card h4`,
`.field label`, `.pay-btn`) and change its `font-size`. Most section
comments (`/* ---------- Seva grid ---------- */`) mark which part of the
page each block controls, to help you find the right one.

---

## 3. Logo and watermark images

- **Logo** (top of every page): replace `logo.jpeg` with your new image,
  **keeping the exact same filename**. To change its size, edit `.org-logo`
  in `style.css` (`max-width: 408px;` — raise or lower this number).
- **Watermark** (the faint image behind the whole page): replace `guru.jpg`,
  keeping the same filename. To make the watermark **fainter or stronger**,
  find this in the `body` rule near the top of `style.css`:

  ```css
  linear-gradient(rgba(221, 199, 154, 0.96), rgba(221, 199, 154, 0.96)),
  ```

  The last number (`0.96`) is how much beige is painted over the image —
  closer to `1` = fainter watermark, closer to `0` = more visible. To make
  the watermark **bigger or smaller**, change `min(78vw, 540px)` a few lines
  below (the `540px` is its max size on large screens).

If you use a different filename for either image, you must also update the
matching reference: `logo.jpeg` is referenced in the `<img src="logo.jpeg">`
tag in `index.html`; `guru.jpg` is referenced in the `url("guru.jpg")` line
in `style.css`.

---

## 4. Page text and headings

Open `index.html` and edit the text directly — it's plain English inside
HTML tags, safe to change freely as long as you don't touch anything
starting with `<` or `id="..."`. Key spots:

- Page title (browser tab): the `<title>` line near the top.
- Big heading + subtitle: inside `<header class="hero">` — the `<h1>` and
  the `<p class="hero-sub">` just after it.
- Section headings ("Your details", "Choose your sevas", "Complete your
  registration"): each `<h2>` inside `<main>`.
- Footer / privacy note: the `<footer>` block near the bottom.

The **event name** used in confirmation emails is separate — it lives in
`config.js`:

```js
export const EVENT_NAME = "Sri Raghavendra Aradhana Mahotsava 2026";
```

---

## 5. Sevas, prices, and payment details

All near the top of `app.js`, clearly commented:

```js
const PAYPAL_ME_USERNAME = "sameerchilmattur";   // your paypal.me username

const BANK_DETAILS = {
  holder: "DE SRS Brundavan e.V.",
  iban: "DE00 1234 5678 9012 3456 00",
  bic: "TESTDEFFXXX"
};

const SEVAS = [
  { id: "tbd-seva", name: "TBD Seva", desc: "Special seva to be decided.", price: 501 },
  // ... one line per seva
];
```

- **Add a seva:** copy an existing line, give it a unique `id` (lowercase,
  no spaces — use hyphens), a `name`, a short `desc`, and a `price` (whole
  euros, no currency symbol).
- **Remove a seva:** delete its line.
- **Reprice a seva:** change the `price` number only.
- **Change bank details / PayPal username:** edit those values directly.

No seva selected at registration = automatically treated as a free
darshana — that's handled by the code, not the list, so you don't need a
"free" entry.

---

## 6. Who can access the admin dashboard

The admin login email is set in **two places that must match**:

1. `firestore.rules` — the `isAdmin()` function near the top:
   ```js
   function isAdmin() {
     return request.auth != null
            && request.auth.token.email == "sameer.cb@gmail.com";
   }
   ```
2. The Firebase Console (**Authentication → Users**) — where the actual
   login account with that email + a password exists.

To change the admin, update the email in `firestore.rules`, **re-publish
those rules in the Firebase Console** (Firestore Database → Rules → paste →
Publish — editing the file here alone does nothing until published), and
create/confirm the matching login under Authentication → Users.

---

## 7. What NOT to edit casually

- **`qrcode.min.js`** — a third-party library file, not meant to be hand-edited.
- **`firebase-config.js`** — only touch this if switching to a different
  Firebase project entirely (see `SETUP_INSTRUCTIONS.md`).
- **IDs in HTML** (`id="..."`) and **class names** (`class="..."`) — these
  are what `app.js`/`admin.js`/`checkin.js`/`style.css` hook into. Renaming
  or removing one will silently break that part of the page. Editing the
  *text* inside a tag is always safe; editing the *tag's attributes* is not,
  unless you know what you're changing.
- **`Code.gs`** — after editing, it must be **redeployed** in the Apps
  Script editor (Deploy → Manage deployments → Edit → *New version* →
  Deploy) for changes to reach the live email sender. Just saving the file
  there does nothing on its own.

---

## 8. Quick test checklist after any change

1. Run the local server (`serve.ps1`) and open `http://localhost:8000/`.
2. Hard-refresh (Ctrl+Shift+R) so you're not looking at a cached copy.
3. Check the page you changed, and skim `admin.html` / `checkin.html` too if
   you touched `style.css` (they share it).
4. Commit and push once it looks right.
