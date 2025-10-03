// Tutor-related TypeScript types

export interface CurricularTopic {
  id: string;
  name: string;
  category: 'STEM' | 'Humanities' | 'Arts' | 'Languages' | 'Social Sciences' | 'Physical Education' | 'Other';
  grade_levels: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TutorTopic {
  id: string;
  tutor_id: string;
  topic_id: string;
  created_at: string;
  
  // Joined data
  topic?: CurricularTopic;
}

export interface TutorProfile extends BaseProfile {
  role: 'tutor';
  school?: string;
  zip_code?: string;
  is_active: boolean;
  services_description?: string;
  // curricular_topics is now handled through the tutor_topics junction table
}

export interface BaseProfile {
  id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  website?: string;
  updated_at?: string;
}

export interface Student {
  id: string;
  tutor_id: string;
  parent_id: string;
  child_id: string;
  first_name: string;
  last_name: string;
  grade_level?: string;
  subjects?: string[];
  notes?: string;
  status: 'active' | 'inactive' | 'graduated';
  created_at: string;
  updated_at: string;
  
  // Joined data
  parent_name?: string;
  child_name?: string;
}

export interface TutoringSession {
  id: string;
  tutor_id: string;
  session_type: 'individual' | 'group';
  title: string;
  description?: string;
  session_date: string;
  start_time: string;
  end_time: string;
  max_students: number;
  current_students: number;
  price_per_student?: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  location?: string;
  meeting_link?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  
  // Joined data
  enrollment_count?: number;
}

export interface TutoringSessionEnrollment {
  id: string;
  session_id: string;
  student_id: string;
  parent_id: string;
  enrollment_status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  enrollment_date: string;
  response_notes?: string;
  response_date?: string;
  
  // Joined data
  session?: TutoringSession;
  student?: Student;
  parent_name?: string;
}

export interface TutorGroupInvitation {
  id: string;
  tutor_id: string;
  parent_id: string;
  child_id: string;
  invitation_message?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at?: string;
  response_notes?: string;
  
  // Joined data
  tutor_name?: string;
  parent_name?: string;
  child_name?: string;
}

export interface TutorService {
  id: string;
  tutor_id: string;
  service_name: string;
  service_description?: string;
  subjects: string[];
  grade_levels?: string[];
  session_types: string[];
  pricing_model: 'per_session' | 'per_hour' | 'package';
  base_price?: number;
  group_discount_percentage: number;
  max_group_size: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// API Response types
export interface ActiveTutor {
  tutor_id: string;
  full_name: string;
  school?: string;
  zip_code?: string;
  services_description?: string;
  curricular_topics?: CurricularTopic[];
  service_count: number;
}

export interface TutorStudent {
  student_id: string;
  first_name: string;
  last_name: string;
  grade_level?: string;
  subjects?: string[];
  parent_name: string;
  child_name: string;
  status: string;
}

export interface TutorSession {
  session_id: string;
  session_type: string;
  title: string;
  description?: string;
  session_date: string;
  start_time: string;
  end_time: string;
  max_students: number;
  current_students: number;
  status: string;
  enrollment_count: number;
}

export interface ParentTutoringSession {
  session_id: string;
  session_type: string;
  title: string;
  session_date: string;
  start_time: string;
  end_time: string;
  tutor_name: string;
  child_name: string;
  enrollment_status: string;
  session_status: string;
}

// Form types
export interface CreateTutoringSessionForm {
  session_type: 'individual' | 'group';
  title: string;
  description?: string;
  session_date: string;
  start_time: string;
  end_time: string;
  max_students: number;
  price_per_student?: number;
  location?: string;
  notes?: string;
}

export interface TutorProfileForm {
  school?: string;
  zip_code?: string;
  is_active: boolean;
  services_description?: string;
  curricular_topic_ids?: string[];
}

export interface TutorServiceForm {
  service_name: string;
  service_description?: string;
  subjects: string[];
  grade_levels?: string[];
  session_types: string[];
  pricing_model: 'per_session' | 'per_hour' | 'package';
  base_price?: number;
  group_discount_percentage: number;
  max_group_size: number;
}

export interface SendTutorInvitationForm {
  parent_id: string;
  child_id: string;
  invitation_message?: string;
}

export interface RespondToTutoringInvitationForm {
  enrollment_id: string;
  response: 'accepted' | 'declined';
  notes?: string;
}

export interface RespondToTutorInvitationForm {
  invitation_id: string;
  response: 'accepted' | 'declined';
  notes?: string;
}

// Filter and search types
export interface TutorSearchFilters {
  subjects?: string[];
  grade_levels?: string[];
  zip_code?: string;
  session_types?: string[];
  max_price?: number;
  min_price?: number;
}

// Calendar integration types
export interface TutoringSessionCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: 'tutoring_session';
  session: TutoringSession;
  students?: Student[];
}

// Chat integration types
export interface TutorChatChannel {
  id: string;
  type: 'individual' | 'group';
  tutor_id: string;
  parent_id?: string;
  student_id?: string;
  session_id?: string;
  created_at: string;
  
  // Joined data
  tutor_name?: string;
  parent_name?: string;
  student_name?: string;
  session_title?: string;
}

// Dashboard types
export interface TutorDashboardStats {
  total_students: number;
  active_students: number;
  total_sessions: number;
  upcoming_sessions: number;
  completed_sessions: number;
  total_earnings: number;
  pending_invitations: number;
}

export interface ParentDashboardStats {
  total_tutoring_sessions: number;
  active_tutoring_sessions: number;
  completed_tutoring_sessions: number;
  pending_invitations: number;
  total_tutors: number;
}
