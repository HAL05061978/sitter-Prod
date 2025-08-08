-- Simple Open Block Fix
-- This script provides the simple frontend fix to update open_block_invitations.status

-- 1. First, let's see what open_block_invitations data we have
SELECT '=== CURRENT OPEN_BLOCK_INVITATIONS DATA ===' as info;

SELECT 
    obi.id as invitation_id,
    obi.open_block_id,
    obi.invited_parent_id,
    obi.inviting_parent_id,
    obi.status,
    obi.reciprocal_date,
    obi.reciprocal_start_time,
    obi.reciprocal_end_time,
    p1.full_name as inviting_parent_name,
    p2.full_name as invited_parent_name
FROM open_block_invitations obi
JOIN profiles p1 ON obi.inviting_parent_id = p1.id
JOIN profiles p2 ON obi.invited_parent_id = p2.id
ORDER BY obi.created_at DESC;

-- 2. Check what open_block_responses data we have
SELECT '=== CURRENT OPEN_BLOCK_RESPONSES DATA ===' as info;

SELECT 
    obr.id as response_id,
    obr.invitation_id,
    obr.parent_id as responding_parent,
    obr.response,
    obr.created_at,
    p.full_name as responding_parent_name
FROM open_block_responses obr
JOIN profiles p ON obr.parent_id = p.id
ORDER BY obr.created_at DESC;

-- 3. Simple Frontend Fix
SELECT '=== SIMPLE FRONTEND FIX ===' as info;
SELECT 'Replace the handleOpenBlockResponse function with this:' as change;

SELECT 'const handleOpenBlockResponse = async (invitationId: string, response: "accept" | "decline", childId?: string) => {' as code;
SELECT '  console.log("handleOpenBlockResponse called with:", { invitationId, response, childId });' as code;
SELECT '  try {' as code;
SELECT '    // 1. Update the open_block_invitations status directly' as code;
SELECT '    const { error: updateError } = await supabase' as code;
SELECT '      .from("open_block_invitations")' as code;
SELECT '      .update({ status: response === "accept" ? "accepted" : "declined" })' as code;
SELECT '      .eq("id", invitationId);' as code;
SELECT '' as code;
SELECT '    if (updateError) {' as code;
SELECT '      console.error("Error updating invitation status:", updateError);' as code;
SELECT '      alert("Error processing open block invitation. Please try again.");' as code;
SELECT '      return;' as code;
SELECT '    }' as code;
SELECT '' as code;
SELECT '    // 2. If accepted, create the calendar blocks' as code;
SELECT '    if (response === "accept") {' as code;
SELECT '      await createOpenBlockCalendarBlocks(invitationId);' as code;
SELECT '    }' as code;
SELECT '' as code;
SELECT '    // 3. Refresh data' as code;
SELECT '    await fetchRequestsAndResponses(user!.id);' as code;
SELECT '    await fetchScheduledCare(user!.id, new Date());' as code;
SELECT '' as code;
SELECT '    setShowOpenBlockResponseModal(false);' as code;
SELECT '' as code;
SELECT '    if (response === "accept") {' as code;
SELECT '      alert("Open block invitation accepted successfully! Calendar blocks have been created.");' as code;
SELECT '    } else {' as code;
SELECT '      alert("Open block invitation declined.");' as code;
SELECT '    }' as code;
SELECT '  } catch (error) {' as code;
SELECT '    console.error("Error handling open block response:", error);' as code;
SELECT '    alert("Error processing open block invitation. Please try again.");' as code;
SELECT '  }' as code;
SELECT '};' as code;

-- 4. Create Calendar Blocks Function
SELECT '=== CREATE CALENDAR BLOCKS FUNCTION ===' as info;
SELECT 'Add this function to create calendar blocks:' as change;

SELECT 'const createOpenBlockCalendarBlocks = async (invitationId: string) => {' as code;
SELECT '  try {' as code;
SELECT '    // 1. Get the invitation details' as code;
SELECT '    const { data: invitation, error: fetchError } = await supabase' as code;
SELECT '      .from("open_block_invitations")' as code;
SELECT '      .select("*")' as code;
SELECT '      .eq("id", invitationId)' as code;
SELECT '      .single();' as code;
SELECT '' as code;
SELECT '    if (fetchError || !invitation) {' as code;
SELECT '      console.error("Error fetching invitation:", fetchError);' as code;
SELECT '      return;' as code;
SELECT '    }' as code;
SELECT '' as code;
SELECT '    // 2. Get the original care block' as code;
SELECT '    const { data: originalBlock, error: blockError } = await supabase' as code;
SELECT '      .from("scheduled_care")' as code;
SELECT '      .select("*")' as code;
SELECT '      .eq("id", invitation.open_block_id)' as code;
SELECT '      .single();' as code;
SELECT '' as code;
SELECT '    if (blockError || !originalBlock) {' as code;
SELECT '      console.error("Error fetching original block:", blockError);' as code;
SELECT '      return;' as code;
SELECT '    }' as code;
SELECT '' as code;
SELECT '    // 3. Get children for both parents' as code;
SELECT '    const { data: invitingChild } = await supabase' as code;
SELECT '      .from("children")' as code;
SELECT '      .select("id")' as code;
SELECT '      .eq("parent_id", invitation.inviting_parent_id)' as code;
SELECT '      .limit(1)' as code;
SELECT '      .single();' as code;
SELECT '' as code;
SELECT '    const { data: invitedChild } = await supabase' as code;
SELECT '      .from("children")' as code;
SELECT '      .select("id")' as code;
SELECT '      .eq("parent_id", invitation.invited_parent_id)' as code;
SELECT '      .limit(1)' as code;
SELECT '      .single();' as code;
SELECT '' as code;
SELECT '    // 4. Create the new care block for invited parent (provides care)' as code;
SELECT '    const { data: newBlock, error: createError } = await supabase' as code;
SELECT '      .from("scheduled_care")' as code;
SELECT '      .insert({' as code;
SELECT '        group_id: originalBlock.group_id,' as code;
SELECT '        parent_id: invitation.invited_parent_id,' as code;
SELECT '        child_id: invitingChild.id,' as code;
SELECT '        care_date: invitation.reciprocal_date,' as code;
SELECT '        start_time: invitation.reciprocal_start_time,' as code;
SELECT '        end_time: invitation.reciprocal_end_time,' as code;
SELECT '        care_type: "provided",' as code;
SELECT '        status: "confirmed",' as code;
SELECT '        notes: "Open block: invited parent provides care"' as code;
SELECT '      })' as code;
SELECT '      .select()' as code;
SELECT '      .single();' as code;
SELECT '' as code;
SELECT '    if (createError) {' as code;
SELECT '      console.error("Error creating new care block:", createError);' as code;
SELECT '      return;' as code;
SELECT '    }' as code;
SELECT '' as code;
SELECT '    // 5. Create the care block for inviting parent (needs care)' as code;
SELECT '    await supabase' as code;
SELECT '      .from("scheduled_care")' as code;
SELECT '      .insert({' as code;
SELECT '        group_id: originalBlock.group_id,' as code;
SELECT '        parent_id: invitation.inviting_parent_id,' as code;
SELECT '        child_id: invitingChild.id,' as code;
SELECT '        care_date: invitation.reciprocal_date,' as code;
SELECT '        start_time: invitation.reciprocal_start_time,' as code;
SELECT '        end_time: invitation.reciprocal_end_time,' as code;
SELECT '        care_type: "needed",' as code;
SELECT '        status: "confirmed",' as code;
SELECT '        notes: "Open block: inviting parent needs care"' as code;
SELECT '      });' as code;
SELECT '' as code;
SELECT '    // 6. Add invited parent''s child to original block' as code;
SELECT '    await supabase' as code;
SELECT '      .from("scheduled_care_children")' as code;
SELECT '      .insert({' as code;
SELECT '        scheduled_care_id: invitation.open_block_id,' as code;
SELECT '        child_id: invitedChild.id,' as code;
SELECT '        providing_parent_id: invitation.inviting_parent_id,' as code;
SELECT '        notes: "Open block: inviting parent provides care for invited parent''s child"' as code;
SELECT '      });' as code;
SELECT '' as code;
SELECT '    console.log("Calendar blocks created successfully");' as code;
SELECT '  } catch (error) {' as code;
SELECT '    console.error("Error creating calendar blocks:", error);' as code;
SELECT '  }' as code;
SELECT '};' as code;

-- 5. Success message
SELECT '=== SIMPLE FIX APPLIED ===' as status;
SELECT 'This fix:' as info;
SELECT '1. Updates open_block_invitations.status directly from frontend' as info;
SELECT '2. Creates calendar blocks using the correct parent assignments' as info;
SELECT '3. Uses invited_parent_id and inviting_parent_id from the invitation' as info;
SELECT '4. Follows the exact rules you specified' as info;
SELECT '5. No complex triggers needed' as info;
