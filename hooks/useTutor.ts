'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../app/lib/supabase';
import {
  Student,
  TutoringSession,
  TutoringSessionEnrollment,
  TutorGroupInvitation,
  TutorService,
  ActiveTutor,
  TutorStudent,
  TutorSession,
  ParentTutoringSession,
  CreateTutoringSessionForm,
  TutorProfileForm,
  TutorServiceForm,
  SendTutorInvitationForm,
  RespondToTutoringInvitationForm,
  RespondToTutorInvitationForm,
  TutorSearchFilters
} from '../types/tutor';

export function useTutor() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Get active tutors for marketplace
  const getActiveTutors = useCallback(async (filters?: TutorSearchFilters): Promise<ActiveTutor[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc('get_active_tutors');
      
      if (fetchError) {
        throw new Error(fetchError.message);
      }

      let tutors = data || [];

      // Apply filters if provided
      if (filters) {
        tutors = tutors.filter(tutor => {
          if (filters.subjects && filters.subjects.length > 0) {
            const hasMatchingSubject = filters.subjects.some(subject =>
              tutor.curricular_topics?.includes(subject)
            );
            if (!hasMatchingSubject) return false;
          }

          if (filters.zip_code && tutor.zip_code !== filters.zip_code) {
            return false;
          }

          return true;
        });
      }

      return tutors;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tutors';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get tutor's students
  const getTutorStudents = useCallback(async (tutorId: string): Promise<TutorStudent[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc('get_tutor_students', {
        p_tutor_id: tutorId
      });
      
      if (fetchError) {
        throw new Error(fetchError.message);
      }

      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch students';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get tutor's sessions
  const getTutorSessions = useCallback(async (
    tutorId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<TutorSession[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc('get_tutor_sessions', {
        p_tutor_id: tutorId,
        p_start_date: startDate?.toISOString().split('T')[0] || null,
        p_end_date: endDate?.toISOString().split('T')[0] || null
      });
      
      if (fetchError) {
        throw new Error(fetchError.message);
      }

      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sessions';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get parent's tutoring sessions
  const getParentTutoringSessions = useCallback(async (
    parentId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<ParentTutoringSession[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc('get_parent_tutoring_sessions', {
        p_parent_id: parentId,
        p_start_date: startDate?.toISOString().split('T')[0] || null,
        p_end_date: endDate?.toISOString().split('T')[0] || null
      });
      
      if (fetchError) {
        throw new Error(fetchError.message);
      }

      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tutoring sessions';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Create tutoring session
  const createTutoringSession = useCallback(async (
    tutorId: string,
    sessionData: CreateTutoringSessionForm
  ): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: createError } = await supabase.rpc('create_tutoring_session', {
        p_tutor_id: tutorId,
        p_session_type: sessionData.session_type,
        p_title: sessionData.title,
        p_description: sessionData.description || null,
        p_session_date: sessionData.session_date,
        p_start_time: sessionData.start_time,
        p_end_time: sessionData.end_time,
        p_max_students: sessionData.max_students,
        p_price_per_student: sessionData.price_per_student || null,
        p_location: sessionData.location || null,
        p_notes: sessionData.notes || null
      });
      
      if (createError) {
        throw new Error(createError.message);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Invite students to session
  const inviteStudentsToSession = useCallback(async (
    sessionId: string,
    studentIds: string[]
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: inviteError } = await supabase.rpc('invite_students_to_session', {
        p_session_id: sessionId,
        p_student_ids: studentIds
      });
      
      if (inviteError) {
        throw new Error(inviteError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to invite students';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Respond to tutoring session invitation
  const respondToTutoringInvitation = useCallback(async (
    enrollmentId: string,
    response: 'accepted' | 'declined',
    notes?: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: responseError } = await supabase.rpc('respond_to_tutoring_invitation', {
        p_enrollment_id: enrollmentId,
        p_response: response,
        p_notes: notes || null
      });
      
      if (responseError) {
        throw new Error(responseError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to respond to invitation';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Send tutor group invitation
  const sendTutorGroupInvitation = useCallback(async (
    tutorId: string,
    invitationData: SendTutorInvitationForm
  ): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: inviteError } = await supabase.rpc('send_tutor_group_invitation', {
        p_tutor_id: tutorId,
        p_parent_id: invitationData.parent_id,
        p_child_id: invitationData.child_id,
        p_message: invitationData.invitation_message || null
      });
      
      if (inviteError) {
        throw new Error(inviteError.message);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invitation';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Respond to tutor group invitation
  const respondToTutorInvitation = useCallback(async (
    invitationId: string,
    response: 'accepted' | 'declined',
    notes?: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: responseError } = await supabase.rpc('respond_to_tutor_invitation', {
        p_invitation_id: invitationId,
        p_response: response,
        p_notes: notes || null
      });
      
      if (responseError) {
        throw new Error(responseError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to respond to invitation';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update tutor profile
  const updateTutorProfile = useCallback(async (
    tutorId: string,
    profileData: TutorProfileForm
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          school: profileData.school || null,
          zip_code: profileData.zip_code || null,
          is_active: profileData.is_active,
          services_description: profileData.services_description || null,
          curricular_topics: profileData.curricular_topics || null
        })
        .eq('id', tutorId);
      
      if (updateError) {
        throw new Error(updateError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create tutor service
  const createTutorService = useCallback(async (
    tutorId: string,
    serviceData: TutorServiceForm
  ): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: createError } = await supabase
        .from('tutor_services')
        .insert({
          tutor_id: tutorId,
          service_name: serviceData.service_name,
          service_description: serviceData.service_description || null,
          subjects: serviceData.subjects,
          grade_levels: serviceData.grade_levels || null,
          session_types: serviceData.session_types,
          pricing_model: serviceData.pricing_model,
          base_price: serviceData.base_price || null,
          group_discount_percentage: serviceData.group_discount_percentage,
          max_group_size: serviceData.max_group_size
        })
        .select('id')
        .single();
      
      if (createError) {
        throw new Error(createError.message);
      }

      return data?.id || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create service';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get pending invitations for a parent
  const getPendingTutorInvitations = useCallback(async (parentId: string): Promise<TutorGroupInvitation[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('tutor_group_invitations')
        .select(`
          *,
          profiles!tutor_group_invitations_tutor_id_fkey(full_name),
          children!tutor_group_invitations_child_id_fkey(full_name)
        `)
        .eq('parent_id', parentId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (fetchError) {
        throw new Error(fetchError.message);
      }

      return data?.map(invitation => ({
        ...invitation,
        tutor_name: invitation.profiles?.full_name,
        child_name: invitation.children?.full_name
      })) || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch invitations';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get pending enrollments for a tutor
  const getPendingSessionEnrollments = useCallback(async (tutorId: string): Promise<TutoringSessionEnrollment[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('tutoring_session_enrollments')
        .select(`
          *,
          tutoring_sessions!inner(*),
          students!inner(*),
          profiles!tutoring_session_enrollments_parent_id_fkey(full_name)
        `)
        .eq('tutoring_sessions.tutor_id', tutorId)
        .eq('enrollment_status', 'pending')
        .order('enrollment_date', { ascending: false });
      
      if (fetchError) {
        throw new Error(fetchError.message);
      }

      return data?.map(enrollment => ({
        ...enrollment,
        session: enrollment.tutoring_sessions,
        student: enrollment.students,
        parent_name: enrollment.profiles?.full_name
      })) || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch enrollments';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getActiveTutors,
    getTutorStudents,
    getTutorSessions,
    getParentTutoringSessions,
    createTutoringSession,
    inviteStudentsToSession,
    respondToTutoringInvitation,
    sendTutorGroupInvitation,
    respondToTutorInvitation,
    updateTutorProfile,
    createTutorService,
    getPendingTutorInvitations,
    getPendingSessionEnrollments,
    clearError: () => setError(null)
  };
}
