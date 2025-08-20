'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OpenBlockInvitationForm, OpenBlockInvitationsList } from '@/components/open-block';
import { useOpenBlock } from '@/hooks/useOpenBlock';
import { OpenBlockInvitationFormData } from '@/types/open-block';

export default function OpenBlockTestPage() {
  const [showInvitationForm, setShowInvitationForm] = useState(false);
  const [showInvitationsList, setShowInvitationsList] = useState(false);
  const { createOpenBlockInvitation, loading, error } = useOpenBlock();

  const handleCreateInvitation = async (data: OpenBlockInvitationFormData) => {
    console.log('Creating invitation with data:', data);
    
    // Mock existing block ID for testing
    const mockExistingBlockId = '123e4567-e89b-12d3-a456-426614174000';
    
    const result = await createOpenBlockInvitation(mockExistingBlockId, data);
    
    if (result.error) {
      alert('Error: ' + result.error.message);
    } else {
      alert(`Successfully created ${result.data.length} invitations!`);
      setShowInvitationForm(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Open Block Test Page</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Test Open Block Invitation Form</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Test the form for creating open block invitations
              </p>
              <Button 
                onClick={() => setShowInvitationForm(true)}
                className="w-full"
              >
                Open Invitation Form
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Open Block Invitations List</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Test viewing and managing open block invitations
              </p>
              <Button 
                onClick={() => setShowInvitationsList(true)}
                className="w-full"
              >
                View Invitations
              </Button>
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Error: {error}</p>
          </div>
        )}

        {showInvitationForm && (
          <div className="mb-8">
            <OpenBlockInvitationForm
              existingBlockId="123e4567-e89b-12d3-a456-426614174000"
              existingBlockDate="2024-01-15"
              existingBlockTime="9:00 AM - 12:00 PM"
              onSubmit={handleCreateInvitation}
              onCancel={() => setShowInvitationForm(false)}
              isLoading={loading}
            />
          </div>
        )}

        {showInvitationsList && (
          <div className="mb-8">
            <OpenBlockInvitationsList />
          </div>
        )}
      </div>
    </div>
  );
}


