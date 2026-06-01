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

const parseLearnerListParams = (query: Record<string, unknown>) => ({
  limit: query.limit != null ? Number(query.limit) : undefined,
  offset: query.offset != null ? Number(query.offset) : undefined,
});

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
