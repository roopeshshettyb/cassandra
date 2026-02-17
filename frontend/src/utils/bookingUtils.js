export const findMostRelevantBooking = (bookings) => {
  if (!bookings || bookings.length === 0) return null;

  const now = new Date();

  // 1. Check for active stay (now is between start and end)
  const active = bookings.find((b) => {
    const start = new Date(b.startTime);
    const end = new Date(b.endTime);
    return now >= start && now <= end;
  });

  if (active) {
    return { ...active, isWithinStay: true };
  }

  // 2. Find next upcoming
  // Data is sorted by startTime DESC from backend, so we need to filter for future and sorting ASC will give closest.
  const upcoming = bookings.filter((b) => new Date(b.startTime) > now).sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0];

  if (upcoming) {
    return { ...upcoming, isWithinStay: false };
  }

  // 3. Fallback: most recent past one (data[0] is most recent by DESC sort)
  return { ...bookings[0], isWithinStay: false };
};
