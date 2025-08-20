'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Users, CheckCircle } from 'lucide-react';
import { OpenBlockInvitation, OpenBlockAcceptanceFormData } from '@/types/open-block';

interface OpenBlockAcceptanceFormProps {
  invitation: OpenBlockInvitation;
  availableChildren: Array<{
    id: string;
    name: string;
  }>;
  onSubmit: (data: OpenBlockAcceptanceFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function OpenBlockAcceptanceForm({
  invitation,
  availableChildren,
  onSubmit,
  onCancel,
  isLoading = false
}: OpenBlockAcceptanceFormProps) {
  const [acceptedChildId, setAcceptedChildId] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!acceptedChildId) {
      alert('Please select a child to join the care block');
      return;
    }

    const formData: OpenBlockAcceptanceFormData = {
      acceptedChildId,
      notes: notes.trim() || undefined
    };

    onSubmit(formData);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700">
          <CheckCircle className="h-5 w-5" />
          Accept Open Block Invitation
        </CardTitle>
        <p className="text-sm text-gray-600">
          You're accepting an invitation to join {invitation.open_block_parent_name}'s care block
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Invitation Summary */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-3">Invitation Summary</h4>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-sm">
                <span className="font-medium">Care Block Date:</span> {formatDate(invitation.existing_block_date)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm">
                <span className="font-medium">Care Block Time:</span> {formatTime(invitation.existing_block_start_time)} - {formatTime(invitation.existing_block_end_time)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm">
                <span className="font-medium">Group:</span> {invitation.group_name}
              </span>
            </div>
          </div>
        </div>

        {/* Reciprocal Care Info */}
        <div className="bg-green-50 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-3">Reciprocal Care You'll Provide</h4>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <span className="text-sm">
                <span className="font-medium">Date:</span> {formatDate(invitation.reciprocal_date)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600" />
              <span className="text-sm">
                <span className="font-medium">Time:</span> {formatTime(invitation.reciprocal_start_time)} - {formatTime(invitation.reciprocal_end_time)}
              </span>
            </div>
          </div>
          
          <p className="text-sm text-green-700 mt-3">
            In return for joining this care block, you'll provide care for {invitation.open_block_parent_name}'s child during the time above.
          </p>
        </div>

        {/* Child Selection */}
        <div className="space-y-3">
          <Label htmlFor="child-select" className="text-base font-medium">
            Select Child to Join Care Block
          </Label>
          <p className="text-sm text-gray-600">
            Choose which of your children will participate in this care block
          </p>
          
          <Select value={acceptedChildId} onValueChange={setAcceptedChildId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a child..." />
            </SelectTrigger>
            <SelectContent>
              {availableChildren.map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  {child.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {acceptedChildId === '' && (
            <p className="text-sm text-red-600">Please select a child to continue</p>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="Any notes about accepting this invitation..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {/* Important Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <h5 className="font-medium text-yellow-900 mb-2">Important Notice</h5>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• By accepting this invitation, your child will be added to the existing care block</li>
                <li>• You'll be responsible for providing care during the reciprocal time specified above</li>
                <li>• This is a first-come-first-serve invitation - accepting will expire other pending invitations</li>
                <li>• You can only accept one invitation per care block</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !acceptedChildId}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {isLoading ? 'Accepting...' : 'Accept Invitation'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


