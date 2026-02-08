export { default as api } from './api';
export { default as authService } from './authService';
export { default as caService } from './caService';
export { default as serviceRequestService } from './serviceRequestService';
export { default as paymentService } from './paymentService';
export { default as messageService } from './messageService';
export { default as reviewService } from './reviewService';
export { default as securityService } from './securityService';
export { default as firmService } from './firmService';
export { default as notificationService } from './notificationService';
export { default as refundService } from './refundService';
export { dashboardService } from './dashboardService';
export { advancedSearchService } from './advancedSearchService';

export type { LoginCredentials, RegisterData } from './authService';
export type { CAFilters } from './caService';
export type { CreateServiceRequestData, UpdateServiceRequestData } from './serviceRequestService';
export type { CreateOrderData, VerifyPaymentData } from './paymentService';
export type { SendMessageData } from './messageService';
export type { CreateReviewData } from './reviewService';
export type { SecurityScan, SecurityFinding, DashboardSummary, SecurityStats, CspViolation } from './securityService';
export type {
  FirmFilters,
  CreateFirmData,
  AddMemberData,
  UploadDocumentData,
  CreateIndependentWorkRequestData
} from './firmService';
export type { Notification, NotificationResponse, UnreadCountResponse } from './notificationService';
export type {
  RefundEligibility,
  RefundRequest,
  RefundReason,
  RefundStatus
} from './refundService';
export type {
  ClientDashboardMetrics,
  CADashboardMetrics,
  AdminDashboardMetrics
} from './dashboardService';
export type {
  AdvancedSearchFilters,
  SearchResultItem,
  AdvancedSearchResponse
} from './advancedSearchService';
