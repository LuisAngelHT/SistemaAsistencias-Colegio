import type { ManagementModule } from './management/types'

export const dashboardSummaryKey = ['director', 'summary'] as const

export const managementOptionsKey = (module: ManagementModule) =>
  ['director', 'management', module, 'options'] as const

export const managementListKey = (
  module: ManagementModule,
  page: number,
  query: string,
) => ['director', 'management', module, 'list', page, query] as const

export const enrollmentListKey = (sectionId: number) =>
  ['director', 'enrollments', sectionId] as const

export const studentSearchKey = (query: string) =>
  ['director', 'students', 'search', query] as const
