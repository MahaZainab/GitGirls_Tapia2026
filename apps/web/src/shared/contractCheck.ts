/**
 * Dev-only structural check against `schemas/studyshift.schema.json`
 * (spec section 3.2: "Responses MUST validate against the schema. The web
 * app runs a dev-only contract check on every response."). Deliberately a
 * light-weight subset validator (required fields, additionalProperties,
 * enum/const, pattern, array item shape) rather than a full JSON Schema
 * engine -- good enough to catch drift during development without adding a
 * schema-validation runtime dependency. Violations are reported via
 * `contract.violation`, never thrown, so a shape mismatch never breaks the
 * UI (rule F1-R07's spirit, applied product-wide).
 */
import { studyshiftSchema } from "@studyshift/contracts";
import { emitContractViolation } from "./eventBus";

type JSONSchema = Record<string, any>;

function resolveRef(schema: JSONSchema, ref: string): JSONSchema {
  const name = ref.replace("#/$defs/", "");
  const defs = schema.$defs ?? {};
  if (!(name in defs)) {
    throw new Error(`unknown $ref ${ref}`);
  }
  return defs[name];
}

function check(schema: JSONSchema, def: JSONSchema, value: unknown, path: string, errors: string[]): void {
  if (def.$ref) {
    check(schema, resolveRef(schema, def.$ref), value, path, errors);
    return;
  }
  if (def.const !== undefined && value !== def.const) {
    errors.push(`${path}: expected const ${JSON.stringify(def.const)}, got ${JSON.stringify(value)}`);
    return;
  }
  if (def.enum && !def.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(def.enum)}`);
    return;
  }
  if (def.pattern && typeof value === "string" && !new RegExp(def.pattern).test(value)) {
    errors.push(`${path}: "${value}" does not match ${def.pattern}`);
  }
  if (def.type === "object" || def.properties) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push(`${path}: expected an object`);
      return;
    }
    const obj = value as Record<string, unknown>;
    for (const key of def.required ?? []) {
      if (!(key in obj)) errors.push(`${path}.${key}: missing required field`);
    }
    if (def.additionalProperties === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in (def.properties ?? {}))) errors.push(`${path}.${key}: unexpected field`);
      }
    }
    for (const [key, propDef] of Object.entries<JSONSchema>(def.properties ?? {})) {
      if (key in obj) check(schema, propDef, obj[key], `${path}.${key}`, errors);
    }
  } else if (def.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected an array`);
      return;
    }
    if (def.minItems !== undefined && value.length < def.minItems) {
      errors.push(`${path}: expected at least ${def.minItems} item(s), got ${value.length}`);
    }
    if (def.items) {
      value.forEach((item, i) => check(schema, def.items, item, `${path}[${i}]`, errors));
    }
  }
}

/**
 * Dev-only: check `value` against `schemas/studyshift.schema.json#/$defs/<typeName>`.
 * Emits `contract.violation` and logs a warning on mismatch; never throws.
 */
export function checkContract(typeName: string, value: unknown, where: string): void {
  if (!import.meta.env.DEV) return;
  try {
    const errors: string[] = [];
    check(studyshiftSchema, { $ref: `#/$defs/${typeName}` }, value, typeName, errors);
    if (errors.length > 0) {
      emitContractViolation(where, `${typeName} failed contract check:\n${errors.join("\n")}`);
    }
  } catch (err) {
    emitContractViolation(where, `contract check threw: ${(err as Error).message}`);
  }
}
