/**
 * Analytics aggregation service
 *
 * Runs Knex/SQL aggregations against analytics accumulation tables.
 * Avoids Strapi Document Service so large dashboards are not sorted in memory.
 */

import type { Core } from '@strapi/strapi';

import {
  ANALYTICS_LINK_TABLES,
  ANALYTICS_TABLES,
  type AnalyticsExportType,
  type AnalyticsLearnerListParams,
  type AnalyticsLearnerListResult,
  type AnalyticsLearnerRow,
  type CompletedLessonSummary,
} from '../../../types/analytics-collections';

type CountRow = { count: string | number | null };
type DistinctCountRow = { total: string | number | null };

const toNumber = (value: unknown): number => Number(value ?? 0);

const normalizeBoolean = (value: unknown): boolean | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  return Boolean(Number(value));
};

/** SQL CASE expression for age bracket grouping (SQLite + PostgreSQL compatible). */
const AGE_BRACKET_SQL = `CASE
  WHEN ep.age IS NULL THEN 'unknown'
  WHEN ep.age < 18 THEN 'under_18'
  WHEN ep.age <= 24 THEN '18_24'
  WHEN ep.age <= 34 THEN '25_34'
  WHEN ep.age <= 44 THEN '35_44'
  WHEN ep.age <= 54 THEN '45_54'
  ELSE '55_plus'
END`;

const AGE_BRACKET_SQL_PLAIN = AGE_BRACKET_SQL.replace(/ep\./g, '');

const AGE_BRACKET_ORDER = [
  'under_18',
  '18_24',
  '25_34',
  '35_44',
  '45_54',
  '55_plus',
  'unknown',
] as const;

const sortByAgeBracket = <T extends { age_bracket: string }>(rows: T[]): T[] =>
  [...rows].sort(
    (a, b) =>
      AGE_BRACKET_ORDER.indexOf(a.age_bracket as (typeof AGE_BRACKET_ORDER)[number]) -
      AGE_BRACKET_ORDER.indexOf(b.age_bracket as (typeof AGE_BRACKET_ORDER)[number]),
  );

const DEFAULT_LEARNER_LIMIT = 50;
const MAX_LEARNER_LIMIT = 200;

const normalizePagination = (params: AnalyticsLearnerListParams = {}) => {
  const rawLimit = params.limit ?? DEFAULT_LEARNER_LIMIT;
  const limit = Math.min(Math.max(Number(rawLimit) || DEFAULT_LEARNER_LIMIT, 1), MAX_LEARNER_LIMIT);
  const offset = Math.max(Number(params.offset) || 0, 0);
  return { limit, offset };
};

const SYNTHETIC_EMAIL_SUFFIX = '@email.com';

const deriveLearnerDisplayName = (
  fullName: unknown,
  email: unknown,
  username: string,
): string => {
  const trimmedFull = fullName != null ? String(fullName).trim() : '';
  if (trimmedFull) return trimmedFull;

  const normalizedEmail = email != null ? String(email).trim().toLowerCase() : '';
  if (normalizedEmail.endsWith(SYNTHETIC_EMAIL_SUFFIX)) {
    const localPart = normalizedEmail.slice(0, -SYNTHETIC_EMAIL_SUFFIX.length);
    const fromEmail = localPart.replace(/_/g, ' ').trim();
    if (fromEmail) return fromEmail;
  }

  return username;
};

const mapLearnerProfileFields = (row: Record<string, unknown>) => ({
  user_id: toNumber(row.user_id),
  username: String(row.username ?? ''),
  gender: (row.gender as AnalyticsLearnerRow['gender']) ?? null,
  age: row.age != null && row.age !== '' ? toNumber(row.age) : null,
  district: row.district != null ? String(row.district) : null,
  sector: row.sector != null ? String(row.sector) : null,
  is_pwd: normalizeBoolean(row.is_pwd),
  is_cooperative_member: normalizeBoolean(row.is_cooperative_member),
  cooperative_name: row.cooperative_name != null ? String(row.cooperative_name) : null,
});

const mapLearnerRow = (
  row: Record<string, unknown>,
  countField: 'passed_count' | 'completed_lesson_count',
): AnalyticsLearnerRow => ({
  ...mapLearnerProfileFields(row),
  [countField]: toNumber(row[countField]),
});

const mapCompletedLearnerRow = (
  row: Record<string, unknown>,
  completedLessons: CompletedLessonSummary[],
): AnalyticsLearnerRow => {
  const profile = mapLearnerProfileFields(row);

  return {
    ...profile,
    display_name: deriveLearnerDisplayName(row.full_name, row.email, profile.username),
    completed_lessons: completedLessons,
  };
};

const sortCompletedLessons = (lessons: CompletedLessonSummary[]): CompletedLessonSummary[] =>
  [...lessons].sort((a, b) => {
    const orderA = a.lesson_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.lesson_order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.lesson_id - b.lesson_id;
  });

const learnerProfileSelect = [
  'u.id as user_id',
  'u.username',
  'u.email',
  'ep.full_name',
  'ep.gender',
  'ep.age',
  'ep.district',
  'ep.sector',
  'ep.is_pwd',
  'ep.is_cooperative_member',
  'ep.cooperative_name',
] as const;

const learnerProfileGroupBy = [
  'u.id',
  'u.username',
  'u.email',
  'ep.full_name',
  'ep.gender',
  'ep.age',
  'ep.district',
  'ep.sector',
  'ep.is_pwd',
  'ep.is_cooperative_member',
  'ep.cooperative_name',
] as const;

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Demographics dashboard payload: gender, cooperative membership, and location distributions.
   */
  async getDemographics() {
    const knex = strapi.db.connection;
    const totalRow = (await knex(ANALYTICS_TABLES.extendedProfiles)
      .count({ count: '*' })
      .first()) as CountRow | undefined;
    const total = toNumber(totalRow?.count);

    const genderRaw = await knex(ANALYTICS_TABLES.extendedProfiles)
      .select('gender')
      .count({ count: '*' })
      .groupBy('gender')
      .orderBy('count', 'desc');

    const cooperativeRaw = await knex(ANALYTICS_TABLES.extendedProfiles)
      .select('is_cooperative_member', 'cooperative_name')
      .count({ count: '*' })
      .groupBy('is_cooperative_member', 'cooperative_name')
      .orderBy('count', 'desc');

    const locationRaw = await knex(ANALYTICS_TABLES.extendedProfiles)
      .select('district', 'sector')
      .count({ count: '*' })
      .groupBy('district', 'sector')
      .orderBy('count', 'desc');

    const ageRaw = (await knex(ANALYTICS_TABLES.extendedProfiles)
      .select(knex.raw(`${AGE_BRACKET_SQL_PLAIN} as age_bracket`))
      .count({ count: '*' })
      .groupByRaw(AGE_BRACKET_SQL_PLAIN)) as Array<{
      age_bracket: string;
      count: string | number | null;
    }>;

    const pwdRaw = await knex(ANALYTICS_TABLES.extendedProfiles)
      .select('is_pwd')
      .count({ count: '*' })
      .groupBy('is_pwd')
      .orderBy('count', 'desc');

    const avgAgeRow = (await knex(ANALYTICS_TABLES.extendedProfiles)
      .whereNotNull('age')
      .avg({ average_age: 'age' })
      .first()) as { average_age: string | number | null } | undefined;

    const averageAgeRaw = avgAgeRow?.average_age;
    const averageAge =
      averageAgeRaw != null && averageAgeRaw !== ''
        ? Number(Number(averageAgeRaw).toFixed(1))
        : null;

    const withPercentage = (count: number) => ({
      count,
      percentage: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
    });

    return {
      total,
      average_age: averageAge,
      gender: genderRaw.map((row) => ({
        gender: row.gender ?? 'unknown',
        ...withPercentage(toNumber(row.count)),
      })),
      cooperative: cooperativeRaw.map((row) => ({
        is_cooperative_member: normalizeBoolean(row.is_cooperative_member),
        cooperative_name: row.cooperative_name ?? null,
        ...withPercentage(toNumber(row.count)),
      })),
      location: locationRaw.map((row) => ({
        district: row.district ?? 'unknown',
        sector: row.sector ?? 'unknown',
        ...withPercentage(toNumber(row.count)),
      })),
      age: sortByAgeBracket(
        ageRaw.map((row) => ({
          age_bracket: row.age_bracket ?? 'unknown',
          ...withPercentage(toNumber(row.count)),
        })),
      ),
      pwd: pwdRaw.map((row) => ({
        is_pwd: normalizeBoolean(row.is_pwd),
        ...withPercentage(toNumber(row.count)),
      })),
    };
  },

  /**
   * Lesson completion rates grouped by lesson and user demographics (gender, district).
   */
  async getAttendance() {
    const knex = strapi.db.connection;

    const rows = await knex(`${ANALYTICS_TABLES.moduleAttendances} as ma`)
      .innerJoin(
        `${ANALYTICS_LINK_TABLES.moduleAttendanceLesson} as ml`,
        'ml.module_attendance_id',
        'ma.id',
      )
      .innerJoin(
        `${ANALYTICS_LINK_TABLES.moduleAttendanceUser} as mu`,
        'mu.module_attendance_id',
        'ma.id',
      )
      .innerJoin(
        `${ANALYTICS_LINK_TABLES.extendedProfileUser} as epu`,
        'epu.user_id',
        'mu.user_id',
      )
      .innerJoin(`${ANALYTICS_TABLES.extendedProfiles} as ep`, 'ep.id', 'epu.extended_profile_id')
      .innerJoin(`${ANALYTICS_TABLES.lessons} as l`, 'l.id', 'ml.lesson_id')
      .select('ml.lesson_id', 'l.title as lesson_title')
      .select(knex.raw('l."order" as lesson_order'))
      .select('ep.gender', 'ep.district')
      .select(knex.raw('COUNT(DISTINCT mu.user_id) as total_users'))
      .select(
        knex.raw(
          "COUNT(DISTINCT CASE WHEN ma.status = 'completed' THEN mu.user_id END) as completed_users",
        ),
      )
      .groupBy('ml.lesson_id', 'l.title', 'ep.gender', 'ep.district')
      .groupByRaw('l."order"')
      .orderByRaw('l."order" asc');

    return {
      by_lesson: rows.map((row) => {
        const totalUsers = toNumber(row.total_users);
        const completedUsers = toNumber(row.completed_users);
        const completionRate =
          totalUsers > 0
            ? Number(((completedUsers / totalUsers) * 100).toFixed(2))
            : 0;

        return {
          lesson_id: row.lesson_id,
          lesson_order: toNumber(row.lesson_order) || null,
          lesson_title: row.lesson_title ?? null,
          gender: row.gender ?? 'unknown',
          district: row.district ?? 'unknown',
          total_users: totalUsers,
          completed_users: completedUsers,
          completion_rate: completionRate,
        };
      }),
    };
  },

  /**
   * Assessment pass rates grouped by quiz/matching and demographic matrices.
   */
  async getAssessments() {
    const knex = strapi.db.connection;

    const buildAssessmentQuery = (
      assessmentLinkTable: string,
      assessmentIdColumn: string,
      assessmentTable: string,
    ) =>
      knex(`${ANALYTICS_TABLES.assessmentSubmissions} as sub`)
        .innerJoin(
          `${ANALYTICS_LINK_TABLES.assessmentSubmissionUser} as su`,
          'su.assessment_submission_id',
          'sub.id',
        )
        .innerJoin(`${assessmentLinkTable} as al`, 'al.assessment_submission_id', 'sub.id')
        .innerJoin(`${assessmentTable} as a`, 'a.id', `al.${assessmentIdColumn}`)
        .innerJoin(
          `${ANALYTICS_LINK_TABLES.extendedProfileUser} as epu`,
          'epu.user_id',
          'su.user_id',
        )
        .innerJoin(`${ANALYTICS_TABLES.extendedProfiles} as ep`, 'ep.id', 'epu.extended_profile_id')
        .whereNotNull(`al.${assessmentIdColumn}`)
        .select(knex.raw(`al.${assessmentIdColumn} as assessment_id`))
        .select('a.title as assessment_title')
        .select(knex.raw('a."order" as assessment_order'))
        .select('ep.gender')
        .select(knex.raw(`${AGE_BRACKET_SQL} as age_bracket`))
        .select('ep.is_pwd')
        .select(knex.raw('COUNT(*) as total_submissions'))
        .select(knex.raw('SUM(CASE WHEN sub.is_passed THEN 1 ELSE 0 END) as passed_count'))
        .groupByRaw(
          `al.${assessmentIdColumn}, a."order", a.title, ep.gender, ep.is_pwd, ${AGE_BRACKET_SQL}`,
        )
        .orderByRaw('a."order" asc');

    const mapAssessmentRows = (
      rows: Array<Record<string, unknown>>,
      assessmentType: 'quiz' | 'matching',
    ) =>
      rows.map((row) => {
        const totalSubmissions = toNumber(row.total_submissions);
        const passedCount = toNumber(row.passed_count);
        const passRate =
          totalSubmissions > 0
            ? Number(((passedCount / totalSubmissions) * 100).toFixed(2))
            : 0;

        return {
          assessment_type: assessmentType,
          assessment_id: row.assessment_id,
          assessment_order: toNumber(row.assessment_order) || null,
          assessment_title: row.assessment_title ?? null,
          gender: row.gender ?? 'unknown',
          age_bracket: row.age_bracket ?? 'unknown',
          is_pwd: normalizeBoolean(row.is_pwd),
          total_submissions: totalSubmissions,
          passed_count: passedCount,
          pass_rate: passRate,
        };
      });

    const quizRows = await buildAssessmentQuery(
      ANALYTICS_LINK_TABLES.assessmentSubmissionQuiz,
      'quiz_id',
      ANALYTICS_TABLES.quizzes,
    );
    const matchingRows = await buildAssessmentQuery(
      ANALYTICS_LINK_TABLES.assessmentSubmissionMatching,
      'matching_id',
      ANALYTICS_TABLES.matchings,
    );

    return {
      by_quiz: mapAssessmentRows(quizRows, 'quiz'),
      by_matching: mapAssessmentRows(matchingRows, 'matching'),
    };
  },

  /**
   * Distinct learners with at least one passing assessment submission.
   */
  async getPassedLearners(
    params: AnalyticsLearnerListParams = {},
  ): Promise<AnalyticsLearnerListResult> {
    const knex = strapi.db.connection;
    const { limit, offset } = normalizePagination(params);

    const baseQuery = () =>
      knex(`${ANALYTICS_TABLES.assessmentSubmissions} as sub`)
        .innerJoin(
          `${ANALYTICS_LINK_TABLES.assessmentSubmissionUser} as su`,
          'su.assessment_submission_id',
          'sub.id',
        )
        .innerJoin(`${ANALYTICS_TABLES.users} as u`, 'u.id', 'su.user_id')
        .leftJoin(
          `${ANALYTICS_LINK_TABLES.extendedProfileUser} as epu`,
          'epu.user_id',
          'u.id',
        )
        .leftJoin(`${ANALYTICS_TABLES.extendedProfiles} as ep`, 'ep.id', 'epu.extended_profile_id')
        .where('sub.is_passed', true);

    const totalRow = (await baseQuery()
      .countDistinct({ total: 'u.id' })
      .first()) as DistinctCountRow | undefined;
    const total = toNumber(totalRow?.total);

    const rows = await baseQuery()
      .select([...learnerProfileSelect])
      .select(knex.raw('COUNT(DISTINCT sub.id) as passed_count'))
      .groupBy([...learnerProfileGroupBy])
      .orderBy('u.username', 'asc')
      .limit(limit)
      .offset(offset);

    return {
      total,
      learners: rows.map((row) => mapLearnerRow(row, 'passed_count')),
    };
  },

  /**
   * Distinct learners with at least one completed module attendance record.
   */
  async getCompletedLearners(
    params: AnalyticsLearnerListParams = {},
  ): Promise<AnalyticsLearnerListResult> {
    const knex = strapi.db.connection;
    const { limit, offset } = normalizePagination(params);
    const lessonId = params.lesson_id;
    const lessonOrder = params.lesson_order;

    const resolveFilteredLessonIds = async (): Promise<number[] | null> => {
      if (lessonId == null) return null;

      if (lessonOrder != null) {
        const rows = await knex(ANALYTICS_TABLES.lessons)
          .whereRaw('"order" = ?', [lessonOrder])
          .select('id');
        const ids = rows.map((row) => toNumber(row.id)).filter((id) => id > 0);
        return ids.length > 0 ? ids : [lessonId];
      }

      return [lessonId];
    };

    const filteredLessonIds = await resolveFilteredLessonIds();

    const baseQuery = () => {
      let query = knex(`${ANALYTICS_TABLES.moduleAttendances} as ma`)
        .innerJoin(
          `${ANALYTICS_LINK_TABLES.moduleAttendanceUser} as mu`,
          'mu.module_attendance_id',
          'ma.id',
        )
        .innerJoin(`${ANALYTICS_TABLES.users} as u`, 'u.id', 'mu.user_id')
        .leftJoin(
          `${ANALYTICS_LINK_TABLES.extendedProfileUser} as epu`,
          'epu.user_id',
          'u.id',
        )
        .leftJoin(`${ANALYTICS_TABLES.extendedProfiles} as ep`, 'ep.id', 'epu.extended_profile_id')
        .where('ma.status', 'completed');

      if (filteredLessonIds != null) {
        query = query.whereExists(
          knex(`${ANALYTICS_LINK_TABLES.moduleAttendanceLesson} as ml_filter`)
            .select(knex.raw('1'))
            .whereRaw('ml_filter.module_attendance_id = ma.id')
            .whereIn('ml_filter.lesson_id', filteredLessonIds),
        );
      }

      return query;
    };

    const totalRow = (await baseQuery()
      .countDistinct({ total: 'u.id' })
      .first()) as DistinctCountRow | undefined;
    const total = toNumber(totalRow?.total);

    const rows = (await baseQuery()
      .select([...learnerProfileSelect])
      .groupBy([...learnerProfileGroupBy])
      .orderBy('u.username', 'asc')
      .limit(limit)
      .offset(offset)) as Record<string, unknown>[];

    const userIds = rows.map((row) => toNumber(row.user_id));
    const lessonsByUser = new Map<number, CompletedLessonSummary[]>();

    if (userIds.length > 0) {
      const lessonRows = await knex(`${ANALYTICS_TABLES.moduleAttendances} as ma`)
        .innerJoin(
          `${ANALYTICS_LINK_TABLES.moduleAttendanceUser} as mu`,
          'mu.module_attendance_id',
          'ma.id',
        )
        .innerJoin(`${ANALYTICS_TABLES.users} as u`, 'u.id', 'mu.user_id')
        .innerJoin(
          `${ANALYTICS_LINK_TABLES.moduleAttendanceLesson} as ml`,
          'ml.module_attendance_id',
          'ma.id',
        )
        .innerJoin(`${ANALYTICS_TABLES.lessons} as l`, 'l.id', 'ml.lesson_id')
        .where('ma.status', 'completed')
        .whereIn('u.id', userIds)
        .modify((qb) => {
          if (filteredLessonIds != null) {
            qb.whereIn('ml.lesson_id', filteredLessonIds);
          }
        })
        .select(
          'u.id as user_id',
          'ml.lesson_id',
          'l.title as lesson_title',
          knex.raw('l."order" as lesson_order'),
        )
        .groupBy('u.id', 'ml.lesson_id', 'l.title', knex.raw('l."order"'));

      for (const row of lessonRows) {
        const userId = toNumber(row.user_id);
        const lesson: CompletedLessonSummary = {
          lesson_id: toNumber(row.lesson_id),
          lesson_order: row.lesson_order != null && row.lesson_order !== '' ? toNumber(row.lesson_order) : null,
          lesson_title: row.lesson_title != null ? String(row.lesson_title) : null,
        };

        const existing = lessonsByUser.get(userId) ?? [];
        existing.push(lesson);
        lessonsByUser.set(userId, existing);
      }

      for (const [userId, lessons] of lessonsByUser) {
        lessonsByUser.set(userId, sortCompletedLessons(lessons));
      }
    }

    return {
      total,
      learners: rows.map((row) =>
        mapCompletedLearnerRow(row, lessonsByUser.get(toNumber(row.user_id)) ?? []),
      ),
    };
  },

  /**
   * Flattens analytics payloads into tabular rows for Excel export.
   */
  async getExportRows(type: AnalyticsExportType) {
    if (type === 'demographics') {
      const demographics = await this.getDemographics();

      return [
        ...demographics.gender.map((row) => ({ section: 'gender', ...row })),
        ...demographics.cooperative.map((row) => ({ section: 'cooperative', ...row })),
        ...demographics.location.map((row) => ({ section: 'location', ...row })),
        ...demographics.age.map((row) => ({ section: 'age', ...row })),
        ...demographics.pwd.map((row) => ({ section: 'pwd', ...row })),
      ];
    }

    if (type === 'attendance') {
      const attendance = await this.getAttendance();
      return attendance.by_lesson;
    }

    const assessments = await this.getAssessments();
    return [...assessments.by_quiz, ...assessments.by_matching];
  },
});
