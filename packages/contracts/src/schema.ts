import schemaJson from "../../../schemas/studyshift.schema.json";

/** Raw JSON Schema (draft 2020-12). Validate a payload against `$defs/<TypeName>`. */
export const studyshiftSchema = schemaJson as Record<string, unknown>;
