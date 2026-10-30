import { ConstantsService } from '../src/common/constants/constants.service';
import { ReservationVoiceGateway } from '../src/reservation/reservation-voice.gateway';

const config: any = { get: (_key: string, fallback?: unknown) => fallback };
const unused: any = null;
const gateway: any = new ReservationVoiceGateway(unused, unused, new ConstantsService(config), unused, unused, unused, unused);

describe('looksFinished', () => {
  it.each([
    ['a plain yes', 'Yes, that is right.', true],
    ['a finished sentence', 'From the 5th to the 7th of November.', true],
    ['a full phone number', 'nine eight two one four three six five seven zero', true],
    ['half a number in words', 'My number is nine eight two one', false],
    ['half a number with double', 'nine double eight two', false],
    ['half a number in Kannada numerals', 'ನನ್ನ ನಂಬರ್ ೯೮೨೧', false],
    ['a dangling word', 'Two adults and', false],
    ['a name being spelled', 'It is D E', false],
  ])('%s', (_name, heard, finished) => {
    expect(gateway.looksFinished(heard)).toBe(finished);
  });
});
