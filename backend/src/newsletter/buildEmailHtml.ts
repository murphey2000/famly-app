import { getGermanMonth } from './germanMonths.js';

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

export function buildEmailHtml(
  familyName: string,
  month: number,
  year: number,
  content: NewsletterContent
): string {
  const monthName = getGermanMonth(month);

  const sectionsHtml = (content.sections || [])
    .map(
      (s) => `
      <div style="margin-bottom:20px;">
        <div style="font-size:16px;font-weight:700;color:#1a1a2e;margin-bottom:8px;">${escapeHtml(s.icon || '▸')} ${escapeHtml(s.title)}</div>
        ${(s.items || [])
          .map((item) => `<div style="font-size:14px;color:#444;margin-bottom:6px;margin-left:16px;">• ${escapeHtml(item)}</div>`)
          .join('')}
      </div>`
    )
    .join('');

  const memberSectionsHtml = (content.member_sections || [])
    .map(
      (m) => `
      <div style="background:#f8f9ff;border-left:4px solid #2d78f5;padding:16px 20px;margin-bottom:16px;border-radius:0 8px 8px 0;">
        <div style="font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:8px;">${escapeHtml(m.name)}</div>
        <div style="font-size:14px;color:#444;line-height:1.6;">${escapeHtml(m.text)}</div>
      </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Famly Newsletter ${monthName} ${year}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f8;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2d78f5,#5b9bff);padding:32px 40px;">
            <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Famly</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">Monatlicher Rückblick</div>
          </td>
        </tr>
        <!-- Month title -->
        <tr>
          <td style="padding:32px 40px 0;">
            <div style="font-size:28px;font-weight:800;color:#1a1a2e;">${monthName} ${year}</div>
            <div style="font-size:15px;color:#888;margin-top:4px;">Familie ${escapeHtml(familyName)}</div>
            <div style="height:1px;background:#eee;margin:20px 0;"></div>
            <div style="font-size:20px;font-weight:700;color:#2d78f5;margin-bottom:12px;">${escapeHtml(content.headline)}</div>
          </td>
        </tr>
        <!-- Stats -->
        <tr>
          <td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f5ff;border-radius:12px;padding:20px;">
              <tr>
                <td align="center" style="padding:8px;">
                  <div style="font-size:24px;font-weight:800;color:#2d78f5;">${content.stats.photos}</div>
                  <div style="font-size:12px;color:#666;margin-top:2px;">Fotos</div>
                </td>
                <td align="center" style="padding:8px;border-left:1px solid #dde8ff;border-right:1px solid #dde8ff;">
                  <div style="font-size:24px;font-weight:800;color:#2d78f5;">${content.stats.posts}</div>
                  <div style="font-size:12px;color:#666;margin-top:2px;">Beiträge</div>
                </td>
                <td align="center" style="padding:8px;">
                  <div style="font-size:24px;font-weight:800;color:#2d78f5;">${content.stats.members_active}</div>
                  <div style="font-size:12px;color:#666;margin-top:2px;">Mitglieder</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Sections -->
        <tr>
          <td style="padding:0 40px 24px;">
            ${sectionsHtml}
          </td>
        </tr>
        <!-- Member Sections -->
        ${memberSectionsHtml ? `<tr><td style="padding:0 40px 24px;">${memberSectionsHtml}</td></tr>` : ''}
        <!-- Closing -->
        <tr>
          <td style="padding:0 40px 32px;">
            <div style="height:1px;background:#eee;margin-bottom:20px;"></div>
            <div style="font-size:14px;color:#555;line-height:1.7;">${escapeHtml(content.closing)}</div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9ff;padding:20px 40px;text-align:center;">
            <div style="font-size:12px;color:#aaa;">Erstellt mit ❤️ von Famly • famly.app</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
