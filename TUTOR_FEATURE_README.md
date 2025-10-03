# Tutor Feature Implementation

This document outlines the comprehensive Tutor functionality that has been added to the SitterApp, expanding it from a parent-focused care coordination app to include professional tutoring services.

## Overview

The Tutor feature adds a new user role (`tutor`) alongside the existing `parent` role, enabling tutors to:
- Manage their student roster
- Create and schedule tutoring sessions (individual and group)
- Display their services in a marketplace
- Integrate with the existing calendar and chat systems
- Send invitations to parents to join their student groups

## Database Changes

### New Tables

#### 1. `students` Table
- Links tutors to children through parent relationships
- Stores student-specific information (grade level, subjects, notes)
- Maintains status tracking (active, inactive, graduated)

#### 2. `tutoring_sessions` Table
- Stores individual and group tutoring sessions
- Includes scheduling, pricing, and capacity management
- Supports both in-person and virtual sessions

#### 3. `tutoring_session_enrollments` Table
- Manages student enrollments in sessions
- Tracks invitation responses (pending, accepted, declined)
- Links students, parents, and sessions

#### 4. `tutor_group_invitations` Table
- Handles invitations from tutors to parents
- Manages the process of adding new students to tutor groups

#### 5. `tutor_services` Table
- Stores detailed service offerings for marketplace display
- Includes pricing models, subjects, and grade levels

### Profile Table Extensions

The existing `profiles` table has been extended with:
- `role`: User role ('parent' or 'tutor')
- `school`: School name for tutors
- `zip_code`: Location for search functionality
- `is_active`: Whether the tutor is accepting students
- `services_description`: General description of services
- `curricular_topics`: Array of subjects covered

## API Functions

### Core Functions

1. **`get_active_tutors()`** - Retrieves active tutors for marketplace
2. **`get_tutor_students(tutor_id)`** - Gets students for a specific tutor
3. **`get_tutor_sessions(tutor_id, start_date, end_date)`** - Retrieves tutor's sessions
4. **`get_parent_tutoring_sessions(parent_id, start_date, end_date)`** - Gets parent's tutoring sessions
5. **`create_tutoring_session(...)`** - Creates new tutoring sessions
6. **`invite_students_to_session(session_id, student_ids)`** - Invites students to sessions
7. **`respond_to_tutoring_invitation(...)`** - Handles session invitation responses
8. **`send_tutor_group_invitation(...)`** - Sends invitations to join tutor groups
9. **`respond_to_tutor_invitation(...)`** - Handles group invitation responses

### Security Features

- **Row Level Security (RLS)** enabled on all new tables
- **Comprehensive policies** ensuring data isolation between users
- **Function-level security** with proper authentication checks
- **Data validation** at the database level

## Frontend Components

### 1. Tutor Dashboard (`/tutor-dashboard`)
- **Overview Tab**: Statistics and recent activity
- **Students Tab**: Student management and roster
- **Sessions Tab**: Session scheduling and management
- **Profile Tab**: Service configuration and settings
- **Invitations Tab**: Pending parent invitations

### 2. Custom Hook (`useTutor`)
- Centralized state management for tutor functionality
- API integration with error handling
- Loading states and data fetching

### 3. TypeScript Types
- Comprehensive type definitions for all tutor entities
- Form interfaces for data input
- API response types

## User Workflows

### For Tutors

1. **Profile Setup**
   - Set school and location
   - Describe services and subjects
   - Set active status

2. **Student Management**
   - Send invitations to parents
   - Manage student roster
   - Track student progress

3. **Session Management**
   - Create individual or group sessions
   - Set pricing and capacity
   - Invite students to sessions
   - Track attendance and status

### For Parents

1. **Tutor Discovery**
   - Browse active tutors in marketplace
   - Filter by subjects, location, and pricing
   - View tutor profiles and services

2. **Group Membership**
   - Receive and respond to tutor invitations
   - Join tutor student groups
   - Manage child's tutoring schedule

3. **Session Participation**
   - Receive session invitations
   - Accept/decline session requests
   - Track child's tutoring progress

## Integration Points

### Calendar System
- Tutoring sessions appear in both tutor and parent calendars
- Color-coded by session type and status
- Integrated with existing scheduling logic

### Chat System
- Individual chat channels for tutor-parent communication
- Group chat channels for session participants
- Notification system for invitations and updates

### Marketplace Integration
- Tutors appear in Bites/Coaching page when active
- Search and filter functionality
- Service discovery and comparison

## Security Considerations

### Data Isolation
- Tutors can only see their own students and sessions
- Parents can only see their children's tutoring data
- Proper RLS policies prevent data leakage

### Authentication
- All functions require authenticated users
- Role-based access control
- Function-level security checks

### Validation
- Input validation at database level
- Business logic validation in functions
- Constraint checking for data integrity

## Performance Features

### Indexing
- Strategic indexes on frequently queried columns
- GIN indexes for array fields (subjects, topics)
- Composite indexes for common query patterns

### Query Optimization
- Efficient joins and filtering
- Pagination support for large datasets
- Caching-friendly data structures

## Future Enhancements

### Planned Features
1. **Payment Integration** - Stripe/PayPal for session payments
2. **Video Conferencing** - Zoom/Teams integration
3. **Progress Tracking** - Student performance metrics
4. **Automated Scheduling** - AI-powered session optimization
5. **Mobile App** - Native mobile experience

### Scalability Considerations
- Database partitioning for large datasets
- Caching layer for marketplace data
- CDN integration for media content
- Microservices architecture for core functions

## Testing Strategy

### Database Testing
- Function unit tests
- Constraint validation tests
- Performance benchmarks
- Security policy tests

### Frontend Testing
- Component unit tests
- Integration tests for user workflows
- E2E tests for critical paths
- Accessibility testing

## Deployment Notes

### Migration
- Run the migration file: `20250115000013_add_tutor_role_and_functionality.sql`
- Update existing user profiles to set default role as 'parent'
- Test all functions with sample data

### Configuration
- Ensure RLS is enabled on new tables
- Verify function permissions are properly set
- Check index creation and performance

### Monitoring
- Monitor function performance
- Track user adoption metrics
- Monitor for security issues
- Performance monitoring for large datasets

## Support and Maintenance

### Common Issues
1. **Permission Denied**: Check RLS policies and user authentication
2. **Function Errors**: Verify function parameters and database state
3. **Performance Issues**: Check indexes and query optimization

### Maintenance Tasks
- Regular index maintenance
- Function performance monitoring
- Security policy reviews
- Data cleanup for inactive users

## Conclusion

The Tutor feature significantly expands the SitterApp's capabilities, transforming it from a care coordination platform to a comprehensive educational services marketplace. The implementation follows modern best practices for security, performance, and user experience, while maintaining seamless integration with existing functionality.

This feature opens new revenue opportunities and user engagement possibilities, positioning the app as a comprehensive solution for both family care coordination and educational services.
