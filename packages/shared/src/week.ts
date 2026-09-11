export type Week = { from: Date; to: Date; key: string };

/** Monday to Monday. The key is ISO year-week, which is also the dedup key. */
export function weekOf(now: Date, offsetWeeks = 0): Week {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const isoDay = (from.getUTCDay() + 6) % 7;
  from.setUTCDate(from.getUTCDate() - isoDay + offsetWeeks * 7);

  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 7);

  // ISO week number: the Thursday in the week decides which year the week
  // belongs to, which is why a week can be numbered into the next year.
  const thursday = new Date(from);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart) / 86_400_000 + 1) / 7);

  return { from, to, key: `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}` };
}
