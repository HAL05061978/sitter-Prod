-- Create schools table
-- This table stores schools with their associated ZIP codes and locations

CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    town TEXT NOT NULL,
    state TEXT DEFAULT 'CT',
    address TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on zip_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_schools_zip_code ON schools(zip_code);

-- Create index on name for search
CREATE INDEX IF NOT EXISTS idx_schools_name ON schools(name);

-- Enable RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users (including anonymous) to read schools
-- Schools are public reference data that should be accessible during signup
CREATE POLICY "Allow all users to read schools"
    ON schools
    FOR SELECT
    TO public
    USING (true);

-- Create policy to allow service role to insert/update schools
CREATE POLICY "Allow service role to manage schools"
    ON schools
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Add some sample schools (you can expand this list)
INSERT INTO schools (name, zip_code, town, state, address) VALUES
    ('Tashua Elementary School', '06611', 'Trumbull', 'CT', '52 Firetown Road'),
    ('Daniels Farm Elementary School', '06611', 'Trumbull', 'CT', '1460 Daniels Farm Road'),
    ('Frenchtown Elementary School', '06611', 'Trumbull', 'CT', '32 Stonehouse Road'),
    ('Middlebrook Elementary School', '06611', 'Trumbull', 'CT', '150 Middlebrooks Avenue'),
    ('Booth Hill Elementary School', '06611', 'Trumbull', 'CT', '74 Strobel Road'),
    ('Jane Ryan Elementary School', '06611', 'Trumbull', 'CT', '370 Daniels Farm Road'),
    ('Trumbull High School', '06611', 'Trumbull', 'CT', '72 Strobel Road'),
    ('Madison Middle School', '06611', 'Trumbull', 'CT', '41 Waterhouse Road'),
    ('Hillcrest Middle School', '06611', 'Trumbull', 'CT', '300 White Plains Road')
ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_schools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER schools_updated_at_trigger
    BEFORE UPDATE ON schools
    FOR EACH ROW
    EXECUTE FUNCTION update_schools_updated_at();
