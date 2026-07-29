import { z } from "zod";

/**
 * Zod schemas validating write inputs at the form/repository seam
 * (react-hook-form via @hookform/resolvers). Enum values match domain/types.ts
 * and CONTRACT.md.
 */

export const severitySchema = z.enum(["Critical", "Elevated", "Advisory"]);

export const triggerSourceSchema = z.enum([
  "Scheduled",
  "Change_Event",
  "Manual",
  "CI_Gate",
]);

export const driftDetectorSchema = z.enum([
  "SEMANTIC_DRIFT",
  "STRUCTURAL_DRIFT",
  "ECONOMIC_DRIFT",
  "TRUST_DRIFT",
]);

/** FleetGoldenSetService.upsertCase input. */
export const goldenCaseInputSchema = z.object({
  id: z.string().optional(),
  agentId: z.string().min(1),
  caseKey: z
    .string()
    .min(1, "A case key is required")
    .regex(/^[A-Za-z0-9_]+$/, "Use letters, numbers, and underscores only"),
  utterance: z.string().min(1, "An utterance is required"),
  active: z.boolean().default(true),
  weight: z.number().min(0).max(10).default(1),
});

/** FleetCalibrationService.run input. */
export const runRequestSchema = z.object({
  agentId: z.string().min(1),
  triggerSource: triggerSourceSchema.default("Manual"),
});

/** FleetFindingService.open input. */
export const findingInputSchema = z.object({
  agentId: z.string().min(1),
  severity: severitySchema,
  headline: z.string().min(1).max(255),
  detail: z.string().min(1),
  detector: driftDetectorSchema,
});

/** Finding closure / hold reason. */
export const reasonSchema = z.object({
  reason: z.string().min(1, "A reason is required for the audit trail"),
});

export type GoldenCaseInputSchema = z.infer<typeof goldenCaseInputSchema>;
export type RunRequestSchema = z.infer<typeof runRequestSchema>;
export type FindingInputSchema = z.infer<typeof findingInputSchema>;
export type ReasonSchema = z.infer<typeof reasonSchema>;
