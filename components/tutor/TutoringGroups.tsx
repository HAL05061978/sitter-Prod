'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../app/lib/supabase';
import { TutorStudent, TutoringSession } from '../../types/tutor';

interface TutoringGroup {
  id: string;
  name: string;
  description?: string;
  student_ids: string[];
  created_at: string;
  updated_at: string;
}

interface CreateGroupForm {
  name: string;
  description: string;
  selectedStudentIds: string[];
}

export default function TutoringGroups({ tutorId }: { tutorId: string }) {
  const [groups, setGroups] = useState<TutoringGroup[]>([]);
  const [students, setStudents] = useState<TutorStudent[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateGroupForm>({
    name: '',
    description: '',
    selectedStudentIds: []
  });

  useEffect(() => {
    if (tutorId) {
      loadGroups();
      loadStudents();
    }
  }, [tutorId]);

  const loadGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('tutoring_groups')
        .select('*')
        .eq('tutor_id', tutorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          profiles!students_parent_id_fkey(full_name),
          children!students_child_id_fkey(full_name)
        `)
        .eq('tutor_id', tutorId)
        .eq('status', 'active')
        .order('first_name');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || formData.selectedStudentIds.length === 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tutoring_groups')
        .insert({
          tutor_id: tutorId,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          student_ids: formData.selectedStudentIds
        })
        .select()
        .single();

      if (error) throw error;

      setGroups([data, ...groups]);
      setFormData({ name: '', description: '', selectedStudentIds: [] });
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentToggle = (studentId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedStudentIds: prev.selectedStudentIds.includes(studentId)
        ? prev.selectedStudentIds.filter(id => id !== studentId)
        : [...prev.selectedStudentIds, studentId]
    }));
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;

    try {
      const { error } = await supabase
        .from('tutoring_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;
      setGroups(groups.filter(g => g.id !== groupId));
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Tutoring Groups</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancel' : 'Create Group'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Group</h3>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Group Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="Enter group name"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Description (Optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="Enter group description"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Students ({formData.selectedStudentIds.length} selected)
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                {students.map((student) => (
                  <label key={student.student_id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.selectedStudentIds.includes(student.student_id)}
                      onChange={() => handleStudentToggle(student.student_id)}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm">
                      {student.first_name} {student.last_name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name.trim() || formData.selectedStudentIds.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {groups.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No groups created yet.</p>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900">{group.name}</h3>
                  {group.description && (
                    <p className="text-gray-600 mt-1">{group.description}</p>
                  )}
                  <div className="mt-3">
                    <span className="text-sm text-gray-500">
                      {group.student_ids.length} student{group.student_ids.length !== 1 ? 's' : ''}
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {students
                        .filter(student => group.student_ids.includes(student.student_id))
                        .map(student => (
                          <span
                            key={student.student_id}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {student.first_name} {student.last_name}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
