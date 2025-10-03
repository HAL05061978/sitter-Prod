import { supabase } from './supabase';
import { 
  UnifiedInvitation, 
  ReciprocalInvitation, 
  OpenBlockInvitation, 
  GroupInvitation, 
  MessageInvitation,
  InvitationFilters,
  InvitationSortOptions 
} from '@/types/unified-invitations';

export class UnifiedInvitationsService {
  
  /**
   * Fetch all invitations for the current user
   * Aggregates data from existing Supabase functions without modifying them
   */
  static async fetchAllInvitations(userId: string): Promise<UnifiedInvitation[]> {
    try {
      const [reciprocalInvitations, openBlockInvitations, groupInvitations, messages] = await Promise.all([
        this.fetchReciprocalInvitations(userId),
        this.fetchOpenBlockInvitations(userId),
        this.fetchGroupInvitations(userId),
        this.fetchMessages(userId)
      ]);

      // Combine all invitations
      const allInvitations = [
        ...reciprocalInvitations,
        ...openBlockInvitations,
        ...groupInvitations,
        ...messages
      ];

      // Sort by priority and timestamp
      return this.sortInvitations(allInvitations);
    } catch (error) {
      console.error('Error fetching all invitations:', error);
      return [];
    }
  }

  /**
   * Fetch reciprocal care invitations using existing function
   */
  private static async fetchReciprocalInvitations(userId: string): Promise<ReciprocalInvitation[]> {
    try {
      // Query care_responses where user is invited and status is pending
      const { data: responses, error } = await supabase
        .from('care_responses')
        .select(`
          id,
          care_requests!inner(
            id,
            group_id,
            requester_id,
            child_id,
            requested_date,
            start_time,
            end_time,
            notes,
            reciprocal_date,
            reciprocal_start_time,
            reciprocal_end_time,
            profiles!inner(id, full_name),
            children!inner(id, full_name),
            groups!inner(id, name)
          )
        `)
        .eq('responder_id', userId)
        .eq('status', 'pending')
        .eq('care_requests.request_type', 'reciprocal');

      if (error) throw error;

      return (responses || []).map(response => {
        const request = response.care_requests;
        const requester = request.profiles;
        const child = request.children;
        const group = request.groups;

        return {
          id: response.id,
          type: 'reciprocal' as const,
          status: 'pending' as const,
          priority: 'high' as const,
          title: `Reciprocal Care Request from ${requester.full_name}`,
          description: `Request for care on ${request.requested_date} from ${request.start_time} to ${request.end_time}`,
          sender: {
            id: requester.id,
            name: requester.full_name
          },
          group: {
            id: group.id,
            name: group.name
          },
          timestamp: new Date(request.created_at || Date.now()),
          actions: ['accept', 'decline', 'respond'],
          metadata: {
            careRequestId: request.id,
            responseId: response.id
          },
          careRequest: {
            id: request.id,
            careDate: request.requested_date,
            startTime: request.start_time,
            endTime: request.end_time,
            childName: child.full_name,
            notes: request.notes
          },
          reciprocalTime: {
            careDate: request.reciprocal_date,
            startTime: request.reciprocal_start_time,
            endTime: request.reciprocal_end_time,
            notes: request.notes
          }
        };
      });
    } catch (error) {
      console.error('Error fetching reciprocal invitations:', error);
      return [];
    }
  }

  /**
   * Fetch open block invitations using existing function
   */
  private static async fetchOpenBlockInvitations(userId: string): Promise<OpenBlockInvitation[]> {
    try {
      // Use existing get_open_block_invitations function
      const { data: invitations, error } = await supabase.rpc('get_open_block_invitations', {
        p_parent_id: userId
      });

      if (error) throw error;

      return (invitations || []).map(invitation => ({
        id: invitation.care_response_id,
        type: 'open_block' as const,
        status: 'pending' as const,
        priority: 'high' as const,
        title: `Open Block Invitation from ${invitation.inviting_parent_name}`,
        description: `Invitation to join care block on ${invitation.requested_date}`,
        sender: {
          id: invitation.inviting_parent_id,
          name: invitation.inviting_parent_name
        },
        group: {
          id: invitation.group_id,
          name: invitation.group_name
        },
        timestamp: new Date(invitation.created_at || Date.now()),
        actions: ['accept', 'decline'],
        metadata: {
          careResponseId: invitation.care_response_id,
          blockTimeId: invitation.block_time_id,
          existingBlockId: invitation.existing_block_id
        },
        careResponse: {
          id: invitation.care_response_id,
          blockTimeId: invitation.block_time_id,
          existingBlockId: invitation.existing_block_id
        },
        timeSlots: [{
          date: invitation.requested_date,
          startTime: invitation.start_time,
          endTime: invitation.end_time,
          notes: invitation.notes
        }]
      }));
    } catch (error) {
      console.error('Error fetching open block invitations:', error);
      return [];
    }
  }

  /**
   * Fetch group invitations using existing table structure
   */
  private static async fetchGroupInvitations(userId: string): Promise<GroupInvitation[]> {
    try {
      // Query group_invites table
      const { data: invites, error } = await supabase
        .from('group_invites')
        .select(`
          id,
          group_id,
          email,
          status,
          created_at,
          groups!inner(id, name, description)
        `)
        .eq('email', userId) // This might need adjustment based on actual structure
        .eq('status', 'pending');

      if (error) throw error;

      return (invites || []).map(invite => ({
        id: invite.id,
        type: 'group_invite' as const,
        status: 'pending' as const,
        priority: 'medium' as const,
        title: `Group Invitation to ${invite.groups.name}`,
        description: `You've been invited to join the ${invite.groups.name} group`,
        sender: {
          id: 'system', // Group invites are system-generated
          name: 'System'
        },
        group: {
          id: invite.groups.id,
          name: invite.groups.name,
          description: invite.groups.description,
          memberCount: 0 // Would need additional query to get actual count
        },
        timestamp: new Date(invite.created_at),
        actions: ['accept', 'decline'],
        metadata: {
          inviteId: invite.id,
          groupId: invite.groups.id
        }
      }));
    } catch (error) {
      console.error('Error fetching group invitations:', error);
      return [];
    }
  }

  /**
   * Fetch messages using existing table structure
   */
  private static async fetchMessages(userId: string): Promise<MessageInvitation[]> {
    try {
      // Query messages table for unread messages
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          recipient_id,
          content,
          message_type,
          thread_id,
          created_at,
          read_at,
          profiles!inner(id, full_name)
        `)
        .eq('recipient_id', userId)
        .is('read_at', null) // Unread messages
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (messages || []).map(message => ({
        id: message.id,
        type: 'message' as const,
        status: 'pending' as const,
        priority: 'low' as const,
        title: `Message from ${message.profiles.full_name}`,
        description: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
        sender: {
          id: message.sender_id,
          name: message.profiles.full_name
        },
        timestamp: new Date(message.created_at),
        actions: ['reply', 'view'],
        metadata: {
          messageId: message.id,
          threadId: message.thread_id,
          messageType: message.message_type
        },
        message: {
          id: message.id,
          content: message.content,
          messageType: message.message_type as any,
          threadId: message.thread_id
        }
      }));
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  /**
   * Sort invitations by priority and timestamp
   */
  private static sortInvitations(invitations: UnifiedInvitation[]): UnifiedInvitation[] {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    
    return invitations.sort((a, b) => {
      // First sort by priority
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then sort by timestamp (newest first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }

  /**
   * Filter invitations based on criteria
   */
  static filterInvitations(
    invitations: UnifiedInvitation[], 
    filters: InvitationFilters
  ): UnifiedInvitation[] {
    return invitations.filter(invitation => {
      if (filters.types && !filters.types.includes(invitation.type)) return false;
      if (filters.status && !filters.status.includes(invitation.status)) return false;
      if (filters.groups && invitation.group && !filters.groups.includes(invitation.group.id)) return false;
      if (filters.priority && !filters.priority.includes(invitation.priority)) return false;
      if (filters.dateRange) {
        const timestamp = new Date(invitation.timestamp);
        if (timestamp < filters.dateRange.start || timestamp > filters.dateRange.end) return false;
      }
      return true;
    });
  }

  /**
   * Get invitation counts by type and status
   */
  static getInvitationCounts(invitations: UnifiedInvitation[]) {
    const counts = {
      total: invitations.length,
      byType: {
        reciprocal: 0,
        open_block: 0,
        group_invite: 0,
        message: 0
      },
      byStatus: {
        pending: 0,
        accepted: 0,
        declined: 0,
        expired: 0
      },
      byPriority: {
        high: 0,
        medium: 0,
        low: 0
      }
    };

    invitations.forEach(invitation => {
      counts.byType[invitation.type]++;
      counts.byStatus[invitation.status]++;
      counts.byPriority[invitation.priority]++;
    });

    return counts;
  }
}

