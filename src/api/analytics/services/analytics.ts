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
} from '../../../types/analytics-collections';

type CountRow = { count: string | number | null };

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

    const withPercentage = (count: number) => ({
      count,
      percentage: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
    });

    return {
      total,
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
   * Flattens analytics payloads into tabular rows for Excel export.
   */
  async getExportRows(type: AnalyticsExportType) {
    if (type === 'demographics') {
      const demographics = await this.getDemographics();

      return [
        ...demographics.gender.map((row) => ({ section: 'gender', ...row })),
        ...demographics.cooperative.map((row) => ({ section: 'cooperative', ...row })),
        ...demographics.location.map((row) => ({ section: 'location', ...row })),
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
