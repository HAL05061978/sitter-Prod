'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Inbox, CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OpenBlockInvitation, OpenBlockAcceptanceFormData } from '@/types/open-block';
import { useOpenBlock } from '@/hooks/useOpenBlock';
import OpenBlockInvitationCard from './OpenBlockInvitationCard';
import OpenBlockAcceptanceForm from './OpenBlockAcceptanceForm';

export default function OpenBlockInvitationsList() {
  const [invitations, setInvitations] = useState<OpenBlockInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingInvitation, setAcceptingInvitation] = useState<OpenBlockInvitation | null>(null);
  const [availableChildren, setAvailableChildren] = useState<Array<{ id: string; name: string }>>([]);
  
  const { acceptOpenBlockInvitation, declineOpenBlockInvitation, loading: hookLoading, error: hookError } = useOpenBlock();

  const processing = hookLoading;

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        return;
      }

      // Call the Supabase function to get open block invitations
      const { data, error } = await supabase.rpc('get_open_block_invitations', {
        p_parent_id: user.id
      });

      if (error) {
        console.error('Error fetching invitations:', error);
        return;
      }

      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitation: OpenBlockInvitation) => {
    try {
      // Fetch available children for the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: childrenData, error: childrenError } = await supabase
        .from('children')
        .select('id, name')
        .eq('parent_id', user.id)
        .eq('status', 'active');

      if (childrenError) throw childrenError;

      setAvailableChildren(childrenData || []);
      setAcceptingInvitation(invitation);
    } catch (error) {
      console.error('Error preparing acceptance:', error);
      alert('Error preparing acceptance. Please try again.');
    }
  };

  const handleAcceptanceSubmit = async (data: OpenBlockAcceptanceFormData) => {
    if (!acceptingInvitation) return;

    try {
      const result = await acceptOpenBlockInvitation(
        acceptingInvitation.care_response_id,
        data.acceptedChildId
      );

      if (result.error) {
        throw new Error(result.error.message);
      }

      // Success! Refresh the invitations list
      await fetchInvitations();
      setAcceptingInvitation(null);
      
      alert('Invitation accepted successfully! Your child has been added to the care block.');
    } catch (error) {
      console.error('Error accepting invitation:', error);
      alert('Error accepting invitation. Please try again.');
    }
  };

  const handleDecline = async (invitation: OpenBlockInvitation) => {
    if (!confirm('Are you sure you want to decline this invitation?')) return;

    try {
      const success = await declineOpenBlockInvitation(invitation.care_response_id);

      if (success) {
        // Refresh the invitations list
        await fetchInvitations();
        alert('Invitation declined successfully.');
      } else {
        alert('Failed to decline invitation. Please try again.');
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
      alert('Error declining invitation. Please try again.');
    }
  };

  const handleCancelAcceptance = () => {
    setAcceptingInvitation(null);
    setAvailableChildren([]);
  };

  const getStatusCounts = () => {
    const counts = {
      pending: 0,
      accepted: 0,
      expired: 0,
      declined: 0
    };

    invitations.forEach(invitation => {
      counts[invitation.status as keyof typeof counts]++;
    });

    return counts;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading open block invitations...</p>
        </div>
      </div>
    );
  }

  if (acceptingInvitation) {
    return (
      <OpenBlockAcceptanceForm
        invitation={acceptingInvitation}
        availableChildren={availableChildren}
        onSubmit={handleAcceptanceSubmit}
        onCancel={handleCancelAcceptance}
        isLoading={processing}
      />
    );
  }

  const statusCounts = getStatusCounts();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Inbox className="h-6 w-6 text-blue-600" />
            Open Block Invitations
          </h2>
          <p className="text-gray-600 mt-1">
            Invitations to join other parents' care blocks
          </p>
        </div>
        
        <Button
          onClick={fetchInvitations}
          variant="outline"
          disabled={loading || hookLoading}
          className="flex items-center gap-2"
        >
          <Users className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {hookError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {hookError}</p>
        </div>
      )}

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">{statusCounts.accepted}</p>
                <p className="text-sm text-gray-600">Accepted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-2xl font-bold text-gray-600">{statusCounts.expired}</p>
                <p className="text-sm text-gray-600">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-600">{statusCounts.declined}</p>
                <p className="text-sm text-gray-600">Declined</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invitations List */}
      {invitations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Inbox className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Open Block Invitations</h3>
            <p className="text-gray-600">
              You don't have any pending open block invitations at the moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {invitations.map((invitation) => (
            <OpenBlockInvitationCard
              key={invitation.care_response_id}
              invitation={invitation}
              onAccept={handleAccept}
              onDecline={handleDecline}
              isLoading={processing}
            />
          ))}
        </div>
      )}

      {/* Processing Overlay */}
      {processing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-900">Processing your request...</p>
          </div>
        </div>
      )}
    </div>
  );
}


