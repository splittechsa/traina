export type MailPurpose = 'verify' | 'reset' | 'notice';

export type MailMessage = { to: string; purpose: MailPurpose; code?: string };

export type DeliveryState = 'sent' | 'unconfigured' | 'failed';

type Env = Record<string, string | undefined>;

export function emailProvider(env: Env): 'resend' | 'unconfigured' {
  const key = env.SAHHTI_EMAIL_API_KEY;
  const from = env.SAHHTI_EMAIL_FROM;
  if (env.SAHHTI_EMAIL_PROVIDER !== 'resend' || key === undefined || key.length < 8 || from === undefined || from.length === 0) {
    return 'unconfigured';
  }
  return 'resend';
}

/** Sends through Resend when the server env is complete. The key never leaves the API process. */
export async function deliverEmail(env: Env, message: MailMessage, fetchImpl: typeof fetch = fetch): Promise<DeliveryState> {
  if (emailProvider(env) !== 'resend') {
    return 'unconfigured';
  }
  const key = env.SAHHTI_EMAIL_API_KEY ?? '';
  const from = env.SAHHTI_EMAIL_FROM ?? '';
  const text =
    message.purpose === 'verify' && message.code !== undefined
      ? `صحتي: رمز التحقق ${message.code}. ينتهي خلال 10 دقائق.\nSahhti code: ${message.code}. It expires in 10 minutes.`
      : message.purpose === 'reset' && message.code !== undefined
        ? `صحتي: رمز إعادة التعيين ${message.code}. ينتهي خلال 15 دقيقة.\nSahhti reset code: ${message.code}. It expires in 15 minutes.`
        : 'إذا كان لديك حساب في صحتي فسجّل الدخول. إذا نسيت كلمة المرور فاطلب إعادة التعيين.\nIf you already have a Sahhti account, sign in. If you forgot the password, request a reset.';
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.purpose === 'reset' ? 'Sahhti password reset' : 'Sahhti',
      text,
    }),
  }).catch(() => null);
  return response?.ok === true ? 'sent' : 'failed';
}
