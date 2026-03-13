/**
 * Formats a date string into a smart, human-readable label.
 * Examples:
 *  - Today's date → "Hoje • 08:00"
 *  - Tomorrow → "Amanhã • 14:30"
 *  - This week → "Terça-feira • 10:00"
 *  - Further → "12 de Mar • 09:00"
 */

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export function formatSmartDate(isoDateStr: string, time?: string): { label: string; sublabel: string } {
  try {
    const apptDate = new Date(isoDateStr);
    const now = new Date();

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const dayAfterTomorrow = new Date(todayStart);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const nextWeek = new Date(todayStart);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const apptDay = new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate());
    const dayDiff = Math.round((apptDay.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

    let label: string;
    if (dayDiff === 0) {
      label = 'Hoje';
    } else if (dayDiff === 1) {
      label = 'Amanhã';
    } else if (dayDiff === -1) {
      label = 'Ontem';
    } else if (dayDiff > 1 && dayDiff < 7) {
      label = WEEKDAYS[apptDate.getDay()];
    } else if (dayDiff < 0) {
      // Past dates - show day name + date
      label = apptDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    } else {
      // More than a week away
      label = apptDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    }

    // Full readable sublabel, e.g., "Quinta-feira, 12 de março"
    let sublabel = apptDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    sublabel = sublabel.charAt(0).toUpperCase() + sublabel.slice(1);

    return { label: time ? `${label} • ${time}` : label, sublabel };
  } catch {
    return { label: isoDateStr, sublabel: '' };
  }
}
