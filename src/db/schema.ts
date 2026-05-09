import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  json,
  uuid,
  pgEnum,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ════════════════════════════════════════════
// ENUMS
// ════════════════════════════════════════════

export const userRoleEnum = pgEnum("user_role", ["APPLICANT", "ADMIN"]);

export const educationLevelEnum = pgEnum("education_level", [
  "HIGH_SCHOOL",
  "ONE_YEAR_DIPLOMA",
  "TWO_YEAR_DIPLOMA",
  "BACHELORS",
  "POST_GRADUATION",
  "TWO_OR_MORE_CERTIFICATES",
  "MASTERS",
  "PHD",
  "TECHNICAL",
]);

export const languageTestTypeEnum = pgEnum("language_test_type", [
  "IELTS_GENERAL",
  "IELTS_ACADEMIC",
  "CELPIP",
  "TEF",
  "TCF",
]);

export const languageTestStatusEnum = pgEnum("language_test_status", [
  "PLANNED",
  "SCHEDULED",
  "COMPLETED",
  "EXPIRED",
]);

export const programCategoryEnum = pgEnum("program_category", [
  "EXPRESS_ENTRY",
  "PNP",
  "FAMILY",
  "PILOT",
  "STUDY",
]);

export const planPriorityEnum = pgEnum("plan_priority", [
  "PRIMARY",
  "SECONDARY",
  "TERTIARY",
]);

export const planStatusEnum = pgEnum("plan_status", [
  "RESEARCHING",
  "PREPARING",
  "APPLIED",
  "PROCESSING",
  "APPROVED",
  "REJECTED",
  "ON_HOLD",
]);

export const phaseStatusEnum = pgEnum("phase_status", [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "BLOCKED",
]);

export const stepStatusEnum = pgEnum("step_status", [
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "BLOCKED",
  "SKIPPED",
]);

export const stepPriorityEnum = pgEnum("step_priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "PASSPORT",
  "BIRTH_CERTIFICATE",
  "MARRIAGE_CERTIFICATE",
  "DIPLOMA",
  "TRANSCRIPT",
  "ECA",
  "IELTS_RESULT",
  "CELPIP_RESULT",
  "TEF_RESULT",
  "POLICE_CLEARANCE",
  "MEDICAL_EXAM",
  "PROOF_OF_FUNDS",
  "EMPLOYMENT_LETTER",
  "REFERENCE_LETTER",
  "PHOTOS",
  "OTHER",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "NOT_STARTED",
  "GATHERING",
  "SUBMITTED",
  "APPROVED",
  "EXPIRED",
  "NEEDS_UPDATE",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "DOCUMENT_EXPIRING",
  "STEP_DUE",
  "SCORE_UPDATE",
  "PROGRAM_CHANGE",
  "MILESTONE",
  "REMINDER",
]);

export const achievementTypeEnum = pgEnum("achievement_type", [
  "MILESTONE",
  "STREAK",
  "COMPLETION",
  "SCORE",
]);

export const jobApplicationStatusEnum = pgEnum("job_application_status", [
  "SAVED",
  "PREPARING",
  "APPLIED",
  "VIEWED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
]);

// ════════════════════════════════════════════
// AUTH TABLES (Auth.js / Drizzle Adapter)
// ════════════════════════════════════════════

export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  role: userRoleEnum("role").default("APPLICANT").notNull(),
  householdId: uuid("household_id").references(() => households.id),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ════════════════════════════════════════════
// PRODUCT TABLES — Immigration Tracking
// ════════════════════════════════════════════

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: timestamp("date_of_birth", { withTimezone: true }),
  nationality: text("nationality"),
  currentCountry: text("current_country"),
  educationLevel: educationLevelEnum("education_level"),
  fieldOfStudy: text("field_of_study"),
  yearsOfExperience: integer("years_of_experience"),
  currentOccupation: text("current_occupation"),
  nocCode: text("noc_code"),
  canadianExperienceYears: integer("canadian_experience_years").default(0),
  canadianEducation: boolean("canadian_education").default(false),
  maritalStatus: text("marital_status"),
  hasChildren: boolean("has_children").default(false),
  numberOfChildren: integer("number_of_children").default(0),
  fundsAvailable: decimal("funds_available", { precision: 12, scale: 2 }),
  isPrimaryApplicant: boolean("is_primary_applicant").default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const languageTests = pgTable("language_tests", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  testType: languageTestTypeEnum("test_type").notNull(),
  speaking: decimal("speaking", { precision: 4, scale: 1 }),
  listening: decimal("listening", { precision: 4, scale: 1 }),
  reading: decimal("reading", { precision: 4, scale: 1 }),
  writing: decimal("writing", { precision: 4, scale: 1 }),
  overallScore: decimal("overall_score", { precision: 4, scale: 1 }),
  clbEquivalent: integer("clb_equivalent"),
  testDate: timestamp("test_date", { withTimezone: true }),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  status: languageTestStatusEnum("status").default("PLANNED").notNull(),
  targetSpeaking: decimal("target_speaking", { precision: 4, scale: 1 }),
  targetListening: decimal("target_listening", { precision: 4, scale: 1 }),
  targetReading: decimal("target_reading", { precision: 4, scale: 1 }),
  targetWriting: decimal("target_writing", { precision: 4, scale: 1 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const crsScores = pgTable("crs_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  totalScore: integer("total_score").notNull(),
  coreScore: integer("core_score"),
  spouseScore: integer("spouse_score"),
  skillTransferScore: integer("skill_transfer_score"),
  additionalScore: integer("additional_score"),
  breakdown: json("breakdown").$type<Record<string, number>>(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  notes: text("notes"),
});

export const immigrationPrograms = pgTable("immigration_programs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code").unique().notNull(),
  category: programCategoryEnum("category").notNull(),
  description: text("description"),
  requirements: json("requirements").$type<Record<string, unknown>>(),
  processingTimeMonths: integer("processing_time_months"),
  minimumCLB: integer("minimum_clb"),
  minimumCRS: integer("minimum_crs"),
  minimumFunds: decimal("minimum_funds", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  lastUpdated: timestamp("last_updated", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const immigrationPlans = pgTable("immigration_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  programId: uuid("program_id")
    .notNull()
    .references(() => immigrationPrograms.id),
  priority: planPriorityEnum("priority").notNull(),
  status: planStatusEnum("status").default("RESEARCHING").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  targetDate: timestamp("target_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const journeyPhases = pgTable("journey_phases", {
  id: uuid("id").defaultRandom().primaryKey(),
  immigrationPlanId: uuid("immigration_plan_id")
    .notNull()
    .references(() => immigrationPlans.id, { onDelete: "cascade" }),
  phaseNumber: integer("phase_number").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: phaseStatusEnum("status").default("NOT_STARTED").notNull(),
  estimatedDurationDays: integer("estimated_duration_days"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  order: integer("order").notNull(),
  macroMilestoneId: text("macro_milestone_id"),
});

export const journeySteps = pgTable("journey_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  journeyPhaseId: uuid("journey_phase_id")
    .notNull()
    .references(() => journeyPhases.id, { onDelete: "cascade" }),
  immigrationPlanId: uuid("immigration_plan_id")
    .notNull()
    .references(() => immigrationPlans.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  instructions: text("instructions"),
  status: stepStatusEnum("status").default("TODO").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  assignedTo: uuid("assigned_to").references(() => profiles.id),
  priority: stepPriorityEnum("priority").default("MEDIUM").notNull(),
  order: integer("order").notNull(),
  parentStepId: uuid("parent_step_id"),
  actionUrl: text("action_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  immigrationPlanId: uuid("immigration_plan_id").references(
    () => immigrationPlans.id
  ),
  name: text("name").notNull(),
  type: documentTypeEnum("type").notNull(),
  status: documentStatusEnum("status").default("NOT_STARTED").notNull(),
  issueDate: timestamp("issue_date", { withTimezone: true }),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  fileUrl: text("file_url"),
  notes: text("notes"),
  originalLanguage: text("original_language"),
  translationRequired: boolean("translation_required").default(false).notNull(),
  translationCompleted: boolean("translation_completed").default(false).notNull(),
  usedInApplication: boolean("used_in_application").default(false).notNull(),
  requiredForPrograms: json("required_for_programs").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  link: text("link"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const achievements = pgTable("achievements", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  type: achievementTypeEnum("type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
});

// ════════════════════════════════════════════
// JOB APPLICATIONS
// ════════════════════════════════════════════

export const jobPreferences = pgTable("job_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: "cascade" }),
  jobTitles: text("job_titles").array().default([]).notNull(),
  keywords: text("keywords").array().default([]).notNull(),
  nocCodes: text("noc_codes").array().default([]).notNull(),
  provinces: text("provinces").array().default(["NB", "NS", "PE", "NL"]).notNull(),
  minSalary: integer("min_salary"),
  aipOnly: boolean("aip_only").default(true).notNull(),
  cvText: text("cv_text"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobApplications = pgTable("job_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  // Job info
  externalId: text("external_id"),
  jobTitle: text("job_title").notNull(),
  company: text("company").notNull(),
  location: text("location"),
  salary: text("salary"),
  jobUrl: text("job_url"),
  jobDescription: text("job_description"),
  isAip: boolean("is_aip").default(false).notNull(),
  program: text("program"),
  // Status pipeline
  status: jobApplicationStatusEnum("status").default("SAVED").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  interviewAt: timestamp("interview_at", { withTimezone: true }),
  // AI-generated content
  generatedCoverLetter: text("generated_cover_letter"),
  cvTips: text("cv_tips"),
  compatibilityScore: integer("compatibility_score"),
  // Notes
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ════════════════════════════════════════════
// RELATIONS
// ════════════════════════════════════════════

export const householdRelations = relations(households, ({ many }) => ({
  users: many(users),
  profiles: many(profiles),
  plans: many(immigrationPlans),
  notifications: many(notifications),
  achievements: many(achievements),
}));

export const userRelations = relations(users, ({ one, many }) => ({
  household: one(households, {
    fields: [users.householdId],
    references: [households.id],
  }),
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  accounts: many(accounts),
  sessions: many(sessions),
  notifications: many(notifications),
}));

export const accountRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const profileRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
  household: one(households, {
    fields: [profiles.householdId],
    references: [households.id],
  }),
  languageTests: many(languageTests),
  crsScores: many(crsScores),
  documents: many(documents),
  assignedSteps: many(journeySteps),
}));

export const languageTestRelations = relations(languageTests, ({ one }) => ({
  profile: one(profiles, {
    fields: [languageTests.profileId],
    references: [profiles.id],
  }),
}));

export const crsScoreRelations = relations(crsScores, ({ one }) => ({
  profile: one(profiles, {
    fields: [crsScores.profileId],
    references: [profiles.id],
  }),
}));

export const immigrationProgramRelations = relations(
  immigrationPrograms,
  ({ many }) => ({
    plans: many(immigrationPlans),
  })
);

export const immigrationPlanRelations = relations(
  immigrationPlans,
  ({ one, many }) => ({
    household: one(households, {
      fields: [immigrationPlans.householdId],
      references: [households.id],
    }),
    program: one(immigrationPrograms, {
      fields: [immigrationPlans.programId],
      references: [immigrationPrograms.id],
    }),
    phases: many(journeyPhases),
    steps: many(journeySteps),
    documents: many(documents),
  })
);

export const journeyPhaseRelations = relations(
  journeyPhases,
  ({ one, many }) => ({
    plan: one(immigrationPlans, {
      fields: [journeyPhases.immigrationPlanId],
      references: [immigrationPlans.id],
    }),
    steps: many(journeySteps),
  })
);

export const journeyStepRelations = relations(journeySteps, ({ one }) => ({
  phase: one(journeyPhases, {
    fields: [journeySteps.journeyPhaseId],
    references: [journeyPhases.id],
  }),
  plan: one(immigrationPlans, {
    fields: [journeySteps.immigrationPlanId],
    references: [immigrationPlans.id],
  }),
  assignee: one(profiles, {
    fields: [journeySteps.assignedTo],
    references: [profiles.id],
  }),
  parentStep: one(journeySteps, {
    fields: [journeySteps.parentStepId],
    references: [journeySteps.id],
  }),
}));

export const documentRelations = relations(documents, ({ one }) => ({
  profile: one(profiles, {
    fields: [documents.profileId],
    references: [profiles.id],
  }),
  plan: one(immigrationPlans, {
    fields: [documents.immigrationPlanId],
    references: [immigrationPlans.id],
  }),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  household: one(households, {
    fields: [notifications.householdId],
    references: [households.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const achievementRelations = relations(achievements, ({ one }) => ({
  household: one(households, {
    fields: [achievements.householdId],
    references: [households.id],
  }),
}));
