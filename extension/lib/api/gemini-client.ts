import type { CapturedAction } from '@/lib/types';
import type { EnrichedAction } from './backend-client';
import type { EnrichmentCapabilities, EnrichmentProvider } from './enrichment-provider';
import { geminiRateLimiter } from './rate-limiter';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const ENRICHMENT_TIMEOUT_MS = 15_000;
const CONNECTION_TEST_TIMEOUT_MS = 5_000;

// ─── Prompt ─────────────────────────────────────────────────────────────────

function buildPrompt(action: CapturedAction, hasPrevScreenshot: boolean): string {
  const metadata = {
    actionType: action.actionType,
    url: action.url,
    pageTitle: action.pageTitle,
    element: {
      tag: action.element.tag,
      text: action.element.text,
      role: action.element.role,
    },
    inputValue: action.inputValue,
  };

  const screenshotContext = hasPrevScreenshot
    ? `Two screenshots are provided. Image 1 is the page state AFTER the user action. Image 2 is the page state BEFORE the action. Note any visual changes between them and whether the action appears to have succeeded.`
    : `One screenshot is provided showing the page state AFTER the user action.`;

  return `You are analyzing a recorded user action on a web page. ${screenshotContext}

Action metadata:
${JSON.stringify(metadata, null, 2)}

Analyze the screenshot(s) and action metadata, then provide a JSON response with exactly 3 sections:

## 1. description
Generate a clear, non-technical, present-tense description of the user action.
Rules:
- Be specific about WHAT was clicked/typed and WHERE on the page
- Use present tense ("Clicks" not "Clicked")
- Include the purpose when obvious (e.g., "to submit the form")
- Reference visual context (e.g., "in the navigation bar", "in the search results")
- Use business language, not technical jargon
Examples:
- "Clicks the 'Add to Cart' button on the product page"
- "Types the email address in the login form"
- "Scrolls down to view the pricing section"

## 2. visualAnalysis
Analyze the screenshot to extract:
- All visible UI elements (buttons, inputs, links, text fields)
- The element that was interacted with — identify it precisely
- Page context (what section, what application, what workflow)
- Any visible error messages or status indicators
- Visual hierarchy and layout information
- Bounding box of the interacted element (normalized 0-1000 coordinates)

## 3. decisionAnalysis
Determine if this step represents a decision point. Look for:
- Conditional branches (if X then Y)
- User choices between multiple options
- Data-dependent routing (different paths based on input values)
- Business rules being applied
- Error handling branches (success vs failure paths)
- Approval/rejection workflows
If not a decision point, set isDecisionPoint to false with reason "Linear step with no branching".

Respond with ONLY valid JSON in this exact structure:
{
  "description": "Clear, non-technical, present-tense description of the action",
  "visualAnalysis": {
    "interactedElement": { "type": "string", "text": "string", "description": "string" },
    "pageContext": { "app": "string", "section": "string", "workflow": "string" },
    "statusIndicators": ["string"],
    "layout": "form|list|dashboard|detail|modal|navigation|settings|other",
    "confidence": 0.95,
    "boundingBox": { "y0": 0, "x0": 0, "y1": 0, "x1": 0 }
  },
  "decisionAnalysis": {
    "isDecisionPoint": false,
    "reason": "Why this is or isn't a decision point",
    "branches": [
      { "condition": "If condition A", "description": "What happens" }
    ]
  }
}`;
}

// ─── JSON Schema for structured output ──────────────────────────────────────

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    visualAnalysis: {
      type: 'object',
      properties: {
        interactedElement: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            text: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['type', 'text', 'description'],
        },
        pageContext: {
          type: 'object',
          properties: {
            app: { type: 'string' },
            section: { type: 'string' },
            workflow: { type: 'string' },
          },
          required: ['app', 'section', 'workflow'],
        },
        statusIndicators: {
          type: 'array',
          items: { type: 'string' },
        },
        layout: { type: 'string' },
        confidence: { type: 'number' },
        boundingBox: {
          type: 'object',
          properties: {
            y0: { type: 'number' },
            x0: { type: 'number' },
            y1: { type: 'number' },
            x1: { type: 'number' },
          },
          required: ['y0', 'x0', 'y1', 'x1'],
        },
      },
      required: [
        'interactedElement',
        'pageContext',
        'statusIndicators',
        'layout',
        'confidence',
        'boundingBox',
      ],
    },
    decisionAnalysis: {
      type: 'object',
      properties: {
        isDecisionPoint: { type: 'boolean' },
        reason: { type: 'string' },
        branches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              condition: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['condition', 'description'],
          },
        },
      },
      required: ['isDecisionPoint', 'reason', 'branches'],
    },
  },
  required: ['description', 'visualAnalysis', 'decisionAnalysis'],
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripDataUrlPrefix(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function extractJsonFromResponse(text: string): string {
  // Try raw text first (structured output should be clean JSON)
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;

  // Fall back: extract from markdown code fence
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) return fenceMatch[1].trim();

  return trimmed;
}

interface GeminiApiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
  error?: { message?: string; code?: number };
}

// ─── GeminiDirectProvider ───────────────────────────────────────────────────

export class GeminiDirectProvider implements EnrichmentProvider {
  readonly name = 'gemini-direct';
  readonly capabilities: EnrichmentCapabilities = {
    visualGrounding: false,
    docValidation: false,
    complexAnalysis: false,
  };

  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || DEFAULT_MODEL;
  }

  async enrichAction(
    action: CapturedAction,
    screenshotDataUrl: string,
    prevScreenshotDataUrl?: string,
  ): Promise<EnrichedAction | null> {
    await geminiRateLimiter.acquire();

    const currentImage = stripDataUrlPrefix(screenshotDataUrl);
    if (!currentImage) {
      console.warn('GeminiDirectProvider: invalid screenshot data URL');
      return null;
    }

    const hasPrev = Boolean(prevScreenshotDataUrl);
    const prompt = buildPrompt(action, hasPrev);

    // Build parts: images first, then text
    const parts: Record<string, unknown>[] = [
      { inline_data: { mime_type: currentImage.mimeType, data: currentImage.data } },
    ];

    if (prevScreenshotDataUrl) {
      const prevImage = stripDataUrlPrefix(prevScreenshotDataUrl);
      if (prevImage) {
        parts.push({
          inline_data: { mime_type: prevImage.mimeType, data: prevImage.data },
        });
      }
    }

    parts.push({ text: prompt });

    const body = {
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_SCHEMA,
      },
    };

    const url = `${API_BASE}/${this.model}:generateContent`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(ENRICHMENT_TIMEOUT_MS),
      });
    } catch (err) {
      console.warn('GeminiDirectProvider: network error', err);
      return null;
    }

    // Handle 429 with Retry-After: retry once
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 10_000;
      await new Promise<void>((r) => setTimeout(r, delayMs));

      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'x-goog-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(ENRICHMENT_TIMEOUT_MS),
        });
      } catch (err) {
        console.warn('GeminiDirectProvider: retry network error', err);
        return null;
      }
    }

    if (!response.ok) {
      console.warn(`GeminiDirectProvider: API returned ${response.status}`);
      return null;
    }

    const data = (await response.json()) as GeminiApiResponse;
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      console.warn('GeminiDirectProvider: empty response from API');
      return null;
    }

    return parseEnrichmentResponse(responseText, action);
  }
}

// ─── Response parsing ───────────────────────────────────────────────────────

function parseEnrichmentResponse(
  responseText: string,
  action: CapturedAction,
): EnrichedAction | null {
  let parsed: Record<string, unknown>;
  try {
    const jsonStr = extractJsonFromResponse(responseText);
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    console.warn('GeminiDirectProvider: failed to parse JSON response');
    return null;
  }

  // Parse each key independently — if one fails, others still work
  const description = typeof parsed.description === 'string' ? parsed.description : null;
  const visualAnalysis = (parsed.visualAnalysis as Record<string, unknown>) || null;
  const decisionAnalysis = (parsed.decisionAnalysis as Record<string, unknown>) || null;

  return {
    humanDescription: description || action.description,
    visualAnalysis: {
      interactedElement: visualAnalysis?.interactedElement as
        | { type: string; text: string; description: string }
        | undefined,
      pageContext: visualAnalysis?.pageContext as
        | { app: string; section: string; workflow: string }
        | undefined,
      statusIndicators: Array.isArray(visualAnalysis?.statusIndicators)
        ? (visualAnalysis.statusIndicators as string[])
        : undefined,
      layout: typeof visualAnalysis?.layout === 'string' ? visualAnalysis.layout : undefined,
      confidence:
        typeof visualAnalysis?.confidence === 'number' ? visualAnalysis.confidence : undefined,
      boundingBox: visualAnalysis?.boundingBox as
        | { y0: number; x0: number; y1: number; x1: number }
        | undefined,
    },
    decisionAnalysis: {
      isDecisionPoint:
        typeof decisionAnalysis?.isDecisionPoint === 'boolean'
          ? decisionAnalysis.isDecisionPoint
          : false,
      reason: typeof decisionAnalysis?.reason === 'string' ? decisionAnalysis.reason : '',
      branches: Array.isArray(decisionAnalysis?.branches)
        ? (decisionAnalysis.branches as { condition: string; description: string }[])
        : [],
    },
  };
}

// ─── Connection test ────────────────────────────────────────────────────────

export async function testGeminiConnection(apiKey: string): Promise<boolean> {
  const url = `${API_BASE}/${DEFAULT_MODEL}:generateContent`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with: {"status":"ok"}' }] }],
      }),
      signal: AbortSignal.timeout(CONNECTION_TEST_TIMEOUT_MS),
    });

    if (!response.ok) return false;

    const data = (await response.json()) as GeminiApiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' && text.length > 0;
  } catch {
    return false;
  }
}
