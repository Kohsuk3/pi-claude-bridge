/**
 * Tests for provider-context compatibility (pi <0.86 legacy Context vs ≥0.86 TranscriptContext).
 * Regression: on pi 0.86+ `context.tools` is undefined, so the bridge used to hand Claude Code
 * zero tools and the model started emitting tool calls as text with fabricated results.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveSystemPrompt, resolveTools } from "../src/transcript-compat.js";

const readTool = { name: "read", description: "Read a file", parameters: { type: "object", properties: {} } };
const bashTool = { name: "bash", description: "Run a command", parameters: { type: "object", properties: {} } };
const bashV2 = { ...bashTool, description: "Run a command (v2)" };

describe("resolveTools", () => {
	it("returns legacy context.tools when present", () => {
		const ctx = { tools: [readTool], systemPrompt: "sys", messages: [] };
		assert.deepEqual(resolveTools(ctx), [readTool]);
	});

	it("returns an empty legacy array as-is (does not fall back to transcript)", () => {
		const ctx = { tools: [], messages: [{ role: "system", content: "", toolsAdded: [readTool] }] };
		assert.deepEqual(resolveTools(ctx), []);
	});

	it("collects toolsAdded from transcript system messages", () => {
		const ctx = {
			messages: [
				{ role: "system", content: "You are pi.", toolsAdded: [readTool, bashTool], timestamp: 1 },
				{ role: "user", content: "hi" },
			],
		};
		assert.deepEqual(resolveTools(ctx).map((t) => t.name), ["read", "bash"]);
	});

	it("applies toolsRemoved and later re-additions in transcript order", () => {
		const ctx = {
			messages: [
				{ role: "system", content: "You are pi.", toolsAdded: [readTool, bashTool] },
				{ role: "user", content: "hi" },
				{ role: "assistant", content: [{ type: "text", text: "hello" }] },
				{ role: "system", content: "", toolsRemoved: [{ name: "read" }], toolsAdded: [bashV2] },
				{ role: "user", content: "again" },
			],
		};
		const tools = resolveTools(ctx);
		assert.deepEqual(tools.map((t) => t.name), ["bash"]);
		assert.equal(tools[0].description, "Run a command (v2)");
	});

	it("returns [] when neither shape carries tools", () => {
		assert.deepEqual(resolveTools({ messages: [{ role: "user", content: "hi" }] }), []);
		assert.deepEqual(resolveTools({ messages: [] }), []);
	});
});

describe("resolveSystemPrompt", () => {
	it("returns legacy context.systemPrompt when present", () => {
		assert.equal(resolveSystemPrompt({ systemPrompt: "legacy", messages: [] }), "legacy");
	});

	it("treats an empty legacy string as undefined", () => {
		assert.equal(resolveSystemPrompt({ systemPrompt: "", messages: [] }), undefined);
	});

	it("folds transcript system messages: content then sections, later section values override", () => {
		const ctx = {
			messages: [
				{ role: "system", content: "Base prompt.", sections: { skills: "<available_skills>a</available_skills>" } },
				{ role: "user", content: "hi" },
				{ role: "system", content: "", sections: { skills: "<available_skills>b</available_skills>", extra: "more" } },
			],
		};
		assert.equal(
			resolveSystemPrompt(ctx),
			"Base prompt.\n\n<available_skills>b</available_skills>\n\nmore",
		);
	});

	it("drops sections set to null", () => {
		const ctx = {
			messages: [
				{ role: "system", content: "Base.", sections: { gone: "bye" } },
				{ role: "system", content: "", sections: { gone: null } },
			],
		};
		assert.equal(resolveSystemPrompt(ctx), "Base.");
	});

	it("handles text-block content and returns undefined when there is no system message", () => {
		assert.equal(
			resolveSystemPrompt({ messages: [{ role: "system", content: [{ type: "text", text: "Blocky" }] }] }),
			"Blocky",
		);
		assert.equal(resolveSystemPrompt({ messages: [{ role: "user", content: "hi" }] }), undefined);
	});

	it("still detects pi's summarization marker from a transcript system message", () => {
		const marker = "You are a context summarization assistant";
		const ctx = { messages: [{ role: "system", content: `${marker}. Summarize.` }, { role: "user", content: "..." }] };
		assert.ok(resolveSystemPrompt(ctx).startsWith(marker));
	});
});
