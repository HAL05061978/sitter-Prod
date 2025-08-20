'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, MapPin, FileText, CheckCircle, XCircle } from 'lucide-react';
import { OpenBlockInvitation } from '@/types/open-block';
import { formatOpenBlockTime, getOpenBlockStatusColor } from '@/types/open-block';

interface OpenBlockInvitationCardProps {
  invitation: OpenBlockInvitation;
  onAccept: (invitation: OpenBlockInvitation) => void;
  onDecline: (invitation: OpenBlockInvitation) => void;
  isLoading?: boolean;
}

export default function OpenBlockInvitationCard({
  invitation,
  onAccept,
  onDecline,
  isLoading = false
}: OpenBlockInvitationCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const handleAccept = () => {
    onAccept(invitation);
  };

  const handleDecline = () => {
    onDecline(invitation);
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
    <Card className="w-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              {invitation.open_block_parent_name} is inviting you to join their care block
            </CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={getOpenBlockStatusColor(invitation.status)}>
                {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
              </Badge>
              <span className="text-sm text-gray-500">
                Invited {formatDate(invitation.created_at)}
              </span>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="text-gray-500 hover:text-gray-700"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Existing Block Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Care Block You're Invited To Join
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm">
                <span className="font-medium">Date:</span> {formatDate(invitation.existing_block_date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm">
                <span className="font-medium">Time:</span> {formatTime(invitation.existing_block_start_time)} - {formatTime(invitation.existing_block_end_time)}
              </span>
            </div>
          </div>
        </div>

        {/* Reciprocal Care Info */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Reciprocal Care You'll Provide
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-sm">
                <span className="font-medium">Date:</span> {formatDate(invitation.reciprocal_date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm">
                <span className="font-medium">Time:</span> {formatTime(invitation.reciprocal_start_time)} - {formatTime(invitation.reciprocal_end_time)}
              </span>
            </div>
          </div>
        </div>

        {/* Group Info */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="h-4 w-4" />
          <span>Group: {invitation.group_name}</span>
        </div>

        {/* Notes */}
        {invitation.notes && (
          <div className="bg-yellow-50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900 mb-1">Notes</p>
                <p className="text-sm text-yellow-800">{invitation.notes}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {invitation.status === 'pending' && (
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleAccept}
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Accept Invitation
            </Button>
            <Button
              onClick={handleDecline}
              disabled={isLoading}
              variant="outline"
              className="flex-1 text-red-600 border-red-600 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Decline
            </Button>
          </div>
        )}

        {/* Status-specific messages */}
        {invitation.status === 'accepted' && (
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="text-green-800 font-medium">Invitation Accepted!</p>
            <p className="text-green-700 text-sm">You're now part of this care block.</p>
          </div>
        )}

        {invitation.status === 'expired' && (
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <Clock className="h-6 w-6 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-800 font-medium">Invitation Expired</p>
            <p className="text-gray-700 text-sm">This invitation is no longer available.</p>
          </div>
        )}

        {invitation.status === 'declined' && (
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <XCircle className="h-6 w-6 text-red-600 mx-auto mb-2" />
            <p className="text-red-800 font-medium">Invitation Declined</p>
            <p className="text-red-700 text-sm">You declined this invitation.</p>
          </div>
        )}

        {/* Additional Details (when expanded) */}
        {showDetails && (
          <div className="border-t pt-4 space-y-3">
            <h5 className="font-medium text-gray-900">Additional Details</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Block Time ID:</span>
                <p className="text-gray-600 font-mono text-xs break-all">{invitation.block_time_id}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Care Request ID:</span>
                <p className="text-gray-600 font-mono text-xs break-all">{invitation.care_request_id}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Existing Block ID:</span>
                <p className="text-gray-600 font-mono text-xs break-all">{invitation.existing_block_id}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Open Block Parent ID:</span>
                <p className="text-gray-600 font-mono text-xs break-all">{invitation.open_block_parent_id}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


