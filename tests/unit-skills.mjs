/**
 * Tests for skills block extraction and rewriting.
 * Verifies we correctly extract skills from pi's system prompt and rewrite
 * the read tool reference for the Claude Code MCP bridge.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractSkillsBlock, extractStructuredOutputBlock } from "../src/skills.js";

// Realistic pi system prompt with skills block
const SYSTEM_PROMPT = `You are a coding assistant.

The following skills provide specialized instructions for specific tasks.
Use the read tool to load a skill's file when the task matches its description.
When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.

<available_skills>
  <skill>
    <name>br</name>
    <description>Browser automation CLI.</description>
    <location>/Users/esd/projects/pi-my-stuff/skills/br/SKILL.md</location>
  </skill>
  <skill>
    <name>deep-research</name>
    <description>Deep research via parallel web agents.</description>
    <location>/Users/esd/.pi/agent/skills/deep-research/SKILL.md</location>
  </skill>
</available_skills>

Some other system prompt content after skills.`;

describe("skills block extraction", () => {
	it("extracts and rewrites read tool reference", () => {
		const result = extractSkillsBlock(SYSTEM_PROMPT);
		assert.ok(result, "should extract skills block");
		assert.ok(result.includes("Use the read tool (mcp__custom-tools__read) to load a skill's file"));
		assert.ok(!result.includes("Use the read tool to load a skill's file\n"));
	});

	it("preserves skill paths as-is", () => {
		const result = extractSkillsBlock(SYSTEM_PROMPT);
		assert.ok(result.includes("/Users/esd/projects/pi-my-stuff/skills/br/SKILL.md"));
		assert.ok(result.includes("/Users/esd/.pi/agent/skills/deep-research/SKILL.md"));
	});

	it("correct boundaries", () => {
		const result = extractSkillsBlock(SYSTEM_PROMPT);
		assert.ok(result.startsWith("The following skills"));
		assert.ok(result.endsWith("</available_skills>"));
		assert.ok(!result.includes("Some other system prompt"));
	});

	it("no skills in prompt → undefined", () => {
		assert.strictEqual(extractSkillsBlock("Just a normal prompt"), undefined);
		assert.strictEqual(extractSkillsBlock(undefined), undefined);
		assert.strictEqual(extractSkillsBlock(""), undefined);
	});

	it("malformed: start marker but no end marker → undefined", () => {
		const partial = "The following skills provide specialized instructions for specific tasks.\nBut no closing tag.";
		assert.strictEqual(extractSkillsBlock(partial), undefined);
	});
});

// Verbatim from pi-subagents STRUCTURED_OUTPUT_INSTRUCTIONS; if upstream rewords these lines the
// markers stop matching and outputSchema steps silently regress.
const STRUCTURED_PROMPT = `You are a child subagent, not the parent orchestrator.

This subagent step has a strict structured output contract.
Your final action must be to call the \`structured_output\` tool with JSON matching the provided schema.
Do not rely on prose-only completion; if you do not call \`structured_output\`, the parent will fail this step.

You are a coding assistant.`;

describe("structured output block extraction", () => {
	it("prefixes every tool reference for the MCP bridge", () => {
		const result = extractStructuredOutputBlock(STRUCTURED_PROMPT);
		assert.ok(result, "should extract structured output block");
		assert.ok(result.includes("call the `mcp__custom-tools__structured_output` tool"));
		assert.ok(result.includes("if you do not call `mcp__custom-tools__structured_output`"));
		assert.ok(!result.includes("`structured_output`"));
	});

	it("correct boundaries", () => {
		const result = extractStructuredOutputBlock(STRUCTURED_PROMPT);
		assert.ok(result.startsWith("This subagent step has a strict"));
		assert.ok(result.endsWith("the parent will fail this step."));
		assert.ok(!result.includes("You are a coding assistant"));
		assert.ok(!result.includes("child subagent, not the parent"));
	});

	it("no contract in prompt → undefined", () => {
		assert.strictEqual(extractStructuredOutputBlock("Just a normal prompt"), undefined);
		assert.strictEqual(extractStructuredOutputBlock(undefined), undefined);
		assert.strictEqual(extractStructuredOutputBlock(""), undefined);
	});

	it("malformed: start marker but no end marker → undefined", () => {
		assert.strictEqual(extractStructuredOutputBlock("This subagent step has a strict structured output contract.\nTruncated."), undefined);
	});
});
