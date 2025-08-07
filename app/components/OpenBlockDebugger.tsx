'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface OpenBlockDebuggerProps {
  onClose: () => void;
}

export default function OpenBlockDebugger({ onClose }: OpenBlockDebuggerProps) {
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addLog = (message: string) => {
    setDebugLog(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const clearLog = () => {
    setDebugLog([]);
  };

  const testOpenBlockAcceptance = async () => {
    setIsLoading(true);
    addLog('=== Starting Open Block Acceptance Test ===');

    try {
      // 1. Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        addLog(`Error getting user: ${userError?.message}`);
        return;
      }
      addLog(`Current user: ${user.id}`);

      // 2. Find active invitations
      const { data: invitations, error: inviteError } = await supabase
        .from('open_block_invitations')
        .select('*')
        .eq('status', 'active')
        .limit(5);

      if (inviteError) {
        addLog(`Error fetching invitations: ${inviteError.message}`);
        return;
      }

      addLog(`Found ${invitations?.length || 0} active invitations`);

      if (!invitations || invitations.length === 0) {
        addLog('No active invitations found. Create some invitations first.');
        return;
      }

      // 3. Get user's children
      const { data: children, error: childrenError } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', user.id);

      if (childrenError) {
        addLog(`Error fetching children: ${childrenError.message}`);
        return;
      }

      addLog(`Found ${children?.length || 0} children for current user`);

      if (!children || children.length === 0) {
        addLog('No children found for current user.');
        return;
      }

      // 4. Find an invitation that the current user can accept
      const availableInvitation = invitations.find(inv => inv.invited_parent_id === user.id);
      
      if (!availableInvitation) {
        addLog('No invitations available for current user.');
        return;
      }

      addLog(`Found available invitation: ${availableInvitation.id}`);

      // 5. Check if user already responded
      const { data: existingResponse, error: responseError } = await supabase
        .from('open_block_responses')
        .select('*')
        .eq('invitation_id', availableInvitation.id)
        .eq('parent_id', user.id)
        .single();

      if (responseError && responseError.code !== 'PGRST116') {
        addLog(`Error checking existing response: ${responseError.message}`);
        return;
      }

      if (existingResponse) {
        addLog(`User already responded to this invitation: ${existingResponse.response}`);
        return;
      }

      // 6. Create test response
      const { data: response, error: createError } = await supabase
        .from('open_block_responses')
        .insert({
          invitation_id: availableInvitation.id,
          parent_id: user.id,
          response: 'accept',
          child_id: children[0].id,
          notes: 'Test acceptance from debugger'
        })
        .select()
        .single();

      if (createError) {
        addLog(`Error creating response: ${createError.message}`);
        return;
      }

      addLog(`Created response: ${response.id}`);

      // 7. Wait a moment for trigger to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 8. Check if invitation status was updated
      const { data: updatedInvitation, error: updateError } = await supabase
        .from('open_block_invitations')
        .select('*')
        .eq('id', availableInvitation.id)
        .single();

      if (updateError) {
        addLog(`Error checking updated invitation: ${updateError.message}`);
        return;
      }

      addLog(`Invitation status after response: ${updatedInvitation.status}`);
      addLog(`Accepted parent ID: ${updatedInvitation.accepted_parent_id}`);

      // 9. Check if scheduled_care_children was created
      const { data: careChildren, error: careError } = await supabase
        .from('scheduled_care_children')
        .select('*')
        .like('notes', '%Open block acceptance%')
        .order('created_at', { ascending: false })
        .limit(5);

      if (careError) {
        addLog(`Error checking scheduled_care_children: ${careError.message}`);
        return;
      }

      addLog(`Found ${careChildren?.length || 0} care children entries`);

      // 10. Check if reciprocal care block was created
      const { data: reciprocalBlocks, error: blockError } = await supabase
        .from('scheduled_care')
        .select('*')
        .like('notes', '%Open block acceptance%')
        .order('created_at', { ascending: false })
        .limit(5);

      if (blockError) {
        addLog(`Error checking reciprocal blocks: ${blockError.message}`);
        return;
      }

      addLog(`Found ${reciprocalBlocks?.length || 0} reciprocal care blocks`);

      addLog('=== Test completed successfully ===');

    } catch (error) {
      addLog(`Unexpected error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Open Block Debugger</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            onClick={testOpenBlockAcceptance}
            disabled={isLoading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Testing...' : 'Test Open Block Acceptance'}
          </button>
          <button
            onClick={clearLog}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Clear Log
          </button>
        </div>

        <div className="bg-gray-100 p-4 rounded max-h-96 overflow-y-auto">
          <h3 className="font-semibold mb-2">Debug Log:</h3>
          {debugLog.length === 0 ? (
            <p className="text-gray-500">No logs yet. Click "Test Open Block Acceptance" to start.</p>
          ) : (
            <pre className="text-sm whitespace-pre-wrap">
              {debugLog.join('\n')}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
