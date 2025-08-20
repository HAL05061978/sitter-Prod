'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Clock, Calendar, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OpenBlockInvitationFormData } from '@/types/open-block';

interface OpenBlockInvitationFormProps {
  existingBlockId: string;
  existingBlockDate: string;
  existingBlockTime: string;
  onSubmit: (data: OpenBlockInvitationFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface Parent {
  id: string;
  name: string;
  children: Array<{
    id: string;
    name: string;
  }>;
}

interface ReciprocalTime {
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

export default function OpenBlockInvitationForm({
  existingBlockId,
  existingBlockDate,
  existingBlockTime,
  onSubmit,
  onCancel,
  isLoading = false
}: OpenBlockInvitationFormProps) {
  const [invitedParents, setInvitedParents] = useState<Parent[]>([]);
  const [reciprocalTimes, setReciprocalTimes] = useState<ReciprocalTime[]>([
    { date: '', startTime: '', endTime: '', notes: '' }
  ]);
  const [notes, setNotes] = useState('');
  const [availableParents, setAvailableParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch available parents for this group
  useEffect(() => {
    fetchAvailableParents();
  }, [existingBlockId]);

  const fetchAvailableParents = async () => {
    try {
      setLoading(true);
      
      // Get the group ID from the existing block
      const { data: blockData, error: blockError } = await supabase
        .from('scheduled_care')
        .select('group_id')
        .eq('id', existingBlockId)
        .single();

      if (blockError) throw blockError;

      // Get all active group members with children
      const { data: groupMembers, error: membersError } = await supabase
        .from('group_members')
        .select(`
          profile_id,
          profiles!inner(id, name),
          children!inner(id, name)
        `)
        .eq('group_id', blockData.group_id)
        .eq('status', 'active');

      if (membersError) throw membersError;

      // Get the current user's ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Filter out the current user and format the data
      const available = groupMembers
        .filter(member => member.profile_id !== user.id)
        .map(member => ({
          id: member.profile_id,
          name: member.profiles.name,
          children: member.children
        }));

      setAvailableParents(available);
    } catch (error) {
      console.error('Error fetching available parents:', error);
    } finally {
      setLoading(false);
    }
  };

  const addReciprocalTime = () => {
    setReciprocalTimes([...reciprocalTimes, { date: '', startTime: '', endTime: '', notes: '' }]);
  };

  const removeReciprocalTime = (index: number) => {
    if (reciprocalTimes.length > 1) {
      setReciprocalTimes(reciprocalTimes.filter((_, i) => i !== index));
    }
  };

  const updateReciprocalTime = (index: number, field: keyof ReciprocalTime, value: string) => {
    const updated = [...reciprocalTimes];
    updated[index] = { ...updated[index], [field]: value };
    setReciprocalTimes(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (invitedParents.length === 0) {
      alert('Please select at least one parent to invite');
      return;
    }

    if (reciprocalTimes.length === 0) {
      alert('Please specify at least one reciprocal time');
      return;
    }

    // Validate that we have the same number of reciprocal times as invited parents
    if (reciprocalTimes.length !== invitedParents.length) {
      alert('Number of reciprocal times must match number of invited parents');
      return;
    }

    // Validate all reciprocal times are filled
    const isValid = reciprocalTimes.every(time => 
      time.date && time.startTime && time.endTime
    );

    if (!isValid) {
      alert('Please fill in all reciprocal time details');
      return;
    }

    const formData: OpenBlockInvitationFormData = {
      invitedParents,
      reciprocalTimes,
      notes: notes.trim() || undefined
    };

    onSubmit(formData);
  };

  const toggleParent = (parent: Parent) => {
    const isSelected = invitedParents.some(p => p.id === parent.id);
    
    if (isSelected) {
      setInvitedParents(invitedParents.filter(p => p.id !== parent.id));
    } else {
      setInvitedParents([...invitedParents, parent]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading available parents...</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Open Block Invitation
        </CardTitle>
        <p className="text-sm text-gray-600">
          Invite other parents to join your care block on {existingBlockDate} at {existingBlockTime}
        </p>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Available Parents Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Select Parents to Invite</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableParents.map((parent) => {
                const isSelected = invitedParents.some(p => p.id === parent.id);
                return (
                  <div
                    key={parent.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleParent(parent)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{parent.name}</p>
                        <p className="text-sm text-gray-600">
                          {parent.children.length} child{parent.children.length !== 1 ? 'ren' : ''}
                        </p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {invitedParents.length === 0 && (
              <p className="text-sm text-red-600">Please select at least one parent to invite</p>
            )}
          </div>

          {/* Reciprocal Times */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Reciprocal Care Times Needed</Label>
            <p className="text-sm text-gray-600">
              Specify when you need care in return for each invited parent
            </p>
            
            {reciprocalTimes.map((time, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Time Block {index + 1}</h4>
                  {reciprocalTimes.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeReciprocalTime(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor={`date-${index}`}>Date</Label>
                    <Input
                      id={`date-${index}`}
                      type="date"
                      value={time.date}
                      onChange={(e) => updateReciprocalTime(index, 'date', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`start-${index}`}>Start Time</Label>
                    <Input
                      id={`start-${index}`}
                      type="time"
                      value={time.startTime}
                      onChange={(e) => updateReciprocalTime(index, 'startTime', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`end-${index}`}>End Time</Label>
                    <Input
                      id={`end-${index}`}
                      type="time"
                      value={time.endTime}
                      onChange={(e) => updateReciprocalTime(index, 'endTime', e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor={`notes-${index}`}>Notes (Optional)</Label>
                  <Textarea
                    id={`notes-${index}`}
                    placeholder="Any specific notes about this time block..."
                    value={time.notes || ''}
                    onChange={(e) => updateReciprocalTime(index, 'notes', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            ))}
            
            <Button
              type="button"
              variant="outline"
              onClick={addReciprocalTime}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Time Block
            </Button>
          </div>

          {/* General Notes */}
          <div className="space-y-2">
            <Label htmlFor="general-notes">General Notes (Optional)</Label>
            <Textarea
              id="general-notes"
              placeholder="Any additional notes about this open block invitation..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
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
              type="submit"
              disabled={isLoading || invitedParents.length === 0}
              className="flex-1"
            >
              {isLoading ? 'Sending Invitations...' : 'Send Invitations'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


