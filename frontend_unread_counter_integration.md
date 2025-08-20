# Frontend Unread Message Counter Integration

## 🔧 **Backend Functions Created:**

### **1. `get_unread_message_count(user_id)`**
- Returns count of unread messages for a user
- Use this to display the counter on the Messages button

### **2. `mark_message_as_viewed(message_id, user_id)`**
- Marks a specific message as viewed
- Call this when user opens/clicks on a message

### **3. `mark_all_messages_as_viewed(user_id)`**
- Marks all messages as viewed for a user
- Call this when user visits the Messages page

## 📱 **Frontend Integration Steps:**

### **Step 1: Update Header Component**
```typescript
// In Header.tsx - Add unread message counter
const [unreadCount, setUnreadCount] = useState(0);

// Function to fetch unread count
const fetchUnreadCount = async () => {
  if (!user) return;
  
  const { data, error } = await supabase.rpc('get_unread_message_count', {
    p_user_id: user.id
  });
  
  if (!error && data !== null) {
    setUnreadCount(data);
  }
};

// Fetch count on component mount and periodically
useEffect(() => {
  fetchUnreadCount();
  const interval = setInterval(fetchUnreadCount, 30000); // Every 30 seconds
  return () => clearInterval(interval);
}, [user]);

// In the Messages button JSX:
<Link href="/messages" className="relative">
  Messages
  {unreadCount > 0 && (
    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )}
</Link>
```

### **Step 2: Update Messages Page**
```typescript
// In messages/page.tsx - Mark messages as viewed when page loads
useEffect(() => {
  if (user && messages.length > 0) {
    // Mark all messages as viewed when user visits the page
    supabase.rpc('mark_all_messages_as_viewed', {
      p_user_id: user.id
    });
    
    // Update header counter
    window.dispatchEvent(new CustomEvent('messagesViewed'));
  }
}, [user, messages]);

// Add event listener for header updates
useEffect(() => {
  const handleMessagesViewed = () => {
    // Trigger header counter refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('refreshUnreadCount'));
    }
  };
  
  window.addEventListener('messagesViewed', handleMessagesViewed);
  return () => window.removeEventListener('messagesViewed', handleMessagesViewed);
}, []);
```

### **Step 3: Update Header Event Handling**
```typescript
// In Header.tsx - Listen for refresh events
useEffect(() => {
  const handleRefreshUnreadCount = () => {
    fetchUnreadCount();
  };
  
  window.addEventListener('refreshUnreadCount', handleRefreshUnreadCount);
  return () => window.removeEventListener('refreshUnreadCount', handleRefreshUnreadCount);
}, []);
```

### **Step 4: Real-time Updates (Optional)**
```typescript
// In Header.tsx - Listen for new messages
useEffect(() => {
  if (!user) return;
  
  const channel = supabase
    .channel('messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `recipient_id=eq.${user.id}`
    }, () => {
      // New message received, update counter
      fetchUnreadCount();
    })
    .subscribe();
    
  return () => {
    supabase.removeChannel(channel);
  };
}, [user]);
```

## 🎯 **User Experience:**

### **What Users Will See:**
1. **Red badge** on Messages button showing unread count
2. **Counter updates** in real-time when new messages arrive
3. **Badge disappears** when all messages are read
4. **Smooth transitions** between read/unread states

### **When Counter Updates:**
- ✅ **New message received** → Counter increases
- ✅ **Message opened** → Counter decreases
- ✅ **Messages page visited** → Counter resets to 0
- ✅ **Real-time updates** every 30 seconds

## 🚀 **Implementation Order:**

1. **Run the backend script** first: `fix_unread_message_counter.sql`
2. **Update Header component** to show the counter
3. **Update Messages page** to mark messages as viewed
4. **Add event handling** for real-time updates
5. **Test the complete flow**

This will give you a professional, real-time unread message counter that users expect in modern applications! 🎯
