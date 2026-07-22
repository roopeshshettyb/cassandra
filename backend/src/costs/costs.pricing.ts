export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  // Realtime-only modality breakdown (from OpenAI Realtime's response.usage). When
  // present, promptTokens/completionTokens hold the TEXT portion and these hold the
  // rest — audio and cached tokens bill at different rates than plain text.
  audioPromptTokens?: number;
  audioCompletionTokens?: number;
  cachedTextPromptTokens?: number;
  cachedAudioPromptTokens?: number;
  // Set when usage came from an estimate (e.g. word-count fallback) rather than the
  // provider's reported token counts, so estimated and real costs stay distinguishable.
  estimated?: boolean;
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
    audioTokensPrompt?: number;
    audioTokensCompletion?: number;
    cachedTokensPrompt?: number;
    estimated?: boolean;
    durationMs?: number;
  };
}

export interface PricingConfig {
  currency: string;
  textInputPricePer1K: number;
  textOutputPricePer1K: number;
}

export interface RealtimePricingConfig {
  currency: string;
  textInputPricePer1K: number;
  textOutputPricePer1K: number;
  audioInputPricePer1K: number;
  audioOutputPricePer1K: number;
  cachedInputPricePer1K: number;
}

export interface DurationPricingConfig {
  currency: string;
  pricePerMinute: number;
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

// Prices an OpenAI Realtime voice turn. Text and audio tokens bill at different
// rates; cached tokens (either modality — OpenAI prices cached text and cached
// audio identically) bill at the cached rate instead of their normal rate, so
// they're subtracted out of the non-cached totals before pricing those.
export function calculateRealtimeVoiceCost(options: { model?: string; provider?: string; usage: TokenUsage; config: RealtimePricingConfig }): PricingResult {
  const { model, provider, usage, config } = options;
  const textPrompt = usage.promptTokens ?? 0;
  const textCompletion = usage.completionTokens ?? 0;
  const audioPrompt = usage.audioPromptTokens ?? 0;
  const audioCompletion = usage.audioCompletionTokens ?? 0;
  const cachedTextPrompt = usage.cachedTextPromptTokens ?? 0;
  const cachedAudioPrompt = usage.cachedAudioPromptTokens ?? 0;
  const cachedTotal = cachedTextPrompt + cachedAudioPrompt;

  const nonCachedTextPrompt = Math.max(0, textPrompt - cachedTextPrompt);
  const nonCachedAudioPrompt = Math.max(0, audioPrompt - cachedAudioPrompt);

  const inputCost =
    (nonCachedTextPrompt / 1000) * config.textInputPricePer1K +
    (nonCachedAudioPrompt / 1000) * config.audioInputPricePer1K +
    (cachedTotal / 1000) * config.cachedInputPricePer1K;
  const outputCost = (textCompletion / 1000) * config.textOutputPricePer1K + (audioCompletion / 1000) * config.audioOutputPricePer1K;
  const amountNumber = inputCost + outputCost;

  return {
    amount: toDecimalString(amountNumber),
    currency: config.currency,
    meta: {
      model,
      provider,
      pricingVersion: 'v1-realtime',
      tokensPrompt: textPrompt,
      tokensCompletion: textCompletion,
      tokensTotal: textPrompt + textCompletion + audioPrompt + audioCompletion,
      audioTokensPrompt: audioPrompt,
      audioTokensCompletion: audioCompletion,
      cachedTokensPrompt: cachedTotal,
      estimated: usage.estimated,
    },
  };
}

// Deepgram Voice Agent bills by websocket connection time, not tokens — one cost
// row per call, recorded at session close.
export function calculateDurationCost(options: { model?: string; provider?: string; durationMs: number; config: DurationPricingConfig }): PricingResult {
  const { model, provider, durationMs, config } = options;
  const amountNumber = (durationMs / 60000) * config.pricePerMinute;

  return {
    amount: toDecimalString(amountNumber),
    currency: config.currency,
    meta: {
      model,
      provider,
      pricingVersion: 'v1-duration',
      durationMs,
    },
  };
}

