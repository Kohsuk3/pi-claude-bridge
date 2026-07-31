/**
 * Tests for TypeBox (JSON Schema) → Zod conversion used by buildMcpServers.
 * Nested object properties must survive the conversion, otherwise the model sees
 * an opaque object and invents its own field names.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jsonSchemaToZodShape } from "../src/typebox-to-zod.js";

// Shape of structured_output's parameters: a `value` wrapper around a caller-supplied schema.
const STRUCTURED_OUTPUT_PARAMS = {
	type: "object",
	required: ["value"],
	properties: {
		value: {
			type: "object",
			required: ["numbers"],
			properties: {
				numbers: { type: "array", items: { type: "integer" } },
				note: { type: "string" },
			},
		},
	},
};

describe("nested object conversion", () => {
	it("keeps nested field names and rejects invented ones", () => {
		const shape = jsonSchemaToZodShape(STRUCTURED_OUTPUT_PARAMS);
		assert.deepStrictEqual(
			shape.value.parse({ numbers: [5, 7, 11] }),
			{ numbers: [5, 7, 11] },
		);
		assert.throws(() => shape.value.parse({ extracted_integers: [5, 7, 11] }));
	});

	it("honours nested required vs optional", () => {
		const shape = jsonSchemaToZodShape(STRUCTURED_OUTPUT_PARAMS);
		assert.deepStrictEqual(
			shape.value.parse({ numbers: [1], note: "hi" }),
			{ numbers: [1], note: "hi" },
		);
		assert.throws(() => shape.value.parse({ note: "hi" }));
	});

	it("object without properties stays a permissive record", () => {
		const shape = jsonSchemaToZodShape({
			type: "object",
			required: ["bag"],
			properties: { bag: { type: "object" } },
		});
		assert.deepStrictEqual(shape.bag.parse({ anything: 1 }), { anything: 1 });
	});

	it("non-object schema → empty shape", () => {
		assert.deepStrictEqual(jsonSchemaToZodShape({ type: "string" }), {});
		assert.deepStrictEqual(jsonSchemaToZodShape(undefined), {});
	});
});
