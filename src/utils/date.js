function normalizeDate(dateString) {
  if (!dateString) {
    return null;
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

export function getRemainingDays(dateString) {
  const targetDate = normalizeDate(dateString);

  if (!targetDate) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = targetDate.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getExpiryLabel(remainingDays) {
  if (remainingDays === null) {
    return '\uC720\uD1B5\uAE30\uD55C \uC5C6\uC74C';
  }

  if (remainingDays < 0) {
    return `${Math.abs(remainingDays)}\uC77C \uC9C0\uB0A8`;
  }

  if (remainingDays === 0) {
    return 'D-Day';
  }

  return `D-${remainingDays}`;
}

export function getStatusTone(remainingDays, consumed = false) {
  if (consumed) {
    return 'bg-slate-200 text-slate-700';
  }

  if (remainingDays === null || remainingDays > 3) {
    return 'bg-brand-50 text-brand-700';
  }

  if (remainingDays >= 0) {
    return 'bg-amber-100 text-amber-800';
  }

  return 'bg-rose-100 text-rose-700';
}

export function getDashboardSummary(ingredients) {
  return ingredients.reduce(
    (summary, ingredient) => {
      const remainingDays = getRemainingDays(ingredient.expiryDate);

      summary.total += 1;

      if (remainingDays !== null && remainingDays < 0 && !ingredient.consumed) {
        summary.expired += 1;
      }

      if (remainingDays !== null && remainingDays >= 0 && remainingDays <= 3 && !ingredient.consumed) {
        summary.expiringSoon += 1;
      }

      return summary;
    },
    { total: 0, expiringSoon: 0, expired: 0 }
  );
}
