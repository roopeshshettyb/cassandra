import { ConstantsService } from '../../../src/common/constants/constants.service';
import { spokenDigits } from '../../../src/langgraph/reservation.tools';

const config: any = { get: (_key: string, fallback?: unknown) => fallback };
const words = new ConstantsService(config).private.RESERVATION.SPOKEN_DIGITS;

describe('spokenDigits', () => {
  it.each([
    ['English words', 'nine eight two one four three six five seven zero', '9821436570'],
    ['English digits', 'My number is 98214 36570', '9821436570'],
    ['English double and triple', 'nine double zero triple four', '900444'],
    ['Kannada words (chat 1330)', 'ಹೌದು. ನನ್ನ ನಂಬರ್ ಒಂಬತ್ತು ಸೊನ್ನೆ ಸೊನ್ನೆ ಸೊನ್ನೆ ಸೊನ್ನೆ ಸೊನ್ನೆ ಸೊನ್ನೆ ಸೊನ್ನೆ ಸೊನ್ನೆ ಎರಡು', '9000000002'],
    ['Kannada numerals (chat 1264)', 'ನನ್ನ ಫೋನ್ ೯೦೦೦೦೦೦೦೦೩', '9000000003'],
    ['Hindi words', 'मेरा नंबर नौ आठ डबल दो एक चार तीन छह पांच है', '982214365'],
    ['Hindi numerals', 'नंबर ९८२१४३६५७० है', '9821436570'],
    ['Tamil words', 'என் நம்பர் ஒன்பது எட்டு ரெண்டு ஒண்ணு நாலு மூணு ஆறு அஞ்சு ஏழு பூஜ்ஜியம்', '9821436570'],
    ['Telugu words', 'నా నంబర్ తొమ్మిది ఎనిమిది రెండు ఒకటి నాలుగు మూడు ఆరు ఐదు ఏడు సున్నా', '9821436570'],
  ])('%s', (_name, said, digits) => {
    expect(spokenDigits(said, words)).toBe(digits);
  });
});
