-- =====================================================
-- PET CARE SCHEMA
-- =====================================================
-- This migration creates the pet care system that mirrors
-- the child care reciprocal workflow but for pet owners.
-- Supports multi-day pet care blocks.

-- =====================================================
-- STEP 1: CREATE ALL TABLE STRUCTURES
-- =====================================================

-- 1. PETS TABLE
CREATE TABLE IF NOT EXISTS pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    species VARCHAR(100),  -- dog, cat, bird, etc.
    breed VARCHAR(100),
    age INTEGER,
    birthdate DATE,
    special_needs TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PET GROUP MEMBERS TABLE
CREATE TABLE IF NOT EXISTS pet_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    added_by UUID NOT NULL REFERENCES auth.users(id),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    active BOOLEAN DEFAULT true,
    UNIQUE(pet_id, group_id)
);

-- 3. PET CARE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS pet_care_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
    requested_date DATE NOT NULL,
    end_date DATE,  -- For multi-day requests
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    notes TEXT,
    request_type VARCHAR(50) NOT NULL DEFAULT 'reciprocal' CHECK (request_type IN ('reciprocal')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
    responder_id UUID REFERENCES auth.users(id),
    response_notes TEXT,
    is_reciprocal BOOLEAN DEFAULT true,
    reciprocal_parent_id UUID REFERENCES auth.users(id),
    reciprocal_pet_id UUID REFERENCES pets(id),
    reciprocal_date DATE,
    reciprocal_start_time TIME,
    reciprocal_end_time TIME,
    reciprocal_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    reciprocal_care_id UUID,
    action_type VARCHAR(50),
    original_request_id UUID REFERENCES pet_care_requests(id),
    reschedule_reason TEXT,
    reschedule_group_id UUID,
    actual_end_time TIME,
    is_next_day BOOLEAN DEFAULT false,
    counter_proposal_to UUID REFERENCES pet_care_requests(id)
);

-- 4. SCHEDULED PET CARE TABLE
CREATE TABLE IF NOT EXISTS scheduled_pet_care (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
    care_date DATE NOT NULL,
    end_date DATE,  -- For multi-day pet care
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    care_type VARCHAR(50) NOT NULL CHECK (care_type IN ('provided', 'needed', 'received')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    related_request_id UUID REFERENCES pet_care_requests(id) ON DELETE SET NULL,
    notes TEXT,
    is_editable BOOLEAN DEFAULT false,
    edit_deadline TIMESTAMPTZ,
    edit_reason TEXT,
    original_start_time TIME,
    original_end_time TIME,
    original_care_date DATE,
    edited_by UUID REFERENCES auth.users(id),
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    action_type VARCHAR(50),
    original_care_id UUID REFERENCES scheduled_pet_care(id) ON DELETE SET NULL,
    reschedule_group_id UUID
);

-- 5. SCHEDULED PET CARE PETS TABLE (Junction)
CREATE TABLE IF NOT EXISTS scheduled_pet_care_pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_pet_care_id UUID NOT NULL REFERENCES scheduled_pet_care(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(scheduled_pet_care_id, pet_id)
);

-- 6. PET CARE RESPONSES TABLE
CREATE TABLE IF NOT EXISTS pet_care_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES pet_care_requests(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    response_type VARCHAR(50) NOT NULL CHECK (response_type IN ('accepted', 'declined', 'pending', 'counter_proposal')),
    response_notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    reciprocal_date DATE,
    reciprocal_start_time TIME,
    reciprocal_end_time TIME,
    reciprocal_pet_id UUID REFERENCES pets(id),
    invited_parent_id UUID REFERENCES auth.users(id),
    accepted_parent_id UUID REFERENCES auth.users(id),
    invited_pet_id UUID REFERENCES pets(id),
    action_type VARCHAR(50),
    original_response_id UUID REFERENCES pet_care_responses(id),
    decline_action VARCHAR(50),
    counter_proposal_date DATE,
    counter_proposal_start_time TIME,
    counter_proposal_end_time TIME,
    counter_proposal_notes TEXT,
    selected_cancellation_request_id UUID
);

-- =====================================================
-- STEP 2: CREATE ALL INDEXES
-- =====================================================

-- Pets indexes
CREATE INDEX IF NOT EXISTS idx_pets_parent_id ON pets(parent_id);
CREATE INDEX IF NOT EXISTS idx_pets_created_at ON pets(created_at);

-- Pet group members indexes
CREATE INDEX IF NOT EXISTS idx_pet_group_members_pet_id ON pet_group_members(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_group_members_group_id ON pet_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_pet_group_members_active ON pet_group_members(active);

-- Pet care requests indexes
CREATE INDEX IF NOT EXISTS idx_pet_care_requests_requester ON pet_care_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_pet_care_requests_responder ON pet_care_requests(responder_id);
CREATE INDEX IF NOT EXISTS idx_pet_care_requests_group ON pet_care_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_pet_care_requests_status ON pet_care_requests(status);
CREATE INDEX IF NOT EXISTS idx_pet_care_requests_date ON pet_care_requests(requested_date);
CREATE INDEX IF NOT EXISTS idx_pet_care_requests_reciprocal_parent ON pet_care_requests(reciprocal_parent_id);

-- Scheduled pet care indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_pet_care_parent_id ON scheduled_pet_care(parent_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_pet_care_group_id ON scheduled_pet_care(group_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_pet_care_date ON scheduled_pet_care(care_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_pet_care_care_type ON scheduled_pet_care(care_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_pet_care_status ON scheduled_pet_care(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_pet_care_related_request ON scheduled_pet_care(related_request_id);

-- Scheduled pet care pets indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_pet_care_pets_care_id ON scheduled_pet_care_pets(scheduled_pet_care_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_pet_care_pets_pet_id ON scheduled_pet_care_pets(pet_id);

-- Pet care responses indexes
CREATE INDEX IF NOT EXISTS idx_pet_care_responses_request ON pet_care_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_pet_care_responses_responder ON pet_care_responses(responder_id);
CREATE INDEX IF NOT EXISTS idx_pet_care_responses_status ON pet_care_responses(status);
CREATE INDEX IF NOT EXISTS idx_pet_care_responses_invited_parent ON pet_care_responses(invited_parent_id);
CREATE INDEX IF NOT EXISTS idx_pet_care_responses_accepted_parent ON pet_care_responses(accepted_parent_id);

-- =====================================================
-- STEP 3: ENABLE RLS AND CREATE POLICIES
-- =====================================================

-- PETS RLS POLICIES
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pets"
    ON pets FOR SELECT
    USING (parent_id = auth.uid());

CREATE POLICY "Users can view pets in their groups"
    ON pets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM pet_group_members pgm
            JOIN groups g ON g.id = pgm.group_id
            JOIN group_members gm ON gm.group_id = g.id
            WHERE pgm.pet_id = pets.id
            AND gm.profile_id = auth.uid()
            AND gm.status = 'active'
        )
    );

CREATE POLICY "Users can insert their own pets"
    ON pets FOR INSERT
    WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Users can update their own pets"
    ON pets FOR UPDATE
    USING (parent_id = auth.uid());

CREATE POLICY "Users can delete their own pets"
    ON pets FOR DELETE
    USING (parent_id = auth.uid());

-- PET GROUP MEMBERS RLS POLICIES
ALTER TABLE pet_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pet group members in their groups"
    ON pet_group_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = pet_group_members.group_id
            AND gm.profile_id = auth.uid()
            AND gm.status = 'active'
        )
    );

CREATE POLICY "Users can add pets to their groups"
    ON pet_group_members FOR INSERT
    WITH CHECK (
        added_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = pet_group_members.group_id
            AND gm.profile_id = auth.uid()
            AND gm.status = 'active'
        )
    );

CREATE POLICY "Users can update pet group members in their groups"
    ON pet_group_members FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = pet_group_members.group_id
            AND gm.profile_id = auth.uid()
            AND gm.status = 'active'
        )
    );

-- PET CARE REQUESTS RLS POLICIES
ALTER TABLE pet_care_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pet care requests they created"
    ON pet_care_requests FOR SELECT
    USING (requester_id = auth.uid());

CREATE POLICY "Users can view pet care requests where they are responder"
    ON pet_care_requests FOR SELECT
    USING (responder_id = auth.uid() OR reciprocal_parent_id = auth.uid());

CREATE POLICY "Users can view pet care requests in their groups"
    ON pet_care_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = pet_care_requests.group_id
            AND gm.profile_id = auth.uid()
            AND gm.status = 'active'
        )
    );

CREATE POLICY "Users can insert pet care requests"
    ON pet_care_requests FOR INSERT
    WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Users can update pet care requests they created"
    ON pet_care_requests FOR UPDATE
    USING (requester_id = auth.uid() OR responder_id = auth.uid() OR reciprocal_parent_id = auth.uid());

CREATE POLICY "Users can delete pet care requests they created"
    ON pet_care_requests FOR DELETE
    USING (requester_id = auth.uid());

-- SCHEDULED PET CARE RLS POLICIES
ALTER TABLE scheduled_pet_care ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pet care blocks"
    ON scheduled_pet_care FOR SELECT
    USING (parent_id = auth.uid());

CREATE POLICY "Users can view pet care blocks in their groups"
    ON scheduled_pet_care FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = scheduled_pet_care.group_id
            AND gm.profile_id = auth.uid()
            AND gm.status = 'active'
        )
    );

CREATE POLICY "Users can insert pet care blocks"
    ON scheduled_pet_care FOR INSERT
    WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Users can update their own pet care blocks"
    ON scheduled_pet_care FOR UPDATE
    USING (parent_id = auth.uid());

CREATE POLICY "Users can delete their own pet care blocks"
    ON scheduled_pet_care FOR DELETE
    USING (parent_id = auth.uid());

-- SCHEDULED PET CARE PETS RLS POLICIES
ALTER TABLE scheduled_pet_care_pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pet care pets in their blocks or groups"
    ON scheduled_pet_care_pets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM scheduled_pet_care spc
            WHERE spc.id = scheduled_pet_care_pets.scheduled_pet_care_id
            AND (
                spc.parent_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM group_members gm
                    WHERE gm.group_id = spc.group_id
                    AND gm.profile_id = auth.uid()
                    AND gm.status = 'active'
                )
            )
        )
    );

CREATE POLICY "Users can insert pet care pets"
    ON scheduled_pet_care_pets FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM scheduled_pet_care spc
            WHERE spc.id = scheduled_pet_care_pets.scheduled_pet_care_id
            AND spc.parent_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete pet care pets from their blocks"
    ON scheduled_pet_care_pets FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM scheduled_pet_care spc
            WHERE spc.id = scheduled_pet_care_pets.scheduled_pet_care_id
            AND spc.parent_id = auth.uid()
        )
    );

-- PET CARE RESPONSES RLS POLICIES
ALTER TABLE pet_care_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pet care responses they created"
    ON pet_care_responses FOR SELECT
    USING (responder_id = auth.uid());

CREATE POLICY "Users can view pet care responses to their requests"
    ON pet_care_responses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM pet_care_requests pcr
            WHERE pcr.id = pet_care_responses.request_id
            AND pcr.requester_id = auth.uid()
        )
    );

CREATE POLICY "Users can view pet care responses where they are invited"
    ON pet_care_responses FOR SELECT
    USING (invited_parent_id = auth.uid() OR accepted_parent_id = auth.uid());

CREATE POLICY "Users can insert pet care responses"
    ON pet_care_responses FOR INSERT
    WITH CHECK (responder_id = auth.uid());

CREATE POLICY "Users can update pet care responses they created"
    ON pet_care_responses FOR UPDATE
    USING (responder_id = auth.uid());

-- =====================================================
-- STEP 4: CREATE TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_pet_care_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pets_updated_at
    BEFORE UPDATE ON pets
    FOR EACH ROW
    EXECUTE FUNCTION update_pet_care_updated_at();

CREATE TRIGGER update_scheduled_pet_care_updated_at
    BEFORE UPDATE ON scheduled_pet_care
    FOR EACH ROW
    EXECUTE FUNCTION update_pet_care_updated_at();

CREATE TRIGGER update_pet_care_requests_updated_at
    BEFORE UPDATE ON pet_care_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_pet_care_updated_at();

CREATE TRIGGER update_pet_care_responses_updated_at
    BEFORE UPDATE ON pet_care_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_pet_care_updated_at();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Pet care schema created successfully
-- Tables: pets, pet_group_members, scheduled_pet_care,
--         scheduled_pet_care_pets, pet_care_requests, pet_care_responses
-- All tables have RLS policies enabled
-- Indexes created for optimal query performance
-- Triggers set up for automatic timestamp updates
