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
      console.log('🚀 Starting reschedule request...');
      console.log('📋 Care Block ID:', careBlock.id);
      console.log('📅 New Date:', newDate);
      console.log('⏰ New Start Time:', newStartTime);
      console.log('⏰ New End Time:', newEndTime);
      console.log('📝 Reason:', reason);

      // Use the improved reschedule function
      const { data, error } = await supabase.rpc('initiate_improved_reschedule', {
        p_scheduled_care_id: careBlock.id,
        p_new_date: newDate,
        p_new_start_time: newStartTime,
        p_new_end_time: newEndTime,
        p_reschedule_reason: reason
      });

      console.log('🔍 RPC Call Result:');
      console.log('  - Error:', error);
      console.log('  - Data:', data);
      console.log('  - Data Type:', typeof data);
      console.log('  - Data Length:', data?.length);

      if (error) {
        console.error('❌ RPC Error:', error);
        throw error;
      }

      // The function returns a table with success, message, new_request_id, participating_parents
      if (!data || data.length === 0) {
        console.error('❌ No data returned from RPC call');
        throw new Error('No data returned from reschedule function');
      }

      const result = data[0];
      console.log('📊 Function Result:', result);
      console.log('✅ Success:', result.success);
      console.log('📝 Message:', result.message);
      console.log('🆔 New Request ID:', result.new_request_id);
      console.log('👥 Participating Parents:', result.participating_parents);

      if (!result.success) {
        console.error('❌ Function returned success=false:', result.message);
        throw new Error(result.message || 'Failed to initiate reschedule request');
      }

      console.log('✅ Reschedule request initiated successfully!');
      console.log('👥 Participating parents count:', result.participating_parents?.length || 0);
      
      // Log each participating parent
      if (result.participating_parents && Array.isArray(result.participating_parents)) {
        result.participating_parents.forEach((parent: any, index: number) => {
          console.log(`👤 Parent ${index + 1}:`, parent);
        });
      }

      // Verify care_responses were created
      console.log('🔍 Verifying care_responses were created...');
      const { data: careResponses, error: careResponsesError } = await supabase
        .from('care_responses')
        .select('*')
        .eq('request_id', result.new_request_id)
        .eq('action_type', 'reschedule_response');

      console.log('📋 Care Responses Check:');
      console.log('  - Error:', careResponsesError);
      console.log('  - Count:', careResponses?.length || 0);
      console.log('  - Responses:', careResponses);

      if (careResponsesError) {
        console.error('❌ Error checking care_responses:', careResponsesError);
      } else if (!careResponses || careResponses.length === 0) {
        console.error('❌ NO CARE_RESPONSES CREATED! Trying to create them from rescheduled blocks...');
        console.log('🔧 Request ID:', result.new_request_id);
        
        // Try to create care_responses from rescheduled blocks
        try {
          const { data: createResult, error: createError } = await supabase.rpc('create_care_responses_from_rescheduled_blocks', {
            p_reschedule_request_id: result.new_request_id
          });
          
          console.log('🔧 Create Care Responses Result:', createResult);
          console.log('🔧 Create Care Responses Error:', createError);
          
          if (createError) {
            console.error('❌ Failed to create care_responses from rescheduled blocks:', createError);
          } else if (createResult && createResult.length > 0 && createResult[0].success) {
            console.log('✅ Successfully created care_responses from rescheduled blocks:', createResult[0].care_responses_created);
          }
        } catch (createErr) {
          console.error('❌ Error calling create_care_responses_from_rescheduled_blocks:', createErr);
        }
      } else {
        console.log('✅ Care responses found:', careResponses.length);
        careResponses.forEach((response, index) => {
          console.log(`📝 Care Response ${index + 1}:`, {
            id: response.id,
            request_id: response.request_id,
            responder_id: response.responder_id,
            status: response.status,
            action_type: response.action_type
          });
        });
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
    <div className="fixed left-0 right-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ top: '145px', bottom: '90px', zIndex: 9999 }}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-full overflow-y-auto">
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
