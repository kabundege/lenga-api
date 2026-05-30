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

/**
 * Strapi v5 relation link tables (`*_lnk`).
 * Relations are not stored as inline FK columns on collection tables.
 */
export const ANALYTICS_LINK_TABLES = {
  extendedProfileUser: 'extended_profiles_user_lnk',
  moduleAttendanceUser: 'module_attendances_user_lnk',
  moduleAttendanceLesson: 'module_attendances_lesson_lnk',
  assessmentSubmissionUser: 'assessment_submissions_user_lnk',
  assessmentSubmissionQuiz: 'assessment_submissions_quiz_lnk',
  assessmentSubmissionMatching: 'assessment_submissions_matching_lnk',
} as const;

/** Valid `:type` path segments for `/api/analytics/export/:type`. */
export type AnalyticsExportType = 'demographics' | 'attendance' | 'assessments';

export const ANALYTICS_EXPORT_TYPES: AnalyticsExportType[] = [
  'demographics',
  'attendance',
  'assessments',
];

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
