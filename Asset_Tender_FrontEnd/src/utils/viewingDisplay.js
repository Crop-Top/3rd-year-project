/**
 * Formats a date/time for viewing display (en-ZA).
 * @param {string|Date|null|undefined} value
 * @returns {string|null}
 */
export function formatViewingDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Builds the prominent viewing sentence shown on cards and details.
 * Example: "Viewing will commence on 15 Sep 2026, 10:00 at North Campus Stores"
 * Appends " until …" when an end time is set.
 *
 * @param {{ viewingDate?: string|Date|null, viewingEndTime?: string|Date|null, viewingLocation?: string|null }} tender
 * @returns {string|null}
 */
export function formatViewingSentence(tender) {
  if (!tender) return null;
  const when = formatViewingDateTime(tender.viewingDate);
  const where = (tender.viewingLocation || "").trim();
  if (!when || !where) return null;

  const end = formatViewingDateTime(tender.viewingEndTime);
  let sentence = `Viewing will commence on ${when} at ${where}`;
  if (end) {
    sentence += ` until ${end}`;
  }
  return sentence;
}
