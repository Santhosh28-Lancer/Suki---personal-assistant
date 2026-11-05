export type ParsedExpense = { amount: number; category: string };

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

const WORD_NUMBER_PATTERN = String.raw`(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakh)(?:[\s-]+(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakh))*`;

function wordsToNumber(value: string): number | null {
  const tokens = value.toLowerCase().replace(/-/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  let total = 0;
  let current = 0;
  for (const token of tokens) {
    if (token === 'and') continue;
    if (token === 'hundred') {
      current = Math.max(1, current) * 100;
    } else if (token === 'thousand') {
      total += Math.max(1, current) * 1000;
      current = 0;
    } else if (token === 'lakh') {
      total += Math.max(1, current) * 100000;
      current = 0;
    } else if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, token)) {
      current += NUMBER_WORDS[token];
    } else {
      return null;
    }
  }
  const result = total + current;
  return Number.isFinite(result) && result > 0 ? result : null;
}

function parseAmount(value: string): number | null {
  const numeric = Number(value.replace(/[₹,\s]/g, '').replace(/(?:rupees?|rs\.?|inr)$/i, ''));
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  return wordsToNumber(value.replace(/\s*(?:rupees?|rs\.?)\s*$/i, '').trim());
}

function cleanCategory(value: string): string {
  return value
    .replace(/\b(?:please|save|record|add|log|this|the|an?|amount|expense|spend|spent|paid|i|we|on|at|for|rupees?|rs\.?|inr)\b/gi, ' ')
    .replace(/[₹,:;.!?]+/g, ' ')
    .replace(/^[\s:–—-]+|[\s:–—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Offline parser. Supports amount-first, category-first, command phrasing,
 * and common English number words (e.g. "save hundred rupees cafe").
 */
export function parseExpenseCommand(input: string): ParsedExpense | null {
  const text = input.trim().replace(/\s+/g, ' ');
  if (!text) return null;

  const amountToken = String.raw`(?:₹\s*|\b(?:rs\.?|inr)\s*)?(?:[\d][\d,]*(?:\.\d{1,2})?|\b${WORD_NUMBER_PATTERN}\b)(?:\s*(?:rupees?|rs\.?))?`;
  const matches = [...text.matchAll(new RegExp(amountToken, 'gi'))];
  if (matches.length !== 1) return null;

  const match = matches[0];
  const rawAmount = match[0].trim();
  const amount = parseAmount(rawAmount);
  if (amount === null) return null;

  const before = text.slice(0, match.index ?? 0);
  const after = text.slice((match.index ?? 0) + match[0].length);
  const category = cleanCategory(`${before} ${after}`);
  if (!category || /^\d+(?:\.\d+)?$/.test(category)) return null;

  // Reject number words accidentally found inside ordinary prose.
  const hasExpenseContext = /\b(?:save|record|add|log|expense|spent|paid|cost|rupees?|rs\.?|inr)\b/i.test(text);
  const looksLikeCategoryAmount = /^[\p{L}\p{M}\s&.'()/-]+$/u.test(before.trim()) && before.trim().length > 0;
  const hasAmountFirstShape = !before.trim() || /^(?:(?:please\s+)?(?:save|record|add|log)\s*)$/i.test(before.trim());
  if (!hasExpenseContext && !looksLikeCategoryAmount && !hasAmountFirstShape) return null;

  return { amount, category };
}

export function parseNoteCommand(input: string): string | null {
  const match = /^(?:note|memo|remember|save\s+(?:a\s+)?note|save\s+this\s+note)\s*[:,-]?\s*(.+)$/i.exec(input.trim());
  const value = match?.[1]?.trim();
  return value || null;
}
