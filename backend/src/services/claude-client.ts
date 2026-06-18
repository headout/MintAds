import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface ClaudeResponse {
  text: string;
  input_tokens: number;
  output_tokens: number;
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 2000,
): Promise<ClaudeResponse> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const block = response.content.find(b => b.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('Claude returned no text content');
  }

  return {
    text: block.text,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  };
}
