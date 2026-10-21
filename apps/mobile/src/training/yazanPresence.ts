import type { SessionStatus } from '@sahhti/domain';
export type YazanContext =
  | {
      surface: 'home';
      hasResume: boolean;
      hasTodayWorkout: boolean;
      mealLogged: boolean;
      weekCompleted: number;
      weekPlanned: number;
      completedWorkouts: number;
    }
  | {
      surface: 'training';
      hasActivePlan: boolean;
      hasResume: boolean;
      todayCount: number;
    }
  | {
      surface: 'nutrition';
      entryCount: number;
    }
  | {
      surface: 'progress';
      completedWorkouts: number;
      weightLogged: boolean;
    }
  | {
      surface: 'weekly';
      sessionsCompleted: number;
      mealDaysLogged: number;
    }
  | {
      surface: 'workout';
      status?: SessionStatus;
      exerciseName: string;
      setCount: number;
    };

export function yazanTip(locale: 'ar' | 'en', ctx: YazanContext): string {
  const ar = locale === 'ar';
  switch (ctx.surface) {
    case 'home': {
      if (ctx.hasResume) {
        return ar
          ? 'عندك جلسة مفتوحة. كمّلها الآن قبل ما يبرد الزخم.'
          : 'You have an open session. Finish it before the momentum cools.';
      }
      if (ctx.hasTodayWorkout) {
        return ar
          ? 'تمرين اليوم جاهز. ابدأ به، وأنا أشرح أي حركة تحتاجها.'
          : "Today's workout is ready. Start it — I'll explain any move you need.";
      }
      if (!ctx.mealLogged) {
        return ar
          ? 'ما سجّلت وجبات اليوم. حتى لو كانت بسيطة، سجّل شيء يحافظ على المسار.'
          : "No meals logged today. Even a simple log keeps the path visible.";
      }
      if (ctx.weekPlanned > 0 && ctx.weekCompleted === 0) {
        return ar
          ? 'هذا الأسبوع لسه ما كمّلت جلسة. اختر خطة تناسب أيامك وابدأ بيوم واحد.'
          : "No sessions finished this week yet. Pick a plan that fits your days and start with one.";
      }
      if (ctx.completedWorkouts >= 3) {
        return ar
          ? `أنجزت ${ctx.completedWorkouts} تمارين. الاستمرارية أهم من المثالية — حافظ على الإيقاع.`
          : `You've completed ${ctx.completedWorkouts} workouts. Consistency beats perfection — keep the rhythm.`;
      }
      return ar
        ? 'ابدأ من قالب جاهز يناسب هدفك، أو اسألني أقترح لك خطة.'
        : 'Start from a ready template that fits your goal, or ask me to suggest a plan.';
    }
    case 'training': {
      if (ctx.hasResume) {
        return ar ? 'رجع للجلسة الجارية — أفضل من فتح جلسة جديدة.' : 'Resume the open session — better than starting a new one.';
      }
      if (!ctx.hasActivePlan) {
        return ar
          ? 'ما عندك خطة نشطة. جرّب بوش بول ليق أو جسم كامل حسب أيامك.'
          : 'No active plan. Try Push Pull Legs or Full Body based on your available days.';
      }
      if (ctx.todayCount === 0) {
        return ar
          ? 'خطتك نشطة. ابدأ يوم البرنامج أو خصّص التمارين قبل الجلسة.'
          : 'Your plan is active. Start a program day or customize exercises before the session.';
      }
      return ar
        ? 'لو تمرين ما يناسبك، استبدله من داخل الخطة — نفس العضلة، معدات مختلفة.'
        : "If an exercise doesn't fit, swap it inside the plan — same muscle, different equipment.";
    }
    case 'nutrition': {
      if (ctx.entryCount === 0) {
        return ar
          ? 'ما في سجل وجبات لهذا اليوم. سجّل وجبة جاهزة أو ابني وجبتك — الأرقام توجّه التدريب.'
          : 'No meals logged for this day. Log a ready meal or build one — numbers guide training.';
      }
      return ar
        ? 'سجّلت وجبات اليوم. حافظ على البروتين قريب من هدفك، وأخبرني لو تبي تعديل بسيط.'
        : "Meals are logged today. Keep protein near your target — ask me if you want a small tweak.";
    }
    case 'progress': {
      if (!ctx.weightLogged) {
        return ar
          ? 'ما في وزن حديث. سجّل وزنك مرة هذا الأسبوع عشان نقرأ الاتجاه بهدوء.'
          : 'No recent weight. Log once this week so we can read the trend calmly.';
      }
      if (ctx.completedWorkouts === 0) {
        return ar
          ? 'التقدم يبدأ بجلسة واحدة. اختر قالب وكمّل يومك الأول.'
          : 'Progress starts with one session. Pick a template and finish day one.';
      }
      return ar
        ? `عندك ${ctx.completedWorkouts} تمارين مكتملة. راجع الأرقام بهدوء — التغيير الحقيقي يظهر على أسابيع.`
        : `You have ${ctx.completedWorkouts} completed workouts. Read the numbers calmly — real change shows over weeks.`;
    }
    case 'weekly': {
      if (ctx.sessionsCompleted === 0 && ctx.mealDaysLogged === 0) {
        return ar
          ? 'هذا الأسبوع خفيف في البيانات. كمّل تشيك-إن بصدق — المدرب البشري يحتاج صورة واضحة.'
          : 'This week is light on data. Complete the check-in honestly — your human coach needs a clear picture.';
      }
      return ar
        ? `أنجزت ${ctx.sessionsCompleted} جلسات و${ctx.mealDaysLogged} أيام وجبات. هذا أساس مراجعة أسبوعية مفيدة.`
        : `You finished ${ctx.sessionsCompleted} sessions and ${ctx.mealDaysLogged} meal days. That's a useful weekly review base.`;
    }
    case 'workout': {
      if (ctx.status === 'completed') return ar ? `تم حفظ ${ctx.setCount} مجموعات. راجع ملخصك وخذ وقتك للتعافي.` : `${ctx.setCount} sets saved. Review your summary and give yourself time to recover.`;
      if (ctx.status === 'paused') return ar ? 'الجلسة متوقفة مؤقتًا. استأنف عندما تكون جاهزًا.' : 'Your workout is paused. Resume when you are ready.';
      if (ctx.setCount === 0) {
        return ar
          ? `${ctx.exerciseName}: ركّز على المسار الكامل والحركة النظيفة. اسألني «لماذا هذا التمرين؟» لو تبي.`
          : `${ctx.exerciseName}: focus on full range and clean motion. Ask me “Why this exercise?” if you want.`;
      }
      return ar
        ? 'مجموعة مسجّلة. خذ الراحة كاملة، ولا تسرّع الإيقاع على حساب الفورم.'
        : 'Set logged. Take the full rest — don’t rush pace at the cost of form.';
    }
  }
}
