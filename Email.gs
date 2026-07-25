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