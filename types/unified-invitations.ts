// Unified Invitation System Types
// Consolidates reciprocal care, open block, group invites, and messages

export type InvitationType = 'reciprocal' | 'open_block' | 'group_invite' | 'message';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export type InvitationPriority = 'high' | 'medium' | 'low';

export type InvitationAction = 'accept' | 'decline' | 'respond' | 'view' | 'reply';

// Base interface for all invitation types
export interface BaseInvitation {
  id: string;
  type: InvitationType;
  status: InvitationStatus;
  priority: InvitationPriority;
  title: string;
  description: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  group?: {
    id: string;
    name: string;
  };
  timestamp: Date;
  expiresAt?: Date;
  actions: InvitationAction[];
  metadata: Record<string, any>;
}

// Reciprocal Care Invitation
export interface ReciprocalInvitation extends BaseInvitation {
  type: 'reciprocal';
  careRequest: {
    id: string;
    careDate: string;
    startTime: string;
    endTime: string;
    childName: string;
    notes?: string;
  };
  reciprocalTime: {
    careDate: string;
    startTime: string;
    endTime: string;
    notes?: string;
  };
  actions: ['accept', 'decline', 'respond'];
  priority: 'high';
}

// Open Block Invitation
export interface OpenBlockInvitation extends BaseInvitation {
  type: 'open_block';
  careResponse: {
    id: string;
    blockTimeId: string;
    existingBlockId: string;
  };
  timeSlots: Array<{
    date: string;
    startTime: string;
    endTime: string;
    notes?: string;
  }>;
  actions: ['accept', 'decline'];
  priority: 'high';
}

// Group Invitation
export interface GroupInvitation extends BaseInvitation {
  type: 'group_invite';
  group: {
    id: string;
    name: string;
    description?: string;
    memberCount: number;
  };
  actions: ['accept', 'decline'];
  priority: 'medium';
}

// Direct Message
export interface MessageInvitation extends BaseInvitation {
  type: 'message';
  message: {
    id: string;
    content: string;
    messageType: 'care_request' | 'general' | 'notification';
    threadId?: string;
  };
  actions: ['reply', 'view'];
  priority: 'low';
}

// Union type for all invitation types
export type UnifiedInvitation = 
  | ReciprocalInvitation 
  | OpenBlockInvitation 
  | GroupInvitation 
  | MessageInvitation;

// Filter and sort options
export interface InvitationFilters {
  types?: InvitationType[];
  status?: InvitationStatus[];
  groups?: string[];
  priority?: InvitationPriority[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface InvitationSortOptions {
  field: 'timestamp' | 'priority' | 'sender' | 'group' | 'type';
  direction: 'asc' | 'desc';
}

// Response data for actions
export interface InvitationActionResponse {
  success: boolean;
  invitationId: string;
  newStatus?: InvitationStatus;
  message?: string;
  error?: string;
}
