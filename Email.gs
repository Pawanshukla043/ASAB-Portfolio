/**
 * ============================================================
 *  ALLOWED DOMAINS & KEY VALIDATION
 * ============================================================
 *
 *  Reads from the "allowed_domains" sheet which has 2 columns:
 *    secret_key  |  domain
 *
 *  On each request, validates that the provided _key exists
 *  in the sheet AND the _origin matches a domain for that key.
 *
 *  To add/rotate keys or domains — just edit the sheet.
 * ============================================================
 */

const POST_ALLOWED_DOMAINS_CACHE_KEY = "post_allowed_domains_v1";
const POST_ALLOWED_DOMAINS_CACHE_TTL = 120; // 2 minutes

/**
 * Loads the allowed_domains sheet into a Map: secret_key -> [domain list]
 * Uses CacheService to avoid reading the sheet on every request.
 */
function loadPostAllowedDomains() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(POST_ALLOWED_DOMAINS_CACHE_KEY);

  if (cached) {
    const parsed = JSON.parse(cached);
    const map = new Map();
    for (const [key, domains] of Object.entries(parsed)) {
      map.set(key, domains);
    }
    return map;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("allowed_domains");

  if (!sheet) {
    console.warn('Sheet "allowed_domains" not found. Denying all POST requests.');
    return new Map();
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    console.warn('Sheet "allowed_domains" has no data rows. Denying all POST requests.');
    return new Map();
  }

  const domainMap = new Map();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0] && !row[1]) continue;

    const secretKey = String(row[0] || "").trim();
    const domain = String(row[1] || "").trim();

    if (!secretKey || !domain) continue;

    if (!domainMap.has(secretKey)) {
      domainMap.set(secretKey, []);
    }
    domainMap.get(secretKey).push(domain);
  }

  // Cache as plain object
  const cacheObj = {};
  for (const [key, domains] of domainMap) {
    cacheObj[key] = domains;
  }
  cache.put(POST_ALLOWED_DOMAINS_CACHE_KEY, JSON.stringify(cacheObj), POST_ALLOWED_DOMAINS_CACHE_TTL);

  return domainMap;
}

/**
 * Validates the POST request by checking:
 *   - _key is present in the request body
 *   - _origin is present in the request body
 *   - _key exists in allowed_domains sheet
 *   - _origin matches a domain associated with that key
 */
function validatePostRequest(requestBody) {
  const providedKey = (requestBody && requestBody._key) || "";
  const providedOrigin = (requestBody && requestBody._origin) || "";

  if (!providedKey) {
    return { valid: false, reason: "Missing API key" };
  }

  if (!providedOrigin) {
    return { valid: false, reason: "Missing origin" };
  }

  const domainMap = loadPostAllowedDomains();
  const allowedDomains = domainMap.get(providedKey);

  if (!allowedDomains) {
    return { valid: false, reason: "Invalid API key" };
  }

  const isDomainAllowed = allowedDomains.some(allowedDomain =>
    providedOrigin === allowedDomain ||
    providedOrigin.startsWith(allowedDomain + "/") ||
    providedOrigin.startsWith(allowedDomain + ":")
  );

  if (!isDomainAllowed) {
    return { valid: false, reason: "Domain not allowed for this API key" };
  }

  return { valid: true };
}

function doPost(e) {
  try {

    // ----------------------------
    // Validate Request
    // ----------------------------

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No POST data received.");
    }

    const data = JSON.parse(e.postData.contents || "{}");

    // ----------------------------
    // API Key + Domain Validation
    // ----------------------------

    const validation = validatePostRequest(data);
    if (!validation.valid) {
      console.warn("POST request rejected:", validation.reason);
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: validation.reason
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Remove auth fields before processing email
    delete data._key;
    delete data._origin;

    // ----------------------------
    // Escape HTML
    // ----------------------------

    const escapeHtml = (text) => {
      return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const name = escapeHtml(data.name).trim();
    const email = escapeHtml(data.email).trim();
    const mobile = escapeHtml(data.mobile).trim();
    const description = escapeHtml(data.description).trim();

    // ----------------------------
    // Validation
    // ----------------------------

    if (!name || !email || !mobile || !description) {
      throw new Error("All fields are required.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      throw new Error("Invalid email address.");
    }

    // ----------------------------
    // Subjects
    // ----------------------------

    const adminSubject = `${name} wants to connect with ASAB`;
    const clientSubject = `Thank you for contacting ASAB, ${name}`;

    // ----------------------------
    // Admin Email
    // ----------------------------

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body{font-family:Arial,sans-serif;background:#555;padding:20px;margin:0;}
            .container{background:#fff;padding:30px;border-radius:10px;max-width:600px;margin:0 auto;box-shadow:0 2px 10px rgba(0,0,0,.1);}
            .header{background:#237cc4;color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center;margin:-30px -30px 20px;}
            .content{padding:20px 0;line-height:1.6;color:#333;}
            .info-box{background:#f9f9f9;padding:15px;border-left:4px solid #237cc4;margin:15px 0;border-radius:4px;}
            .footer{text-align:center;color:#888;margin-top:30px;padding-top:20px;border-top:1px solid #eee;font-size:14px;}
            .compeny-name{color:#237cc4;}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin:0;">🎵 New Contact Request</h2>
            </div>
            <div class="content">
              <p>Hi ASAB,</p>
              <p>You found a contact request from:</p>
              <div class="info-box">
              <strong>Name:</strong> ${name}
              </div>
              <div class="info-box">
                <strong>Message:</strong><br>${description}
              </div>
              <div class="info-box">
                <strong>Contact Details:</strong><br>
                  📧 Email: <a href="mailto:${email}">${email}</a><br>
                  📱 Mobile: ${mobile}
              </div>
            </div>
            <div class="footer">
              <p>
              Best Regards<br>
              <strong class="compeny-name">Bluemoon Production</strong>
              </p>
            </div>
          </div>
        </body>
      </html>
      `;

    // ----------------------------
    // Client Email
    // ----------------------------

    const htmlClientBody = `
      <!DOCTYPE html>
        <html>
          <head>
            <style>
              body{font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0;}
              .container{background:#fff;padding:30px;border-radius:10px;max-width:600px;margin:0 auto;box-shadow:0 2px 10px rgba(0,0,0,.1);}
              .header{background:#237cc4;color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center;margin:-30px -30px 20px;}
              .content{padding:20px 0;line-height:1.6;color:#333;}
              .info-box{background:#f9f9f9;padding:15px;border-left:4px solid #237cc4;margin:15px 0;border-radius:4px;}
              .footer{text-align:center;color:#888;margin-top:30px;padding-top:20px;border-top:1px solid #eee;font-size:14px;}
              .compeny-name{color:#237cc4;}
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2 style="margin:0;">🎵 New Contact Request</h2>
              </div>
              <div class="content">
                <p>Hi ${name},</p>
                <p>You have tried to contact request to <strong>ASAB</strong> with bellow details</p>
                <div class="info-box">
                  <strong>Name:</strong> ${name}
                </div>
                <div class="info-box">
                  <strong>Message:</strong><br>${description}
                </div>
                <div class="info-box">
                  <strong>Contact Details:</strong><br>
                  📧 Email: <a href="mailto:${email}">${email}</a><br>
                  📱 Mobile: ${mobile}
                </div>
              </div>
              <div class="footer">
                <p>Thanks for contacting ASAB.</p>
                <p>Best Regards<br>
                  <strong class="compeny-name">Bluemoon Production</strong>
                  <br>
                  Mobile: +91 7049355384
                </p>
              </div>
            </div>
          </body>
        </html>
      `;
    // ----------------------------
    // Plain Text
    // ----------------------------

    const adminText = `New Contact Request
    Name: ${name}
    Email: ${email}
    Mobile: ${mobile}
    Message: ${description}`;

    const clientText = `Hi ${name},
      Thank you for contacting ASAB.
      We have received your request.
    Name: ${name}
    Email: ${email}
    Mobile: ${mobile}
    Message: ${description}
    Best Regards
    Bluemoon Production`;

    // ----------------------------
    // Send Admin Email
    // ----------------------------

    MailApp.sendEmail({
      to: "anshumansb123@gmail.com",
      subject: adminSubject,
      body: adminText,
      htmlBody: htmlBody,
      replyTo: email,
      name: "Bluemoon Production"
    });

    // ----------------------------
    // Send Client Email
    // ----------------------------

    MailApp.sendEmail({
      to: email,
      subject: clientSubject,
      body: clientText,
      htmlBody: htmlClientBody,
      name: "Bluemoon Production"
    });

    // ----------------------------
    // Success
    // ----------------------------

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  catch (error) {
    console.error(error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}