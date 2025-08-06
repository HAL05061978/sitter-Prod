-- Frontend Code Fixes for New Open Block Schema
-- Replace the handleOpenBlockSubmit function in app/schedule/page.tsx

/*
Replace the entire handleOpenBlockSubmit function with this:

const handleOpenBlockSubmit = async () => {
  if (!user || !selectedCareBlock || openBlockForm.invitedParentIds.length === 0) {
    alert('Please select at least one parent to invite');
    return;
  }

  try {
    // First, create the open block session
    const { data: openBlockSession, error: sessionError } = await supabase
      .from('open_block_sessions')
      .insert({
        open_block_parent_id: user.id,
        scheduled_care_id: selectedCareBlock.id,
        notes: openBlockForm.notes || `Open block invitation: ${getParentName(user.id)} is offering their care block on ${selectedCareBlock.care_date} from ${formatTime(selectedCareBlock.start_time)} to ${formatTime(selectedCareBlock.end_time)}.`
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating open block session:', sessionError);
      alert('Error creating open block session: ' + sessionError.message);
      return;
    }

    const invitations = [];
    
    // Create invitations for each time slot
    for (let timeSlotIndex = 0; timeSlotIndex < openBlockForm.reciprocalTimeSlots.length; timeSlotIndex++) {
      const timeSlot = openBlockForm.reciprocalTimeSlots[timeSlotIndex];
      const blockTimeId = crypto.randomUUID(); // Generate unique block time ID for this time slot
      
      // Create invitation for each parent for this time slot
      for (const parentId of openBlockForm.invitedParentIds) {
        const { data: invitation, error: createError } = await supabase
          .from('open_block_invitations')
          .insert({
            open_block_id: openBlockSession.id,
            block_time_id: blockTimeId, // Same block time ID for all parents for this time slot
            invited_parent_id: parentId, // Single parent per invitation
            reciprocal_date: timeSlot.date,
            reciprocal_start_time: timeSlot.startTime,
            reciprocal_end_time: timeSlot.endTime,
            notes: `In exchange, they need care for their child on ${timeSlot.date} from ${timeSlot.startTime} to ${timeSlot.endTime}.`
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating open block invitation for parent', parentId, 'time slot:', timeSlot, ':', createError);
          alert('Error creating open block invitation: ' + createError.message);
          return;
        }

        invitations.push(invitation);
      }

      // Send notification to all parents for this time slot
      for (const parentId of openBlockForm.invitedParentIds) {
        const { error: messageError } = await supabase
          .from("messages")
          .insert({
            group_id: selectedCareBlock.group_id,
            sender_id: user.id,
            recipient_id: parentId,
            subject: "Open Block Invitation",
            content: `You have been invited to join an open care block by ${getParentName(user.id)}. You have ${openBlockForm.reciprocalTimeSlots.length} time slot(s) to choose from. Check your care requests to respond.`,
            role: 'notification'
          });

        if (messageError) {
          console.error('Error sending notification:', messageError);
        }
      }
    }

    // Close the modal and show success message
    setShowOpenBlockModal(false);
    setOpenBlockForm({
      invitedParentIds: [],
      reciprocalTimeSlots: [{ date: '', startTime: '', endTime: '' }],
      notes: ''
    });
    setSelectedCareBlock(null);

    // Refresh data to show new invitations
    await fetchRequestsAndResponses(user.id);

    // Dispatch custom event to update header count
    window.dispatchEvent(new CustomEvent('careRequestUpdated'));
    window.dispatchEvent(new CustomEvent('newMessageSent'));

    alert(`Open block invitations created successfully! ${invitations.length} invitation(s) sent. It's first-come-first-serve - the first parent to accept gets the slot.`);
  } catch (error) {
    console.error('Error creating open block invitation:', error);
    alert('Error creating open block invitation. Please try again.');
  }
};
*/ 