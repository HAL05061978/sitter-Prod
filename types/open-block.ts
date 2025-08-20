// ========================================
// OPEN BLOCK TYPE DEFINITIONS
// TypeScript interfaces for open block functionality
// ========================================

export interface AvailableParent {
  parent_id: string;
  parent_name: string;
  children_count: number; // This will be BIGINT from database, but number in TypeScript
}

export interface OpenBlockInvitation {
  care_response_id: string;
  care_request_id: string;
  group_id: string;
  group_name: string;
  existing_block_id: string;
  existing_block_date: string;
  existing_block_start_time: string;
  existing_block_end_time: string;
  open_block_parent_id: string;
  open_block_parent_name: string;
  reciprocal_date: string;
  reciprocal_start_time: string;
  reciprocal_end_time: string;
  block_time_id: string;
  status: 'pending' | 'accepted' | 'expired' | 'declined';
  notes?: string;
  created_at: string;
}

export interface OpenBlockRequest {
  id: string;
  group_id: string;
  requester_id: string;
  child_id?: string;
  requested_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  notes?: string;
  request_type: 'open_block';
  status: 'pending' | 'accepted' | 'cancelled';
  responder_id?: string;
  response_notes?: string;
  is_reciprocal: boolean;
  reciprocal_parent_id?: string;
  reciprocal_child_id?: string;
  reciprocal_date?: string;
  reciprocal_start_time?: string;
  reciprocal_end_time?: string;
  block_time_id?: string;
  open_block_parent_id?: string;
  open_block_slots?: number;
  open_block_slots_used?: number;
  existing_block_id?: string;
  inviting_parent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface OpenBlockResponse {
  id: string;
  request_id: string;
  responder_id: string;
  response_type: 'invitation' | 'response';
  response_notes?: string;
  status: 'pending' | 'accepted' | 'expired' | 'declined';
  created_at: string;
  reciprocal_date?: string;
  reciprocal_start_time?: string;
  reciprocal_end_time?: string;
  reciprocal_child_id?: string;
  block_time_id?: string;
  invited_parent_id?: string;
  accepted_parent_id?: string;
}

export interface CreateOpenBlockInvitationParams {
  existing_block_id: string;
  inviting_parent_id: string;
  invited_parent_ids: string[];
  reciprocal_dates: string[];
  reciprocal_start_times: string[];
  reciprocal_end_times: string[];
  notes?: string;
}

export interface AcceptOpenBlockInvitationParams {
  care_response_id: string;
  accepted_parent_id: string;
  accepted_child_id: string;
}

export interface OpenBlockInvitationFormData {
  invitedParents: Array<{
    id: string;
    name: string;
    children: Array<{
      id: string;
      name: string;
    }>;
  }>;
  reciprocalTimes: Array<{
    date: string;
    startTime: string;
    endTime: string;
    notes?: string;
  }>;
  notes?: string;
}

export interface OpenBlockAcceptanceFormData {
  acceptedChildId: string;
  notes?: string;
}

// ========================================
// API RESPONSE TYPES
// ========================================

export interface CreateOpenBlockInvitationResponse {
  data: string[]; // Array of block_time_ids
  error: null | {
    message: string;
    details?: string;
  };
}

export interface AcceptOpenBlockInvitationResponse {
  data: boolean;
  error: null | {
    message: string;
    details?: string;
  };
}

export interface GetOpenBlockInvitationsResponse {
  data: OpenBlockInvitation[];
  error: null | {
    message: string;
    details?: string;
  };
}

export interface GetAvailableParentsResponse {
  data: AvailableParent[];
  error: null | {
    message: string;
    details?: string;
  };
}

// ========================================
// UI COMPONENT PROPS
// ========================================

export interface OpenBlockInvitationCardProps {
  invitation: OpenBlockInvitation;
  onAccept: (invitation: OpenBlockInvitation) => void;
  onDecline: (invitation: OpenBlockInvitation) => void;
  isLoading?: boolean;
}

export interface OpenBlockInvitationFormProps {
  existingBlockId: string;
  existingBlockDate: string;
  existingBlockTime: string;
  onSubmit: (data: OpenBlockInvitationFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface OpenBlockAcceptanceFormProps {
  invitation: OpenBlockInvitation;
  availableChildren: Array<{
    id: string;
    name: string;
  }>;
  onSubmit: (data: OpenBlockAcceptanceFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// ========================================
// UTILITY TYPES
// ========================================

export type OpenBlockStatus = 'pending' | 'accepted' | 'expired' | 'declined';

export type OpenBlockRequestType = 'open_block';

export interface OpenBlockStats {
  totalInvitations: number;
  pendingInvitations: number;
  acceptedInvitations: number;
  expiredInvitations: number;
}

// ========================================
// VALIDATION SCHEMAS (for form validation)
// ========================================

export interface OpenBlockInvitationValidationSchema {
  invitedParents: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  reciprocalTimes: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  notes: {
    maxLength: number;
  };
}

export interface OpenBlockAcceptanceValidationSchema {
  acceptedChildId: {
    required: boolean;
  };
  notes: {
    maxLength: number;
  };
}

// ========================================
// CONSTANTS
// ========================================

export const OPEN_BLOCK_STATUSES = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  DECLINED: 'declined',
} as const;

export const OPEN_BLOCK_REQUEST_TYPES = {
  OPEN_BLOCK: 'open_block',
} as const;

export const OPEN_BLOCK_RESPONSE_TYPES = {
  INVITATION: 'invitation',
  RESPONSE: 'response',
} as const;

// ========================================
// HELPER FUNCTIONS
// ========================================

export const isOpenBlockRequest = (request: any): request is OpenBlockRequest => {
  return request.request_type === 'open_block';
};

export const isOpenBlockInvitation = (response: any): response is OpenBlockResponse => {
  return response.response_type === 'invitation' && response.block_time_id;
};

export const formatOpenBlockTime = (date: string, startTime: string, endTime: string): string => {
  const formattedDate = new Date(date).toLocaleDateString();
  return `${formattedDate} ${startTime} - ${endTime}`;
};

export const getOpenBlockStatusColor = (status: OpenBlockStatus): string => {
  switch (status) {
    case 'pending':
      return 'text-yellow-600 bg-yellow-100';
    case 'accepted':
      return 'text-green-600 bg-green-100';
    case 'expired':
      return 'text-gray-600 bg-gray-100';
    case 'declined':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

export const canAcceptOpenBlockInvitation = (invitation: OpenBlockInvitation): boolean => {
  return invitation.status === 'pending';
};

export const canDeclineOpenBlockInvitation = (invitation: OpenBlockInvitation): boolean => {
  return invitation.status === 'pending';
};

