'use client';

import { useState } from 'react';
import { supabase } from '../../app/lib/supabase';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  careBlock: {
    id: string;
    group_id: string;
    care_date: string;
    start_time: string;
    end_time: string;
    related_request_id: string;
    group_name: string;
    children: Array<{ id: string; full_name: string }>;
  };
  onRescheduleSuccess: () => void;
}

export default function RescheduleModal({
  isOpen,
  onClose,
  careBlock,
  onRescheduleSuccess
}: RescheduleModalProps) {
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newStartTime || !newEndTime || !reason) {
      setError('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Use the new initiate_reschedule_request_by_block_id function
      const { data, error } = await supabase.rpc('initiate_reschedule_request_by_block_id', {
        p_scheduled_care_id: careBlock.id,
        p_new_date: newDate,
        p_new_start_time: newStartTime,
        p_new_end_time: newEndTime,
        p_reschedule_reason: reason
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to initiate reschedule request');
      }

      console.log('Reschedule request initiated successfully:', data);

      // Send reschedule request notifications using the same system as open block requests
      if (data.participating_parents && data.participating_parents.length > 0) {
        try {
          const { error: notificationError } = await supabase.rpc('send_reschedule_request_notifications', {
            p_reschedule_request_id: data.reschedule_request_id,
            p_requester_id: data.requester_id,
            p_participating_parents: data.participating_parents
      });

      if (notificationError) {
            console.warn('Failed to send reschedule notifications:', notificationError);
          } else {
            console.log('Reschedule notifications sent successfully to', data.participating_parents.length, 'parents');
          }

          // Create care_responses records for all participating parents
          if (data.participating_parents && data.participating_parents.length > 0) {
            try {
              const careResponses = data.participating_parents.map((parentId: string) => ({
                request_id: data.reschedule_request_id,
                responder_id: parentId,
                response_type: 'pending',
                action_type: 'reschedule_response',
                status: 'pending',
                response_notes: 'Pending reschedule response',
                created_at: new Date().toISOString()
              }));

              const { error: responsesError } = await supabase
                .from('care_responses')
                .insert(careResponses);

              if (responsesError) {
                console.warn('Failed to create care responses:', responsesError);
              } else {
                console.log(`Created ${careResponses.length} care responses for participating parents`);
              }
            } catch (responsesErr) {
              console.warn('Error creating care responses:', responsesErr);
            }
          }
        } catch (notificationErr) {
          console.warn('Error creating notifications:', notificationErr);
        }
      }

      onRescheduleSuccess();
      onClose();
      
    } catch (err) {
      console.error('Error creating reschedule request:', err);
      setError('Failed to create reschedule request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Reschedule Care Block</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Current Schedule</h3>
          <p className="text-sm text-gray-600">
            <strong>Group:</strong> {careBlock.group_name}<br />
            <strong>Date:</strong> {new Date(careBlock.care_date + 'T00:00:00').toLocaleDateString()}<br />
            <strong>Time:</strong> {careBlock.start_time} - {careBlock.end_time}<br />
            <strong>Children:</strong> {careBlock.children && careBlock.children.length > 0 
              ? careBlock.children.map(c => c.full_name).join(', ')
              : 'No children assigned'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newDate" className="block text-sm font-medium text-gray-700 mb-1">
              New Date
            </label>
            <input
              type="date"
              id="newDate"
              value={newDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="newStartTime" className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                id="newStartTime"
                value={newStartTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="newEndTime" className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                id="newEndTime"
                value={newEndTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Reschedule
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Please explain why you need to reschedule..."
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Reschedule Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
