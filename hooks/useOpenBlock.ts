import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  OpenBlockInvitationFormData, 
  CreateOpenBlockInvitationResponse,
  AcceptOpenBlockInvitationResponse,
  GetOpenBlockInvitationsResponse 
} from '@/types/open-block';

export const useOpenBlock = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOpenBlockInvitation = async (
    existingBlockId: string,
    formData: OpenBlockInvitationFormData
  ): Promise<CreateOpenBlockInvitationResponse> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Prepare the data for the database function
      const invitedParentIds = formData.invitedParents.map(p => p.id);
      const reciprocalDates = formData.reciprocalTimes.map(t => t.date);
      const reciprocalStartTimes = formData.reciprocalTimes.map(t => t.startTime);
      const reciprocalEndTimes = formData.reciprocalTimes.map(t => t.endTime);

      const { data, error: dbError } = await supabase.rpc('create_open_block_invitation', {
        p_existing_block_id: existingBlockId,
        p_inviting_parent_id: user.id,
        p_invited_parent_ids: invitedParentIds,
        p_reciprocal_dates: reciprocalDates,
        p_reciprocal_start_times: reciprocalStartTimes,
        p_reciprocal_end_times: reciprocalEndTimes,
        p_notes: formData.notes
      });

      if (dbError) {
        throw new Error(dbError.message);
      }

      return {
        data: data || [],
        error: null
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return {
        data: [],
        error: {
          message: errorMessage,
          details: err instanceof Error ? err.stack : undefined
        }
      };
    } finally {
      setLoading(false);
    }
  };

  const acceptOpenBlockInvitation = async (
    careResponseId: string,
    acceptedChildId: string
  ): Promise<AcceptOpenBlockInvitationResponse> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error: dbError } = await supabase.rpc('accept_open_block_invitation', {
        p_care_response_id: careResponseId,
        p_accepting_parent_id: user.id,
        p_accepted_child_id: acceptedChildId
      });

      if (dbError) {
        throw new Error(dbError.message);
      }

      return {
        data: data || false,
        error: null
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return {
        data: false,
        error: {
          message: errorMessage,
          details: err instanceof Error ? err.stack : undefined
        }
      };
    } finally {
      setLoading(false);
    }
  };

  const getOpenBlockInvitations = async (): Promise<GetOpenBlockInvitationsResponse> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error: dbError } = await supabase.rpc('get_open_block_invitations', {
        p_parent_id: user.id
      });

      if (dbError) {
        throw new Error(dbError.message);
      }

      return {
        data: data || [],
        error: null
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return {
        data: [],
        error: {
          message: errorMessage,
          details: err instanceof Error ? err.stack : undefined
        }
      };
    } finally {
      setLoading(false);
    }
  };

  const declineOpenBlockInvitation = async (careResponseId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error: dbError } = await supabase.rpc('decline_open_block_invitation', {
        p_care_response_id: careResponseId,
        p_declining_parent_id: user.id
      });

      if (dbError) {
        throw new Error(dbError.message);
      }

      return data || false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    loading,
    error,
    createOpenBlockInvitation,
    acceptOpenBlockInvitation,
    getOpenBlockInvitations,
    declineOpenBlockInvitation,
    clearError
  };
};


