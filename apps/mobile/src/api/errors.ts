import type { Locale } from '../format';

const messages: Record<string, Record<Locale, string>> = {
  OFFLINE: {
    ar: 'تعذر الوصول إلى الخادم. تحقق من الاتصال ثم أعد المحاولة.',
    en: 'The server could not be reached. Check the connection and try again.',
  },
  TIMEOUT: {
    ar: 'استغرق الطلب وقتاً طويلاً. يمكنك المتابعة ثم إعادة المحاولة.',
    en: 'The request took too long. You can continue and try again.',
  },
  AUTH_NOT_CONFIGURED: {
    ar: 'تسجيل الدخول غير مفعّل على هذا الخادم.',
    en: 'Sign-in is not configured on this server.',
  },
  INVALID_CREDENTIALS: {
    ar: 'البريد أو كلمة المرور غير صحيحة.',
    en: 'Email or password is incorrect.',
  },
  EMAIL_NOT_VERIFIED: {
    ar: 'أكد البريد قبل تسجيل الدخول.',
    en: 'Verify the email before signing in.',
  },
  WEAK_PASSWORD: {
    ar: 'كلمة المرور يجب أن تكون من 10 إلى 128 حرفاً.',
    en: 'Password must be 10 to 128 characters.',
  },
  INVALID_CODE: {
    ar: 'الرمز غير صحيح.',
    en: 'That code is not correct.',
  },
  CODE_EXPIRED: {
    ar: 'انتهت صلاحية الرمز. اطلب رمزاً جديداً.',
    en: 'That code expired. Request a new one.',
  },
  INVALID_TOKEN: {
    ar: 'الرمز غير صالح أو منتهٍ.',
    en: 'That code is invalid or expired.',
  },
  INVALID_EMAIL: {
    ar: 'صيغة البريد غير صحيحة.',
    en: 'That email address is not valid.',
  },
  RATE_LIMITED: {
    ar: 'محاولات كثيرة. انتظر ثم أعد المحاولة.',
    en: 'Too many attempts. Wait and try again.',
  },
  DAILY_QUOTA: {
    ar: 'وصلت حد محادثات يزن اليوم حسب خطتك. حاول غداً أو راجع الاشتراك.',
    en: 'You reached today’s Yazan turn limit for your plan. Try tomorrow or check membership.',
  },
  MODEL_PROVIDER_NOT_CONFIGURED: {
    ar: 'المدرب غير متصل بمزوّد نموذج حالياً.',
    en: 'The coach is not connected to a model provider right now.',
  },
  MODEL_REQUEST_FAILED: {
    ar: 'تعذر إكمال رد يزن. أعد المحاولة بعد لحظات.',
    en: 'Yazan could not finish that reply. Try again in a moment.',
  },

  VALIDATION: {
    ar: 'البيانات المدخلة غير مكتملة أو غير صالحة.',
    en: 'The entered details are incomplete or invalid.',
  },
  ONBOARDING_INVALID: {
    ar: 'تعذر حفظ الملف. راجع الخطوة الحالية ثم أعد المحاولة.',
    en: 'The profile could not be saved. Check this step and try again.',
  },
  UNAUTHENTICATED: {
    ar: 'انتهت الجلسة. سجّل الدخول مرة أخرى.',
    en: 'The session expired. Sign in again.',
  },
  CODE_INACTIVE: {
    ar: 'رمز النادي غير فعّال.',
    en: 'This gym code is not active.',
  },
  CONTRACT_INACTIVE: {
    ar: 'عقد النادي غير فعّال.',
    en: 'The gym contract is not active.',
  },
  CONTRACT_MISMATCH: {
    ar: 'رمز النادي لا يطابق العقد.',
    en: 'The gym code does not match the contract.',
  },
};

export function messageFor(code: string, locale: Locale, fallback: string): string {
  return messages[code]?.[locale] ?? fallback;
}
