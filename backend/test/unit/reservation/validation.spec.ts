import { ConstantsService } from '../../../src/common/constants/constants.service';
import { bookingProblems, inScriptOf } from '../../../src/langgraph/reservation.tools';

const config: any = { get: (_key: string, fallback?: unknown) => fallback };
const limits = new ConstantsService(config).private.RESERVATION;
const today = '2026-10-23';
const good = { checkInDate: '2026-11-05', checkOutDate: '2026-11-07', partySize: 2, guestPhone: '9821436570', guestEmail: 'dev@gmail.com' };

describe('bookingProblems', () => {
  it('accepts a sound booking, and today as check-in', () => {
    expect(bookingProblems(good, today, limits)).toEqual([]);
    expect(bookingProblems({ ...good, checkInDate: today, checkOutDate: '2026-10-24' }, today, limits)).toEqual([]);
  });

  it('refuses the past dates QA booked in chat 1442', () => {
    expect(bookingProblems({ ...good, checkInDate: '2026-10-10', checkOutDate: '2026-10-12' }, today, limits)).toEqual(['checkInDate']);
  });

  it('refuses a check-out that is not after check-in', () => {
    expect(bookingProblems({ ...good, checkOutDate: '2026-11-05' }, today, limits)).toEqual(['checkOutDate']);
  });

  it('refuses zero or too many guests', () => {
    expect(bookingProblems({ partySize: 0 }, today, limits)).toEqual(['partySize']);
    expect(bookingProblems({ partySize: 21 }, today, limits)).toEqual(['partySize']);
  });

  it('refuses the five-digit phone from chat 1442, accepts a country code', () => {
    expect(bookingProblems({ guestPhone: '98765' }, today, limits)).toEqual(['guestPhone']);
    expect(bookingProblems({ guestPhone: '+91 98214 36570' }, today, limits)).toEqual([]);
  });

  it('refuses an email that cannot work', () => {
    expect(bookingProblems({ guestEmail: 'dev at gmail' }, today, limits)).toEqual(['guestEmail']);
    expect(bookingProblems({ guestEmail: 'dev@gmail' }, today, limits)).toEqual(['guestEmail']);
  });

  it('judges only the fields present', () => {
    expect(bookingProblems({ guestName: 'ಕಿರಣ್ ಟೆಸ್ಟ್' }, today, limits)).toEqual([]);
  });

  it('tells the caller the limits it applies', () => {
    expect(limits.BOOKING_PROBLEMS.partySize).toBe('the number of guests must be from 1 to 20');
    expect(limits.BOOKING_PROBLEMS.guestPhone).toBe('a phone number has 10 digits, or more with a country code');
  });
});

describe('inScriptOf', () => {
  it('moves Telugu letters the model slipped into a Kannada name back into Kannada', () => {
    expect(inScriptOf('ಕಿರಣ್ ಟెస్ట్', 'ನನ್ನ ಹೆಸರು ಕಿರಣ್ ಟೆಸ್ಟ್')).toBe('ಕಿರಣ್ ಟೆಸ್ಟ್');
  });

  it('leaves a name alone when it is already in the caller’s script, or the caller wrote no Indian script', () => {
    expect(inScriptOf('ಸುರೇಶ್ ಪರೀಕ್ಷೆ', 'ನನ್ನ ಹೆಸರು ಸುರೇಶ್ ಪರೀಕ್ಷೆ')).toBe('ಸುರೇಶ್ ಪರೀಕ್ಷೆ');
    expect(inScriptOf('Dev', 'My name is Dev, D E V')).toBe('Dev');
    expect(inScriptOf('राहुल टेस्ट', 'राहुल टेस्ट')).toBe('राहुल टेस्ट');
  });
});
