import { buildEmailHtml } from './buildEmailHtml.js';

interface NewsletterContent {
  headline: string;
  sections?: Array<{
    icon?: string;
    title: string;
    items: string[];
  }>;
  member_sections?: Array<{
    name: string;
    text: string;
    avatar_url?: string | null;
  }>;
  featured_photos?: Array<{
    url: string;
    post_title: string;
    author_name: string;
  }>;
  stats: { posts: number; photos: number; members_active: number };
  closing: string;
}

interface EmailUser {
  id: string;
  name: string | null;
  email: string;
}

export async function sendNewsletterEmails(
  familyName: string,
  month: number,
  year: number,
  content: NewsletterContent,
  recipients: EmailUser[],
  resendApiKey?: string,
  fromEmail?: string,
  logger?: any
): Promise<{ sent: number; failed: number }> {
  if (!resendApiKey || !fromEmail) {
    logger?.warn('RESEND_API_KEY or NEWSLETTER_FROM_EMAIL not configured, skipping email send');
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  const emailHtml = buildEmailHtml(familyName, month, year, content);
  const subject = `Famly Rückblick: ${familyName} – Ein monatlicher Newsletter`;

  for (const recipient of recipients) {
    if (!recipient.email) {
      logger?.warn({ userId: recipient.id }, 'User has no email, skipping');
      continue;
    }

    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: recipient.email,
          subject,
          html: emailHtml,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        logger?.error({ email: recipient.email, status: emailRes.status, err: errText }, 'Failed to send newsletter email');
        failed++;
      } else {
        logger?.info({ email: recipient.email }, 'Newsletter email sent successfully');
        sent++;
      }
    } catch (err) {
      logger?.error({ err, email: recipient.email }, 'Error sending newsletter email');
      failed++;
    }
  }

  return { sent, failed };
}
