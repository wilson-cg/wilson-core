/**
 * Wilson's default onboarding questionnaire.
 *
 * Used in two places:
 *   1. createClient() server action — every new workspace starts with these
 *   2. prisma/seed.ts — re-seeds existing demo workspaces with the same set
 *
 * Edit here to change the defaults; existing workspaces are NOT mutated
 * (clients can edit their own questions freely after onboarding starts).
 */

export type DefaultQuestion = {
  question: string;
  fieldType: "TEXT" | "LONGTEXT" | "URL" | "NUMBER" | "SINGLE_CHOICE" | "MULTI_CHOICE";
  options?: string[];
  minSelections?: number;
  maxSelections?: number;
  required?: boolean;
};

export const DEFAULT_ONBOARDING_QUESTIONS: DefaultQuestion[] = [
  {
    question: "What does your business do, in one or two sentences?",
    fieldType: "LONGTEXT",
    required: true,
  },
  {
    question:
      "Who are your current clients? Name a few and what you did for them.",
    fieldType: "LONGTEXT",
  },
  {
    question:
      "Describe your ideal client. Job title, company size, industry, and anything else that matters.",
    fieldType: "LONGTEXT",
  },
  {
    question:
      "What problem are you solving for them, in their own words? What would they say if you asked them why they came to you?",
    fieldType: "LONGTEXT",
  },
  {
    question:
      "What have your best clients typically tried before they found you? What did those attempts get wrong?",
    fieldType: "LONGTEXT",
  },
  {
    question:
      "What are you personally genuinely expert in? Two or three specific things, not generic.",
    fieldType: "LONGTEXT",
  },
  {
    question:
      "What's your unpopular opinion in your industry? The thing most people get wrong that you'd argue about.",
    fieldType: "LONGTEXT",
  },
  {
    question:
      "What questions do clients and prospects ask you most often? List three to five if you can.",
    fieldType: "LONGTEXT",
  },
  {
    question: "Pick your top traits you want to come through on LinkedIn.",
    fieldType: "MULTI_CHOICE",
    options: [
      "Direct",
      "Opinionated",
      "Warm",
      "Funny",
      "Authoritative",
      "Operator-led",
      "Educational",
      "Personal",
      "Data-driven",
      "Creative",
      "Playful",
    ],
    minSelections: 3,
    maxSelections: 5,
    required: true,
  },
  {
    question:
      "How comfortable are you sharing personal stories, opinions, and mistakes publicly?",
    fieldType: "SINGLE_CHOICE",
    options: [
      "Fully comfortable, no limits",
      "Mostly comfortable, selective",
      "Comfortable with professional stories, not personal",
      "Uncomfortable with personal content",
    ],
    required: true,
  },
];
