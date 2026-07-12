/**
 * Seva registration — confirmation email sender.
 *
 * Deploy this as a Google Apps Script Web App (see SETUP_INSTRUCTIONS.md,
 * section 2). It receives a POST request with registration details and
 * sends a confirmation email from your own Gmail account — completely free,
 * no third-party email service involved.
 *
 * NOTE: after editing this file you must redeploy for changes to go live —
 * Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy.
 * Saving the file alone does NOT update the running Web App.
 */

// Organisation details shown in the email footer / used as the reply address.
// Set REPLY_TO to a monitored inbox (leave "" to let replies go to the
// sending Gmail account). ORG_NAME appears in the email signature.
var REPLY_TO = "";
var ORG_NAME = "DE SRS Brundavan e.V.";

// Firestore project this site uses (see firebase-config.js — these two
// values are the public web config, safe to duplicate here; security comes
// from firestore.rules, not from hiding them).
var FIREBASE_PROJECT_ID = "desrsb2026";
var FIREBASE_API_KEY = "AIzaSyBwG-okIIgGisDmLcp39NtNSWbxDsdy4l4";

// Visiting the deployed Web App URL in a browser hits this — handy for
// confirming the deployment is live before wiring it into the site.
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "Seva confirmation email endpoint is live. Send a POST to trigger an email." }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var required = ["to_email", "to_name", "event_name", "seva_summary", "total_amount", "order_id", "checkin_url"];
    for (var i = 0; i < required.length; i++) {
      if (!data[required[i]]) {
        throw new Error("Missing field: " + required[i]);
      }
    }

    // Without this check, anyone who finds this Web App URL could POST
    // arbitrary data and use your Gmail account to send emails to arbitrary
    // addresses. This confirms the order_id is a real, approved registration
    // in Firestore — and that the claimed email actually matches it — before
    // sending anything.
    var registration = fetchRegistration(data.order_id);
    if (!registration) {
      throw new Error("No matching registration found for this reference.");
    }
    if (String(registration.email).toLowerCase() !== String(data.to_email).toLowerCase()) {
      throw new Error("Email does not match this registration.");
    }
    if (registration.paymentStatus !== "paid" && registration.paymentStatus !== "not_required") {
      throw new Error("Registration payment is not confirmed yet.");
    }

    var subject = "Your registration for " + data.event_name;

    var plainBody =
      "Namaskara " + data.to_name + ",\n\n" +
      "This email confirms your seva registration for " + data.event_name + ".\n\n" +
      "Sevas:\n" + data.seva_summary + "\n\n" +
      "Number of participants: " + (data.participants || 1) + "\n" +
      "Total: EUR " + data.total_amount + "\n" +
      "Registration reference: " + data.order_id + "\n\n" +
      "ENTRANCE CHECK-IN\n" +
      "Please bring this reference to the entrance. You can also open your\n" +
      "personal check-in page here:\n" + data.checkin_url + "\n\n" +
      "If any detail above is incorrect, simply reply to this email and we'll\n" +
      "help sort it out.\n\n" +
      "With gratitude,\n" + ORG_NAME;

    // Apps Script has no DOM/browser, so the same client-side QR library used
    // on the site can't run here — this generates the QR image server-side
    // via a public QR API instead, using only the check-in URL (no personal
    // details), and attaches it inline so it renders without any external
    // image request from the recipient's mail client.
    var qrImageUrl = "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=" + encodeURIComponent(data.checkin_url);
    var qrBlob = UrlFetchApp.fetch(qrImageUrl).getBlob().setName("qrcode");

    // Escape registrant-supplied text before dropping it into the HTML body.
    var name = escapeHtml(data.to_name);
    var sevaSummaryHtml = escapeHtml(data.seva_summary).replace(/\n/g, "<br>");
    var checkinUrl = encodeURI(data.checkin_url);

    // Plenty of real text alongside the QR image (rather than an image-only
    // email) keeps this out of spam filters, and the check-in link gives a
    // working fallback if the image is blocked by the recipient's mail client.
    var htmlBody =
      "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#222;line-height:1.5\">" +
      "<p>Namaskara " + name + ",</p>" +
      "<p>This email confirms your seva registration for <b>" + escapeHtml(data.event_name) + "</b>.</p>" +
      "<table cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 16px\">" +
      "<tr><td style=\"padding:2px 16px 2px 0;color:#666\">Sevas</td><td>" + sevaSummaryHtml + "</td></tr>" +
      "<tr><td style=\"padding:2px 16px 2px 0;color:#666\">Participants</td><td>" + escapeHtml(String(data.participants || 1)) + "</td></tr>" +
      "<tr><td style=\"padding:2px 16px 2px 0;color:#666\">Total</td><td>EUR " + escapeHtml(data.total_amount) + "</td></tr>" +
      "<tr><td style=\"padding:2px 16px 2px 0;color:#666\">Reference</td><td>" + escapeHtml(data.order_id) + "</td></tr>" +
      "</table>" +
      "<p><b>Entrance check-in:</b> please show the QR code below at the door " +
      "(or open your <a href=\"" + checkinUrl + "\">personal check-in page</a>).</p>" +
      "<p><img src=\"cid:qrcode\" width=\"220\" height=\"220\" alt=\"Registration QR code\" style=\"border:1px solid #ddd\"></p>" +
      "<p>If any detail above is incorrect, just reply to this email and we'll help sort it out.</p>" +
      "<p style=\"color:#666\">With gratitude,<br>" + escapeHtml(ORG_NAME) + "</p>" +
      "</div>";

    var options = {
      name: ORG_NAME, // shows as the "from" display name
      htmlBody: htmlBody,
      inlineImages: { qrcode: qrBlob }
    };
    if (REPLY_TO) {
      options.replyTo = REPLY_TO;
    }

    GmailApp.sendEmail(data.to_email, subject, plainBody, options);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Reads one registration doc from Firestore via its public REST API.
// firestore.rules allows "get" on a single doc by exact ID for anyone
// (that's what powers the entrance check-in page too), so this needs no
// service-account credentials — just the doc's own ID.
// Returns a plain { email, paymentStatus, ... } object, or null if the
// doc doesn't exist or couldn't be read.
function fetchRegistration(orderId) {
  var url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID +
    "/databases/(default)/documents/registrations/" + encodeURIComponent(orderId) +
    "?key=" + FIREBASE_API_KEY;

  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    return null;
  }

  var doc = JSON.parse(response.getContentText());
  if (!doc.fields) {
    return null;
  }

  return {
    email: firestoreValue(doc.fields.email),
    paymentStatus: firestoreValue(doc.fields.paymentStatus)
  };
}

// Firestore REST documents wrap every value as { stringValue: "..." },
// { integerValue: "..." }, etc. This unwraps the plain value for the types
// this file actually reads.
function firestoreValue(field) {
  if (!field) return null;
  if ("stringValue" in field) return field.stringValue;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("doubleValue" in field) return field.doubleValue;
  if ("booleanValue" in field) return field.booleanValue;
  return null;
}
