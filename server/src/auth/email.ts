/* Magic-link email sender.
 *
 * Pass B placeholder: prints the link to the server console with high
 * visibility so dev/test flows can copy it. When EMAIL_PROVIDER=postmark or
 * EMAIL_PROVIDER=ses is set, we'll branch here to the real transactional
 * email path. */

import { config } from '../config.js';

export type SendMagicLinkInput = {
  to: string;
  link: string;
  scope: 'school' | 'la' | 'platform-admin';
  context?: string;          // human-friendly description ("Lambeth Council leaflet")
};

export async function sendMagicLink(input: SendMagicLinkInput): Promise<void> {
  if (config.emailProvider === 'none') {
    const bar = '─'.repeat(70);
    console.log(`\n${bar}`);
    console.log(`📧 MAGIC LINK (dev mode — no email provider configured)`);
    console.log(`   to:    ${input.to}`);
    console.log(`   scope: ${input.scope}${input.context ? ` (${input.context})` : ''}`);
    console.log(`   link:  ${input.link}`);
    console.log(`${bar}\n`);
    return;
  }

  // Pass B follow-on: branch on config.emailProvider for Postmark / SES.
  throw new Error(
    `Email provider "${config.emailProvider}" is not yet wired. ` +
      `Configure EMAIL_PROVIDER=none for dev (links log to the server console).`
  );
}
