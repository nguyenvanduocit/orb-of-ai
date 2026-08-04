import { z } from "zod";

export const OutcomeUnsignedIntegerSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER)
  .refine((value) => !Object.is(value, -0), "negative zero is not canonical");

export const OutcomePositiveIntegerSchema = OutcomeUnsignedIntegerSchema.min(1);

export const OutcomeNonEmptyStringSchema = z.string().min(1).max(200);

export const OutcomeInstanceIdSchema = z.string().min(1).max(128);
