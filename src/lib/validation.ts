import { z } from "zod";

export const SignupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().toLowerCase().email("Please enter a valid email."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(200, "Password is too long."),
});

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

export const SaveUrlSchema = z.object({
  url: z.string().trim().url("Please enter a valid URL."),
});

export const NoteSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(300),
  contentHtml: z.string().max(500_000).optional().default(""),
});

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
