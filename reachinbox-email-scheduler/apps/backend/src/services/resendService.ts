import { Resend } from 'resend';
import { env } from '../config/env';

let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface SendResendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

export async function sendEmailViaResend(params: SendResendEmailParams): Promise<{ id: string }> {
  const resend = getResendClient();
  const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;

  if (!resend || !apiKey) {
    throw new Error('RESEND_API_KEY is not configured in backend environment');
  }

  const fromAddress = params.from || env.EMAIL_FROM || process.env.EMAIL_FROM || 'onboarding@resend.dev';

  const response = await resend.emails.send({
    from: fromAddress,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html || `<div>${params.text.replace(/\n/g, '<br/>')}</div>`,
  });

  if (response.error) {
    throw new Error(`Resend API Error: ${response.error.message}`);
  }

  if (!response.data?.id) {
    throw new Error('Resend API returned empty email ID');
  }

  return { id: response.data.id };
}
