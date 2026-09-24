// Provider-context compatibility across pi versions.
//
// pi < 0.86 passes a legacy `Context` with `systemPrompt: string` and `tools: Tool[]`.
// pi >= 0.86 passes a normalized `TranscriptContext`: the system prompt and the tool
// declarations live in `role: "system"` transcript messages (`content` + `sections`,
// `toolsAdded` / `toolsRemoved`) and `context.systemPrompt` / `context.tools` are
// undefined. Reading the old fields on new pi silently yields *zero* tools, which
// leaves Claude Code with no tools at all and makes the model emit tool calls as
// plain text with fabricated results.
//
// These helpers accept both shapes. The transcript walk mirrors pi-ai's
// getCurrentTools() / getCurrentSystemPrompt() so we don't depend on which pi-ai
// build the extension happens to resolve at runtime.
// Extracted from index.ts so tests can import without activating the extension.

import type { Tool } from "@mariozechner/pi-ai";

interface SystemLikeMessage {
	role: string;
	content?: unknown;
	sections?: Record<string, string | null>;
	toolsAdded?: Tool[];
	toolsRemoved?: Array<{ name: string }>;
}

export interface CompatContext {
	systemPrompt?: unknown;
	tools?: unknown;
	messages: ReadonlyArray<unknown>;
}

function isSystemMessage(message: unknown): message is SystemLikeMessage {
	return typeof message === "object" && message !== null && (message as { role?: unknown }).role === "system";
}

function contentText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((block): block is { type: "text"; text: string } =>
			typeof block === "object" && block !== null && block.type === "text" && typeof block.text === "string")
		.map((block) => block.text)
		.join("");
}

/** Effective system prompt: legacy `context.systemPrompt` or the folded transcript system messages. */
export function resolveSystemPrompt(context: CompatContext): string | undefined {
	if (typeof context.systemPrompt === "string") return context.systemPrompt || undefined;

	const parts: string[] = [];
	const sections = new Map<string, string>();
	for (const message of context.messages ?? []) {
		if (!isSystemMessage(message)) continue;
		const text = contentText(message.content);
		if (text.length > 0) parts.push(text);
		for (const [name, value] of Object.entries(message.sections ?? {})) {
			if (value === null) sections.delete(name);
			else sections.set(name, value);
		}
	}
	const text = [...parts, ...sections.values()].filter((part) => part.length > 0).join("\n\n");
	return text || undefined;
}

/** Effective tool declarations: legacy `context.tools` or the net toolsAdded/toolsRemoved of the transcript. */
export function resolveTools(context: CompatContext): Tool[] {
	if (Array.isArray(context.tools)) return context.tools as Tool[];

	const tools = new Map<string, Tool>();
	for (const message of context.messages ?? []) {
		if (!isSystemMessage(message)) continue;
		for (const tool of message.toolsRemoved ?? []) tools.delete(tool.name);
		for (const tool of message.toolsAdded ?? []) tools.set(tool.name, tool);
	}
	return [...tools.values()];
}
