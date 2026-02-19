export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface PricingResult {
  amount: string;
  currency: string;
  meta: {
    model?: string;
    provider?: string;
    pricingVersion: string;
    tokensPrompt?: number;
    tokensCompletion?: number;
    tokensTotal?: number;
  };
}

export interface PricingConfig {
  currency: string;
  textInputPricePer1K: number;
  textOutputPricePer1K: number;
}

function toDecimalString(value: number): string {
  // Convert to string with sufficient precision, trimming trailing zeros.
  const raw = value.toFixed(12);
  return raw.replace(/\.?0+$/, '');
}

export function calculateTextCost(options: {
  model?: string;
  provider?: string;
  usage: TokenUsage;
  config: PricingConfig;
}): PricingResult {
  const { model, provider, usage, config } = options;
  const tokensPrompt = usage.promptTokens ?? 0;
  const tokensCompletion = usage.completionTokens ?? 0;
  const tokensTotal = usage.totalTokens ?? tokensPrompt + tokensCompletion;

  const inputCost = (tokensPrompt / 1000) * config.textInputPricePer1K;
  const outputCost = (tokensCompletion / 1000) * config.textOutputPricePer1K;
  const amountNumber = inputCost + outputCost;

  return {
    amount: toDecimalString(amountNumber),
    currency: config.currency,
    meta: {
      model,
      provider,
      pricingVersion: 'v1-text',
      tokensPrompt,
      tokensCompletion,
      tokensTotal,
    },
  };
}

