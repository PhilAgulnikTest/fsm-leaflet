/* AI re-write + fact-check pipeline.
 *
 * Two passes, both Anthropic API calls:
 *
 *   1. GENERATE — given the current section text, the LA's source URL/text, and
 *      the template's facts_json, ask the model to produce a parent-friendly
 *      rewrite. Tone: plain English, reading age ~9, length cap per section.
 *
 *   2. VERIFY — second cheaper call cross-checks the generated copy against
 *      facts_json. Returns either { ok: true } or { contradictions: [...] }
 *      where each contradiction names the phrase, the fact it appears to
 *      contradict, and a short rationale.
 *
 * Both calls use Claude Sonnet (4.6 default; flippable via env). The verify
 * pass adds ~30% to per-rewrite token spend — worth it for the warning UI.
 *
 * Translation mode runs the same pipeline: generate the translation, then
 * verify that dates / numbers / named facts carry through unchanged. */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

const MODEL = process.env.AI_REWRITE_MODEL ?? 'claude-sonnet-4-6';
const MAX_TOKENS_GENERATE = 1000;
const MAX_TOKENS_VERIFY = 600;

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }
  if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

export type GenerateInput = {
  mode: 'rewrite' | 'translate';
  sectionKey: string;
  currentText: string;
  sourceText: string;
  facts: Record<string, unknown>;
  targetLanguage?: string;
};

export type GenerateResult = {
  output: string;
  promptUsed: string;
  inputTokens?: number;
  outputTokens?: number;
};

export type Contradiction = {
  contradicted_phrase: string;
  fact_key: string;
  rationale: string;
};

export type VerifyResult = {
  warnings: Contradiction[];
  inputTokens?: number;
  outputTokens?: number;
};

// --- Prompt construction --------------------------------------------------

const STYLE_GUIDE = `Style:
- Parent-friendly, plain English, reading age ~9
- Avoid jargon and acronyms (no "FSM", "UC" without expansion)
- Short sentences, active voice
- Keep dates, numbers and named eligibility rules exactly as they appear in FACTS
- Length: roughly the same as the current section, ±30%`;

function buildRewritePrompt(input: GenerateInput): string {
  return `You are rewriting one section of a printed leaflet that helps families learn about free school meals.

CURRENT SECTION (${input.sectionKey}):
"""
${input.currentText}
"""

SOURCE MATERIAL (provided by the local authority):
"""
${input.sourceText.slice(0, 8000)}
"""

FACTS (the leaflet's pinned eligibility rules — these MUST be preserved exactly):
\`\`\`json
${JSON.stringify(input.facts, null, 2)}
\`\`\`

${STYLE_GUIDE}

Output ONLY the rewritten section text. No preamble, no explanation, no quotes around it. Use simple HTML if helpful: <strong> for emphasis, <p> for paragraphs. No <h1>/<h2>.`;
}

function buildTranslatePrompt(input: GenerateInput): string {
  return `Translate the following leaflet section into ${input.targetLanguage}.

SECTION (${input.sectionKey}):
"""
${input.currentText}
"""

CRITICAL FACTS — must carry through unchanged (dates, named eligibility rules, numbers):
\`\`\`json
${JSON.stringify(input.facts, null, 2)}
\`\`\`

Output ONLY the translated text. Preserve any HTML tags exactly. Maintain the original tone (parent-friendly, plain language). No preamble.`;
}

function buildVerifyPrompt(generated: string, facts: Record<string, unknown>, mode: 'rewrite' | 'translate'): string {
  const noun = mode === 'translate' ? 'translation' : 'rewrite';
  return `You are a fact-checker for a free school meals leaflet ${noun}.

GENERATED ${noun.toUpperCase()}:
"""
${generated}
"""

FACTS (ground truth — the canonical eligibility rules for this leaflet):
\`\`\`json
${JSON.stringify(facts, null, 2)}
\`\`\`

Find every place the ${noun} appears to contradict, change, or omit a critical detail from FACTS.
Critical = dates, deadlines, named eligibility criteria, application routes, claim windows, auto-enrolment status.

Output VALID JSON ONLY. Schema:
{
  "contradictions": [
    {
      "contradicted_phrase": "<the exact phrase in the ${noun} that conflicts>",
      "fact_key": "<the FACTS key that's contradicted>",
      "rationale": "<one-sentence explanation>"
    }
  ]
}

If there are no contradictions, output: {"contradictions": []}`;
}

// --- API calls ------------------------------------------------------------

export async function generate(input: GenerateInput): Promise<GenerateResult> {
  const prompt = input.mode === 'translate' ? buildTranslatePrompt(input) : buildRewritePrompt(input);
  const msg = await anthropic().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS_GENERATE,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
  return {
    output: text,
    promptUsed: prompt,
    inputTokens: msg.usage?.input_tokens,
    outputTokens: msg.usage?.output_tokens,
  };
}

export async function verify(
  generated: string,
  facts: Record<string, unknown>,
  mode: 'rewrite' | 'translate'
): Promise<VerifyResult> {
  const prompt = buildVerifyPrompt(generated, facts, mode);
  const msg = await anthropic().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS_VERIFY,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = msg.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  // Model sometimes wraps JSON in ```json fences. Strip if present.
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let parsed: { contradictions?: Contradiction[] };
  try {
    parsed = JSON.parse(stripped) as { contradictions?: Contradiction[] };
  } catch {
    // Defensive fallback: if the model returned malformed JSON, surface a
    // single soft warning rather than failing the whole flow.
    return {
      warnings: [
        {
          contradicted_phrase: '(verify step did not return parsable JSON)',
          fact_key: '(unknown)',
          rationale: `Verify model output was not parsable: ${stripped.slice(0, 200)}`,
        },
      ],
      inputTokens: msg.usage?.input_tokens,
      outputTokens: msg.usage?.output_tokens,
    };
  }

  return {
    warnings: Array.isArray(parsed.contradictions) ? parsed.contradictions : [],
    inputTokens: msg.usage?.input_tokens,
    outputTokens: msg.usage?.output_tokens,
  };
}
