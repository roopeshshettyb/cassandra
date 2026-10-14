import { CostsService } from '../../../src/costs/costs.service';
import { CostType } from '../../../src/costs/costs.model';
import { mock, constants, admin, owner, staff } from '../helpers';

describe('CostsService', () => {
  let costs: any, hotelsService: any;
  let service: CostsService;
  const llm = constants.private.LLM;
  const ids = { bookingId: 1, hotelId: 2, accountId: 3, role: 'guest', chatId: 4, messageId: 5 };

  beforeEach(() => {
    costs = mock();
    hotelsService = mock({ findAllForAccount: jest.fn(async () => ({ data: [{ id: 2 }] })) });
    service = new CostsService(costs, constants, hotelsService);
  });

  it('prices a chat turn at the text model rates', async () => {
    await service.recordLlmCost({ type: CostType.LLM_CHAT, usage: { promptTokens: 1000, completionTokens: 1000 }, ...ids });
    const [row] = costs.create.mock.calls[0];
    expect(parseFloat(row.amount)).toBeCloseTo(llm.TEXT_INPUT_PRICE_PER_1K + llm.TEXT_OUTPUT_PRICE_PER_1K);
    expect(row).toMatchObject({ currency: llm.CURRENCY, ...ids, meta: expect.objectContaining({ model: llm.TEXT_MODEL, chatId: 4 }) });
  });

  it('prices a summary at the summary model rates', async () => {
    await service.recordLlmCost({ type: CostType.LLM_SUMMARY, usage: { promptTokens: 1000, completionTokens: 0 }, ...ids });
    expect(parseFloat(costs.create.mock.calls[0][0].amount)).toBeCloseTo(llm.SUMMARY_INPUT_PRICE_PER_1K);
  });

  it('prices audio tokens at the realtime rates', async () => {
    await service.recordLlmCost({ type: CostType.LLM_VOICE, usage: { promptTokens: 0, completionTokens: 0, audioPromptTokens: 1000, audioCompletionTokens: 1000 }, ...ids });
    const amount = parseFloat(costs.create.mock.calls[0][0].amount);
    expect(amount).toBeCloseTo(llm.REALTIME_PRICING.AUDIO_INPUT_PRICE_PER_1K + llm.REALTIME_PRICING.AUDIO_OUTPUT_PRICE_PER_1K);
  });

  it('prices a voice-agent session by the minute', async () => {
    await service.recordVoiceSessionDurationCost({ durationMs: 120_000, ...ids });
    const [row] = costs.create.mock.calls[0];
    expect(parseFloat(row.amount)).toBeCloseTo(2 * llm.DEEPGRAM_VOICE_AGENT.PRICE_PER_MINUTE);
    expect(row).toMatchObject({ type: CostType.LLM_VOICE, messageId: null });
  });

  it('never fails the caller when saving a cost fails', async () => {
    costs.create.mockRejectedValue(new Error('db down'));
    await expect(service.recordCost({ type: CostType.LLM_VOICE, amount: '1', currency: 'usd' })).resolves.toBeUndefined();
  });

  it('aggregates costs per booking for an admin', async () => {
    costs.findAll.mockResolvedValue([
      { id: 1, bookingId: 9, amount: '1.5', currency: 'usd', type: 'a', booking: { guest: { name: 'G', email: 'g@x' } } },
      { id: 2, bookingId: 9, amount: '2', currency: 'usd', type: 'b', booking: { guest: { name: 'G', email: 'g@x' } } },
      { id: 3, bookingId: null, amount: '1', currency: 'usd', type: 'c' },
    ]);
    const res = await service.aggregateCosts(admin());
    expect(costs.findAll.mock.calls[0][0].where).toEqual({});
    expect(res.data).toEqual([
      expect.objectContaining({ id: 'booking-9', totalCost: 3.5, guestName: 'G', breakdown: expect.arrayContaining([expect.objectContaining({ id: 1 })]) }),
      expect.objectContaining({ id: 'other', totalCost: 1, guestName: 'Unknown' }),
    ]);
  });

  it('narrows an owner to their hotels', async () => {
    costs.findAll.mockResolvedValue([]);
    await service.aggregateCosts(owner());
    expect(costs.findAll.mock.calls[0][0].where.hotelId).toBeDefined();
  });

  // Known problem (test/README.md): staff get every hotel's costs. Drop `.failing` once fixed.
  it.failing('narrows staff to their hotels', async () => {
    costs.findAll.mockResolvedValue([]);
    await service.aggregateCosts(staff());
    expect(costs.findAll.mock.calls[0][0].where.hotelId).toBeDefined();
  });

  it('gives an owner without hotels nothing', async () => {
    hotelsService.findAllForAccount.mockResolvedValue({ data: [] });
    await expect(service.aggregateCosts(owner())).resolves.toMatchObject({ data: [] });
    expect(costs.findAll).not.toHaveBeenCalled();
  });
});
