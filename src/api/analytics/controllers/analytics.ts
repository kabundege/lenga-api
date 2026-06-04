/**
 * Analytics controller
 *
 * Exposes dashboard aggregation endpoints and Excel export downloads.
 * Delegates heavy SQL work to the analytics service (Knex aggregations).
 */

import type { Core } from '@strapi/strapi';
import * as XLSX from 'xlsx';

import {
  ANALYTICS_EXPORT_TYPES,
  type AnalyticsExportType,
} from '../../../types/analytics-collections';

const isExportType = (value: string): value is AnalyticsExportType =>
  ANALYTICS_EXPORT_TYPES.includes(value as AnalyticsExportType);

const normalizeQueryScalar = (value: unknown): string | undefined => {
  if (value == null || value === '') return undefined;
  if (Array.isArray(value)) return value[0] != null ? String(value[0]) : undefined;
  return String(value);
};

const parseLearnerListParams = (query: Record<string, unknown>) => {
  const rawLessonId = normalizeQueryScalar(query.lesson_id) ?? normalizeQueryScalar(query.lessonId);
  const rawLessonOrder =
    normalizeQueryScalar(query.lesson_order) ?? normalizeQueryScalar(query.lessonOrder);
  const lessonId = rawLessonId != null ? Number(rawLessonId) : undefined;
  const lessonOrder = rawLessonOrder != null ? Number(rawLessonOrder) : undefined;

  const rawAssessmentType =
    normalizeQueryScalar(query.assessment_type) ?? normalizeQueryScalar(query.assessmentType);
  const assessmentType =
    rawAssessmentType === 'quiz' || rawAssessmentType === 'matching'
      ? rawAssessmentType
      : undefined;
  const rawAssessmentId =
    normalizeQueryScalar(query.assessment_id) ?? normalizeQueryScalar(query.assessmentId);
  const rawAssessmentOrder =
    normalizeQueryScalar(query.assessment_order) ?? normalizeQueryScalar(query.assessmentOrder);
  const assessmentId = rawAssessmentId != null ? Number(rawAssessmentId) : undefined;
  const assessmentOrder = rawAssessmentOrder != null ? Number(rawAssessmentOrder) : undefined;

  return {
    limit: query.limit != null ? Number(query.limit) : undefined,
    offset: query.offset != null ? Number(query.offset) : undefined,
    lesson_id:
      lessonId != null && Number.isInteger(lessonId) && lessonId > 0 ? lessonId : undefined,
    lesson_order:
      lessonOrder != null && Number.isInteger(lessonOrder) && lessonOrder > 0
        ? lessonOrder
        : undefined,
    assessment_type: assessmentType,
    assessment_id:
      assessmentId != null && Number.isInteger(assessmentId) && assessmentId > 0
        ? assessmentId
        : undefined,
    assessment_order:
      assessmentOrder != null && Number.isInteger(assessmentOrder) && assessmentOrder > 0
        ? assessmentOrder
        : undefined,
  };
};

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * GET /api/analytics/demographics
   */
  async getDemographics(ctx) {
    const data = await strapi.service('api::analytics.analytics').getDemographics();
    ctx.body = { data };
  },

  /**
   * GET /api/analytics/attendance
   */
  async getAttendance(ctx) {
    const data = await strapi.service('api::analytics.analytics').getAttendance();
    ctx.body = { data };
  },

  /**
   * GET /api/analytics/assessments
   */
  async getAssessments(ctx) {
    const data = await strapi.service('api::analytics.analytics').getAssessments();
    ctx.body = { data };
  },

  /**
   * GET /api/analytics/assessments/passed-learners
   */
  async getPassedLearners(ctx) {
    const params = parseLearnerListParams(ctx.query as Record<string, unknown>);
    const data = await strapi.service('api::analytics.analytics').getPassedLearners(params);
    ctx.body = { data };
  },

  /**
   * GET /api/analytics/attendance/completed-learners
   */
  async getCompletedLearners(ctx) {
    const params = parseLearnerListParams(ctx.query as Record<string, unknown>);
    const data = await strapi.service('api::analytics.analytics').getCompletedLearners(params);
    ctx.body = { data };
  },

  /**
   * GET /api/analytics/export/:type
   *
   * Streams an `.xlsx` workbook built from the same Knex aggregations as the JSON endpoints.
   */
  async exportToExcel(ctx) {
    const { type } = ctx.params;

    if (!isExportType(type)) {
      return ctx.badRequest(
        `Invalid export type. Expected one of: ${ANALYTICS_EXPORT_TYPES.join(', ')}`,
      );
    }

    const rows = await strapi.service('api::analytics.analytics').getExportRows(type);

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Analytics');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    ctx.set(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    ctx.set(
      'Content-Disposition',
      `attachment; filename=analytics_${type}_${timestamp}.xlsx`,
    );
    ctx.body = buffer;
  },
});
