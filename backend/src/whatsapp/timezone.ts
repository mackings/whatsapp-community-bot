interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** Wall-clock date/time parts for `date` as observed in `timeZone`. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24, // midnight can format as "24"
    minute: Number(parts.minute),
  };
}

/** UTC epoch ms for the given wall-clock date/time as observed in `timeZone`. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): number {
  const targetWallUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = targetWallUtc;

  // Two passes converge even across a DST boundary; most zones need only one.
  for (let i = 0; i < 2; i++) {
    const parts = getZonedParts(new Date(guess), timeZone);
    const guessedWallUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
    guess += targetWallUtc - guessedWallUtc;
  }

  return guess;
}

export function startOfDayUtc(year: number, month: number, day: number, timeZone: string): number {
  return zonedTimeToUtc(year, month, day, 0, 0, timeZone);
}
