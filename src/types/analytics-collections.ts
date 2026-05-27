/**
 * Domain types and table constants for analytics accumulation collections.
 *
 * Hand-maintained alongside Strapi content-type schemas in src/api/*.
 * Used by analytics Knex queries and export handlers (Steps 3–4).
 */

/** Gender values stored on extended profiles. */
export type Gender = 'Male' | 'Female' | 'Other' | 'PreferNotToSay';

/** Lesson progress states tracked in module attendance logs. */
export type ModuleAttendanceStatus = 'started' | 'completed';

/** Age brackets used when grouping assessment analytics. */
export type AgeBracket = 'under_18' | '18_24' | '25_34' | '35_44' | '45_54' | '55_plus' | 'unknown';

/** Physical database table names (match schema.json collectionName). */
export const ANALYTICS_TABLES = {
  extendedProfiles: 'extended_profiles',
  moduleAttendances: 'module_attendances',
  assessmentSubmissions: 'assessment_submissions',
  users: 'up_users',
  lessons: 'lessons',
  quizzes: 'quizzes',
  matchings: 'matchings',
} as const;

/** Strapi join-table link field suffixes for manyToOne relations. */
export const ANALYTICS_LINK_FIELDS = {
  extendedProfileUser: 'user_id',
  moduleAttendanceUser: 'user_id',
  moduleAttendanceLesson: 'lesson_id',
  assessmentSubmissionUser: 'user_id',
  assessmentSubmissionQuiz: 'quiz_id',
  assessmentSubmissionMatching: 'matching_id',
} as const;

export interface ExtendedProfileAttributes {
  gender?: Gender | null;
  age?: number | null;
  is_pwd?: boolean;
  cooperative_name?: string | null;
  is_cooperative_member?: boolean;
  district?: string | null;
  sector?: string | null;
}

export interface ModuleAttendanceAttributes {
  status: ModuleAttendanceStatus;
  progress_percentage: number;
  completed_at?: string | null;
}

export interface AssessmentSubmissionAttributes {
  score: number;
  total_questions: number;
  is_passed: boolean;
}

/** Maps a numeric age to a bracket label for assessment demographic matrices. */
export const getAgeBracket = (age: number | null | undefined): AgeBracket => {
  if (age == null || Number.isNaN(age)) return 'unknown';
  if (age < 18) return 'under_18';
  if (age <= 24) return '18_24';
  if (age <= 34) return '25_34';
  if (age <= 44) return '35_44';
  if (age <= 54) return '45_54';
  return '55_plus';
};
