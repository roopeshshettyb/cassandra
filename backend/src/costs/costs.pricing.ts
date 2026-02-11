export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AudioUsage {
  inputMs?: number;
  outputMs?: number;
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
    audioInputMs?: number;
    audioOutputMs?: number;
  };
}

export interface PricingConfig {
  currency: string;
  textInputPricePer1K: number;
  textOutputPricePer1K: number;
  voiceInputPricePerMinute: number;
  voiceOutputPricePerMinute: number;
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

export function calculateVoiceCost(options: {
  model?: string;
  provider?: string;
  usage: TokenUsage;
  audio?: AudioUsage;
  config: PricingConfig;
}): PricingResult {
  const { model, provider, usage, audio, config } = options;
  const tokensPrompt = usage.promptTokens ?? 0;
  const tokensCompletion = usage.completionTokens ?? 0;
  const tokensTotal = usage.totalTokens ?? tokensPrompt + tokensCompletion;

  const inputMs = audio?.inputMs ?? 0;
  const outputMs = audio?.outputMs ?? 0;
  const inputMinutes = inputMs / 60000;
  const outputMinutes = outputMs / 60000;

  const tokenComponent =
    (tokensPrompt / 1000) * config.textInputPricePer1K +
    (tokensCompletion / 1000) * config.textOutputPricePer1K;
  const audioComponent =
    inputMinutes * config.voiceInputPricePerMinute +
    outputMinutes * config.voiceOutputPricePerMinute;

  const amountNumber = tokenComponent + audioComponent;

  return {
    amount: toDecimalString(amountNumber),
    currency: config.currency,
    meta: {
      model,
      provider,
      pricingVersion: 'v1-voice',
      tokensPrompt,
      tokensCompletion,
      tokensTotal,
      audioInputMs: inputMs,
      audioOutputMs: outputMs,
    },
  };
}

