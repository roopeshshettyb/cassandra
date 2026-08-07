import { calculateTextCost, PricingConfig } from '../../src/costs/costs.pricing';

const config: PricingConfig = {
  currency: 'USD',
  textInputPricePer1K: 0.5,
  textOutputPricePer1K: 1.5,
};

describe('calculateTextCost', () => {
  it('prices prompt and completion tokens at their respective rates', () => {
    const result = calculateTextCost({
      model: 'gpt-x',
      provider: 'openai',
      usage: { promptTokens: 1000, completionTokens: 2000, totalTokens: 3000 },
      config,
    });

    // 1000/1000 * 0.5 + 2000/1000 * 1.5 = 3.5
    expect(result.amount).toBe('3.5');
    expect(result.currency).toBe('USD');
    expect(result.meta).toEqual({
      model: 'gpt-x',
      provider: 'openai',
      pricingVersion: 'v1-text',
      tokensPrompt: 1000,
      tokensCompletion: 2000,
      tokensTotal: 3000,
    });
  });

  it('treats missing token counts as zero', () => {
    const result = calculateTextCost({ usage: {}, config });

    expect(result.amount).toBe('0');
    expect(result.meta.tokensPrompt).toBe(0);
    expect(result.meta.tokensCompletion).toBe(0);
    expect(result.meta.tokensTotal).toBe(0);
    expect(result.meta.model).toBeUndefined();
    expect(result.meta.provider).toBeUndefined();
  });

  it('derives totalTokens from prompt + completion when not supplied', () => {
    const result = calculateTextCost({ usage: { promptTokens: 120, completionTokens: 30 }, config });
    expect(result.meta.tokensTotal).toBe(150);
  });

  it('trusts an explicitly supplied totalTokens over the sum', () => {
    const result = calculateTextCost({
      usage: { promptTokens: 100, completionTokens: 100, totalTokens: 999 },
      config,
    });
    expect(result.meta.tokensTotal).toBe(999);
  });

  it('renders sub-cent amounts without exponent notation and without trailing zeros', () => {
    const result = calculateTextCost({
      usage: { promptTokens: 1, completionTokens: 0 },
      config, // 1/1000 * 0.5 = 0.0005
    });
    expect(result.amount).toBe('0.0005');
  });

  it('keeps whole-number amounts free of a trailing decimal point', () => {
    const result = calculateTextCost({
      usage: { promptTokens: 2000, completionTokens: 0 },
      config, // 2000/1000 * 0.5 = 1
    });
    expect(result.amount).toBe('1');
  });

  it('rounds amounts below 1e-12 down to zero', () => {
    const result = calculateTextCost({
      usage: { promptTokens: 1, completionTokens: 0 },
      config: { ...config, textInputPricePer1K: 1e-12 },
    });
    expect(result.amount).toBe('0');
  });

  it('carries the configured currency through', () => {
    const result = calculateTextCost({ usage: { promptTokens: 10 }, config: { ...config, currency: 'INR' } });
    expect(result.currency).toBe('INR');
  });

  it('always reports the v1-text pricing version', () => {
    expect(calculateTextCost({ usage: {}, config }).meta.pricingVersion).toBe('v1-text');
  });
});
