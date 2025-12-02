// =====================================================
// REPLACE handleCreateRequest function (around line 1363)
// =====================================================

const handleCreateRequest = async (e: React.FormEvent) => {
  e.preventDefault();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let data, error;

    if (newRequest.care_type === 'reciprocal') {
      // Validate reciprocal-specific fields
      if (!newRequest.child_id) {
        setError('Please select a child');
        return;
      }

      // Create reciprocal care request (existing logic)
      const result = await supabase.rpc('create_reciprocal_care_request', {
        requester_id: user.id,
        group_id: newRequest.group_id,
        requested_date: newRequest.care_date,
        start_time: newRequest.start_time,
        end_time: newRequest.end_time,
        child_id: newRequest.child_id,
        notes: newRequest.notes || null
      });
      data = result.data;
      error = result.error;

    } else if (newRequest.care_type === 'hangout') {
      // Validate hangout-specific fields
      if (newRequest.hosting_child_ids.length === 0) {
        setError('Please select at least one hosting child');
        return;
      }
      if (newRequest.invited_child_ids.length === 0) {
        setError('Please select at least one child to invite');
        return;
      }

      // Create hangout invitation
      const result = await supabase.rpc('create_hangout_invitation', {
        p_requesting_parent_id: user.id,
        p_group_id: newRequest.group_id,
        p_care_date: newRequest.care_date,
        p_start_time: newRequest.start_time,
        p_end_time: newRequest.end_time,
        p_hosting_child_ids: newRequest.hosting_child_ids,
        p_invited_child_ids: newRequest.invited_child_ids,
        p_notes: newRequest.notes || null
      });
      data = result.data?.[0]?.request_id;
      error = result.error;

    } else if (newRequest.care_type === 'sleepover') {
      // Validate sleepover-specific fields
      if (!newRequest.end_date) {
        setError('End date is required for sleepovers');
        return;
      }
      if (newRequest.hosting_child_ids.length === 0) {
        setError('Please select at least one hosting child');
        return;
      }
      if (newRequest.invited_child_ids.length === 0) {
        setError('Please select at least one child to invite');
        return;
      }

      // Create sleepover invitation
      const result = await supabase.rpc('create_sleepover_invitation', {
        p_requesting_parent_id: user.id,
        p_group_id: newRequest.group_id,
        p_care_date: newRequest.care_date,
        p_start_time: newRequest.start_time,
        p_end_date: newRequest.end_date,
        p_end_time: newRequest.end_time,
        p_hosting_child_ids: newRequest.hosting_child_ids,
        p_invited_child_ids: newRequest.invited_child_ids,
        p_notes: newRequest.notes || null
      });
      data = result.data?.[0]?.request_id;
      error = result.error;
    }

    if (error) {
      setError(`Failed to create ${newRequest.care_type}`);
      console.error('Error creating care request:', error);
      return;
    }

    // Send notifications to group members via messages
    if (data) {
      await supabase.rpc('send_care_request_notifications', {
        p_care_request_id: data
      });
    }

    // Reset form and refresh data
    resetNewRequestForm();
    fetchData();

  } catch (err) {
    console.error('Error in handleCreateRequest:', err);
    setError('An unexpected error occurred');
  }
};


// =====================================================
// REPLACE the form JSX inside the "New Care Request Modal"
// Find the section starting around line 2168: <form onSubmit={handleCreateRequest}...
// Replace everything between <form> and </form> with this:
// =====================================================

<form onSubmit={handleCreateRequest} className="p-6 space-y-4">
  {/* Care Type Selector */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Type *
    </label>
    <div className="grid grid-cols-3 gap-3">
      <button
        type="button"
        onClick={() => setNewRequest(prev => ({ ...prev, care_type: 'reciprocal', hosting_child_ids: [], invited_child_ids: [], end_date: '' }))}
        className={`px-4 py-3 rounded-md border-2 transition-all ${
          newRequest.care_type === 'reciprocal'
            ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        Care Request
      </button>
      <button
        type="button"
        onClick={() => setNewRequest(prev => ({ ...prev, care_type: 'hangout', child_id: '', end_date: '' }))}
        className={`px-4 py-3 rounded-md border-2 transition-all ${
          newRequest.care_type === 'hangout'
            ? 'border-green-500 bg-green-50 text-green-700 font-semibold'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        Hangout
      </button>
      <button
        type="button"
        onClick={() => setNewRequest(prev => ({ ...prev, care_type: 'sleepover', child_id: '' }))}
        className={`px-4 py-3 rounded-md border-2 transition-all ${
          newRequest.care_type === 'sleepover'
            ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        Sleepover
      </button>
    </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Date */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {newRequest.care_type === 'sleepover' ? 'Start Date *' : 'Date *'}
      </label>
      <input
        type="date"
        required
        value={newRequest.care_date}
        onChange={(e) => setNewRequest(prev => ({ ...prev, care_date: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    {/* End Date (Sleepover only) */}
    {newRequest.care_type === 'sleepover' && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          End Date *
        </label>
        <input
          type="date"
          required
          value={newRequest.end_date}
          onChange={(e) => setNewRequest(prev => ({ ...prev, end_date: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    )}

    {/* Start Time */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Start Time *
      </label>
      <input
        type="time"
        required
        value={newRequest.start_time}
        onChange={(e) => setNewRequest(prev => ({ ...prev, start_time: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    {/* End Time */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        End Time *
      </label>
      <input
        type="time"
        required
        value={newRequest.end_time}
        onChange={(e) => setNewRequest(prev => ({ ...prev, end_time: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    {/* Group */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Group *
      </label>
      <select
        required
        value={newRequest.group_id}
        onChange={(e) => {
          const groupId = e.target.value;
          setNewRequest(prev => ({
            ...prev,
            group_id: groupId,
            child_id: '',
            hosting_child_ids: [],
            invited_child_ids: []
          }));
          if (groupId) {
            fetchChildrenForGroup(groupId);
            if (newRequest.care_type !== 'reciprocal') {
              fetchAllGroupChildren(groupId);
            }
          }
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select a group</option>
        {groups.map(group => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
    </div>

    {/* Child (Reciprocal only) */}
    {newRequest.care_type === 'reciprocal' && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Child *
        </label>
        <select
          required
          value={newRequest.child_id}
          onChange={(e) => setNewRequest(prev => ({ ...prev, child_id: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={!newRequest.group_id || children.length === 0}
        >
          <option value="">
            {!newRequest.group_id
              ? 'Select a group first'
              : children.length === 0
              ? 'No active children in this group'
              : 'Select a child'
            }
          </option>
          {children.map(child => (
            <option key={child.id} value={child.id}>
              {child.name}
            </option>
          ))}
        </select>
      </div>
    )}
  </div>

  {/* Hosting Children (Hangout/Sleepover only) */}
  {(newRequest.care_type === 'hangout' || newRequest.care_type === 'sleepover') && (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Hosting Children * (Select your children who will host)
      </label>
      <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
        {!newRequest.group_id ? (
          <p className="text-sm text-gray-500">Select a group first</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-gray-500">No children available</p>
        ) : (
          <div className="space-y-2">
            {children.map(child => (
              <label key={child.id} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRequest.hosting_child_ids.includes(child.id)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setNewRequest(prev => ({
                      ...prev,
                      hosting_child_ids: checked
                        ? [...prev.hosting_child_ids, child.id]
                        : prev.hosting_child_ids.filter(id => id !== child.id)
                    }));
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm">{child.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )}

  {/* Invited Children (Hangout/Sleepover only) */}
  {(newRequest.care_type === 'hangout' || newRequest.care_type === 'sleepover') && (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Invited Children * (Select children from the group to invite)
      </label>
      <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
        {!newRequest.group_id ? (
          <p className="text-sm text-gray-500">Select a group first</p>
        ) : groupChildren.length === 0 ? (
          <p className="text-sm text-gray-500">No children available in this group</p>
        ) : (
          <div className="space-y-2">
            {groupChildren
              .filter(child => !children.some(myChild => myChild.id === child.id))
              .map(child => (
                <label key={child.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRequest.invited_child_ids.includes(child.id)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setNewRequest(prev => ({
                        ...prev,
                        invited_child_ids: checked
                          ? [...prev.invited_child_ids, child.id]
                          : prev.invited_child_ids.filter(id => id !== child.id)
                      }));
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm">{child.name}</span>
                </label>
              ))}
          </div>
        )}
      </div>
    </div>
  )}

  {/* Notes */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Notes (Optional)
    </label>
    <textarea
      value={newRequest.notes}
      onChange={(e) => setNewRequest(prev => ({ ...prev, notes: e.target.value }))}
      rows={3}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder={
        newRequest.care_type === 'reciprocal'
          ? "Any additional details about the care needed..."
          : `Any additional details about the ${newRequest.care_type}...`
      }
    />
  </div>

  {/* Buttons */}
  <div className="flex justify-end space-x-3 pt-4">
    <button
      type="button"
      onClick={resetNewRequestForm}
      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
    >
      Cancel
    </button>
    <button
      type="submit"
      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
    >
      Create {newRequest.care_type === 'reciprocal' ? 'Request' : newRequest.care_type.charAt(0).toUpperCase() + newRequest.care_type.slice(1)}
    </button>
  </div>
</form>
