// Canonical selection + display order for the model picker.
// `resolveModelId` returns the first partial match, so `opus` resolves to the first-listed opus entry.
// Extracted from index.ts so tests can import without activating the extension.

export const MODEL_IDS_IN_ORDER = ["claude-fable-5", "claude-opus-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-5", "claude-sonnet-4-6", "claude-haiku-4-5"];

// Entries for models the claude CLI accepts but pi-ai's registry does not know yet
// (newly released models). buildModels falls back to these so they still appear in
// the picker; pi-ai entries take precedence once the registry catches up.
export const EXTRA_MODELS: Record<string, { id: string; name: string; reasoning: boolean; input: string[]; contextWindow: number; maxTokens: number; thinkingLevelMap?: Record<string, string> }> = {
	"claude-fable-5": {
		id: "claude-fable-5", name: "Claude Fable 5", reasoning: true,
		input: ["text", "image"], contextWindow: 1000000, maxTokens: 64000,
	},
	"claude-opus-5": {
		id: "claude-opus-5", name: "Claude Opus 5", reasoning: true,
		input: ["text", "image"], contextWindow: 200000, maxTokens: 64000,
	},
	"claude-sonnet-5": {
		id: "claude-sonnet-5", name: "Claude Sonnet 5", reasoning: true,
		input: ["text", "image"], contextWindow: 200000, maxTokens: 64000,
	},
};

// Project pi-ai's model entries down to the fields pi's registerProvider expects,
// and keep MODEL_IDS_IN_ORDER ordering. IDs absent from both pi-ai and EXTRA_MODELS
// are silently dropped.
export function buildModels<T extends { id: string; [key: string]: any }>(piAiModels: T[]) {
	return MODEL_IDS_IN_ORDER
		.map((id) => piAiModels.find((m) => m.id === id) ?? EXTRA_MODELS[id])
		.filter((m) => m != null)
		// Forward thinkingLevelMap so per-model overrides (e.g. opus-4-7 mapping
		// xhigh→xhigh instead of xhigh→max) are visible to the effort lookup.
		.map(({ id, name, reasoning, input, contextWindow, maxTokens, thinkingLevelMap }) => ({
			id, name, reasoning, input, contextWindow, maxTokens, thinkingLevelMap,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		}));
}

export function resolveModelId(models: Array<{ id: string }>, input: string): string {
	const lower = input.toLowerCase();
	const match = models.find((m) => m.id === lower || m.id.includes(lower));
	return match ? match.id : input;
}
