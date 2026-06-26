# Email via Google Apps Script relay (no DNS, no SMTP, no 3rd-party service)

DigitalOcean blocks outbound SMTP, and Resend/SendGrid both want you to verify a
sender. This route sidesteps all of that: a tiny Google Apps Script web app sends
email **through your own `info@balidoc.com` Gmail** over HTTPS, so it can email
anyone with no domain DNS and no extra service.

## One-time setup (≈3 minutes, all clicks)

1. Sign in to Google as **info@balidoc.com**, go to **https://script.google.com** → **New project**.
2. Delete the sample code and paste this (the secret is already filled in):

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.secret !== 'f9f090721ba2049f6680dffe4cbbc1b3535e') {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'forbidden' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    GmailApp.sendEmail(data.to, data.subject, data.text || '', {
      name: 'BaliDoc',
      htmlBody: data.html || undefined
    });
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. Save (💾). Then **Deploy → New deployment**.
4. Click the gear ⚙ → **Web app**. Set:
   - **Execute as:** Me (info@balidoc.com)
   - **Who has access:** Anyone
   - **Deploy**.
5. Google will ask to authorize → pick the account → if it warns "Google hasn't
   verified this app", click **Advanced → Go to <project> (unsafe)** → **Allow**
   (this grants the script permission to send mail as you).
6. Copy the **Web app URL** (ends in `/exec`) and send it over.

## Wire it into production
On the droplet `/opt/simple-asana/.env`:
```
GAS_EMAIL_URL=<the /exec URL>
GAS_EMAIL_SECRET=f9f090721ba2049f6680dffe4cbbc1b3535e
```
then `docker-compose up -d`. The app's `sendMail` (src/lib/email.ts) uses this relay
first when `GAS_EMAIL_URL` is set.

## Notes
- Sends from `info@balidoc.com` (real Gmail/Workspace identity → good deliverability,
  Google's own SPF/DKIM; nothing to configure).
- Daily send cap: ~500/day (consumer Gmail) or ~1,500–2,000/day (Workspace) — plenty
  for @mention notifications.
- To rotate the secret, change it in both the script and the env.
- Still not HIPAA-BAA-covered — this is the interim non-PHI notification path.
