-- Fix child_group_members table schema issue
-- Run this in your Supabase SQL Editor

-- Step 1: Add the missing added_by column if it doesn't exist
DO $$
BEGIN
    -- Check if added_by column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'child_group_members' 
        AND table_schema = 'public' 
        AND column_name = 'added_by'
    ) THEN
        -- Add the added_by column
        ALTER TABLE public.child_group_members 
        ADD COLUMN added_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added added_by column to child_group_members table';
    ELSE
        RAISE NOTICE 'added_by column already exists in child_group_members table';
    END IF;
    
    -- Check if added_at column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'child_group_members' 
        AND table_schema = 'public' 
        AND column_name = 'added_at'
    ) THEN
        -- Add the added_at column
        ALTER TABLE public.child_group_members 
        ADD COLUMN added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
        
        RAISE NOTICE 'Added added_at column to child_group_members table';
    ELSE
        RAISE NOTICE 'added_at column already exists in child_group_members table';
    END IF;
END $$;

-- Step 2: Update existing records to have added_by if the column was just added
UPDATE public.child_group_members 
SET added_by = (
    SELECT parent_id 
    FROM public.children 
    WHERE children.id = child_group_members.child_id
)
WHERE added_by IS NULL;

-- Step 3: Show the final table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'child_group_members' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Success message
SELECT 'child_group_members table schema has been fixed! The added_by column is now available.' as status; 