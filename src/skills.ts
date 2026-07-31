// Skills block extraction + MCP naming constants.
// Extracted from index.ts so tests can import without activating the extension.

export const MCP_SERVER_NAME = "custom-tools";
export const MCP_TOOL_PREFIX = `mcp__${MCP_SERVER_NAME}__`;

// Extract skills block from pi's system prompt for forwarding to Claude Code.
export function extractSkillsBlock(systemPrompt?: string): string | undefined {
	if (!systemPrompt) return undefined;
	const startMarker = "The following skills provide specialized instructions for specific tasks.";
	const endMarker = "</available_skills>";
	const start = systemPrompt.indexOf(startMarker);
	if (start === -1) return undefined;
	const end = systemPrompt.indexOf(endMarker, start);
	if (end === -1) return undefined;
	return rewriteSkillsBlock(systemPrompt.slice(start, end + endMarker.length).trim());
}

export function rewriteSkillsBlock(skillsBlock: string): string {
	return skillsBlock.replace(
		"Use the read tool to load a skill's file",
		`Use the read tool (mcp__${MCP_SERVER_NAME}__read) to load a skill's file`,
	);
}

// pi-subagents injects its structured-output contract into the child's system prompt, which we
// replace with the claude_code preset. Without forwarding it the child holds the tool but is never
// told to call it, so every outputSchema step fails with "Missing structured_output call".
export function extractStructuredOutputBlock(systemPrompt?: string): string | undefined {
	if (!systemPrompt) return undefined;
	const startMarker = "This subagent step has a strict structured output contract.";
	const endMarker = "the parent will fail this step.";
	const start = systemPrompt.indexOf(startMarker);
	if (start === -1) return undefined;
	const end = systemPrompt.indexOf(endMarker, start);
	if (end === -1) return undefined;
	return systemPrompt.slice(start, end + endMarker.length).replaceAll(
		"`structured_output`",
		`\`${MCP_TOOL_PREFIX}structured_output\``,
	);
}
