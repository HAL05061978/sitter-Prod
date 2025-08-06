-- Fix Open Block Schema with block_time_id for time-specific grouping
-- This creates a proper linking system for open block invitations grouped by time slot

-- First, let's drop the existing tables and recreate them properly
DROP TABLE IF EXISTS open_block_responses CASCADE;
DROP TABLE IF EXISTS open_block_invitations CASCADE;

-- Open Block Sessions Table (the main open block)
CREATE TABLE IF NOT EXISTS open_block_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- The parent who is offering their care block (Parent B)
    open_block_parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- The scheduled care block being offered
    scheduled_care_id UUID NOT NULL REFERENCES scheduled_care(id) ON DELETE CASCADE,
    
    -- Status of the entire open block session
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
    
    -- When the session expires
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    
    -- Additional metadata
    notes TEXT
);

-- Open Block Invitations Table (individual invitations for each parent per time slot)
CREATE TABLE IF NOT EXISTS open_block_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Link to the open block session
    open_block_id UUID NOT NULL REFERENCES open_block_sessions(id) ON DELETE CASCADE,
    
    -- Block time ID to group invitations for the same time slot
    block_time_id UUID NOT NULL,
    
    -- Which parent is invited
    invited_parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Who accepted the invitation (if any)
    accepted_parent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Status of this specific invitation
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'accepted', 'expired', 'declined')),
    
    -- Reciprocal care time specification (when Parent B needs care for their child)
    reciprocal_date DATE,
    reciprocal_start_time TIME,
    reciprocal_end_time TIME,
    
    -- Additional notes for this invitation
    notes TEXT,
    
    -- Ensure one invitation per parent per time slot per open block
    UNIQUE(open_block_id, block_time_id, invited_parent_id)
);

-- Open Block Responses Table
CREATE TABLE IF NOT EXISTS open_block_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Which invitation this response is for
    invitation_id UUID NOT NULL REFERENCES open_block_invitations(id) ON DELETE CASCADE,
    
    -- Which parent is responding
    parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Their response
    response TEXT NOT NULL CHECK (response IN ('accept', 'decline')),
    
    -- Which child they want to bring (if accepting)
    child_id UUID REFERENCES children(id) ON DELETE SET NULL,
    
    -- Additional notes
    notes TEXT,
    
    -- Ensure one response per parent per invitation
    UNIQUE(invitation_id, parent_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_open_block_sessions_open_block_parent_id ON open_block_sessions(open_block_parent_id);
CREATE INDEX IF NOT EXISTS idx_open_block_sessions_status ON open_block_sessions(status);
CREATE INDEX IF NOT EXISTS idx_open_block_sessions_expires_at ON open_block_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_open_block_invitations_open_block_id ON open_block_invitations(open_block_id);
CREATE INDEX IF NOT EXISTS idx_open_block_invitations_block_time_id ON open_block_invitations(block_time_id);
CREATE INDEX IF NOT EXISTS idx_open_block_invitations_invited_parent_id ON open_block_invitations(invited_parent_id);
CREATE INDEX IF NOT EXISTS idx_open_block_invitations_status ON open_block_invitations(status);

CREATE INDEX IF NOT EXISTS idx_open_block_responses_invitation_id ON open_block_responses(invitation_id);
CREATE INDEX IF NOT EXISTS idx_open_block_responses_parent_id ON open_block_responses(parent_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_open_block_sessions_updated_at 
    BEFORE UPDATE ON open_block_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_open_block_invitations_updated_at 
    BEFORE UPDATE ON open_block_invitations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle open block acceptance
CREATE OR REPLACE FUNCTION handle_open_block_acceptance()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is an acceptance, update the invitation status and expire related invitations
    IF NEW.response = 'accept' THEN
        -- Get the invitation details for this acceptance
        DECLARE
            invitation_open_block_id UUID;
            invitation_block_time_id UUID;
            invitation_invited_parent_id UUID;
        BEGIN
            SELECT open_block_id, block_time_id, invited_parent_id 
            INTO invitation_open_block_id, invitation_block_time_id, invitation_invited_parent_id
            FROM open_block_invitations 
            WHERE id = NEW.invitation_id;
            
            -- Update this invitation as accepted
            UPDATE open_block_invitations 
            SET 
                accepted_parent_id = NEW.parent_id,
                status = 'accepted',
                updated_at = NOW()
            WHERE id = NEW.invitation_id;
            
            -- Expire all other active invitations for the same parent in the same open block
            -- (First-come-first-serve: when a parent accepts one invitation, all their other invitations expire)
            UPDATE open_block_invitations 
            SET 
                status = 'expired',
                updated_at = NOW()
            WHERE open_block_id = invitation_open_block_id 
              AND invited_parent_id = invitation_invited_parent_id
              AND id != NEW.invitation_id 
              AND status = 'active';
            
            -- Expire all other active invitations for the same time slot (same block_time_id)
            -- (When a time slot is accepted, it's no longer available to other parents)
            UPDATE open_block_invitations 
            SET 
                status = 'expired',
                updated_at = NOW()
            WHERE block_time_id = invitation_block_time_id 
              AND id != NEW.invitation_id 
              AND status = 'active';
        END;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to handle acceptance
CREATE TRIGGER handle_open_block_acceptance_trigger
    AFTER INSERT ON open_block_responses
    FOR EACH ROW EXECUTE FUNCTION handle_open_block_acceptance();

-- RLS Policies for open_block_sessions
ALTER TABLE open_block_sessions ENABLE ROW LEVEL SECURITY;

-- Users can see sessions they created
CREATE POLICY "Users can view open block sessions they created" ON open_block_sessions
    FOR SELECT USING (auth.uid() = open_block_parent_id);

-- Users can create sessions
CREATE POLICY "Users can create open block sessions" ON open_block_sessions
    FOR INSERT WITH CHECK (auth.uid() = open_block_parent_id);

-- Users can update sessions they created
CREATE POLICY "Users can update open block sessions they created" ON open_block_sessions
    FOR UPDATE USING (auth.uid() = open_block_parent_id);

-- RLS Policies for open_block_invitations
ALTER TABLE open_block_invitations ENABLE ROW LEVEL SECURITY;

-- Users can see invitations they created or were invited to
CREATE POLICY "Users can view open block invitations they created or were invited to" ON open_block_invitations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM open_block_sessions 
            WHERE id = open_block_invitations.open_block_id 
            AND open_block_parent_id = auth.uid()
        ) OR 
        invited_parent_id = auth.uid()
    );

-- Users can create invitations
CREATE POLICY "Users can create open block invitations" ON open_block_invitations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM open_block_sessions 
            WHERE id = open_block_invitations.open_block_id 
            AND open_block_parent_id = auth.uid()
        )
    );

-- Users can update invitations they created
CREATE POLICY "Users can update open block invitations they created" ON open_block_invitations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM open_block_sessions 
            WHERE id = open_block_invitations.open_block_id 
            AND open_block_parent_id = auth.uid()
        )
    );

-- RLS Policies for open_block_responses
ALTER TABLE open_block_responses ENABLE ROW LEVEL SECURITY;

-- Users can see responses to invitations they created or were invited to
CREATE POLICY "Users can view responses to their invitations" ON open_block_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM open_block_invitations 
            WHERE id = open_block_responses.invitation_id 
            AND (invited_parent_id = auth.uid() OR 
                 EXISTS (
                     SELECT 1 FROM open_block_sessions 
                     WHERE id = open_block_invitations.open_block_id 
                     AND open_block_parent_id = auth.uid()
                 ))
        )
    );

-- Users can create responses to invitations they were invited to
CREATE POLICY "Users can respond to invitations they were invited to" ON open_block_responses
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM open_block_invitations 
            WHERE id = open_block_responses.invitation_id 
            AND invited_parent_id = auth.uid()
        )
    );

-- Users can update their own responses
CREATE POLICY "Users can update their own responses" ON open_block_responses
    FOR UPDATE USING (auth.uid() = parent_id);

-- Success message
SELECT 'Open block schema with block_time_id created successfully!' as status; 