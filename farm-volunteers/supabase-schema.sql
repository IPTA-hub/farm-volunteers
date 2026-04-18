-- Run this entire file in your Supabase SQL editor (supabase.com > your project > SQL Editor)

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE profiles (
  id                  UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name           TEXT NOT NULL,
  phone               TEXT,
  role                TEXT NOT NULL DEFAULT 'volunteer' CHECK (role IN ('admin', 'volunteer')),
  email_notifications BOOLEAN DEFAULT TRUE,
  sms_notifications   BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shifts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type            TEXT NOT NULL CHECK (type IN ('sidewalking', 'horse_assisting', 'events', 'weekend_care')),
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  slots_available INTEGER NOT NULL DEFAULT 1 CHECK (slots_available > 0),
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shift_signups (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id     UUID REFERENCES shifts(id) ON DELETE CASCADE,
  volunteer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (shift_id, volunteer_id)
);

-- ─── Trigger: auto-create profile on sign-up ──────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_signups ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can read their own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- shifts
CREATE POLICY "Authenticated users can view shifts"
  ON shifts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert shifts"
  ON shifts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update shifts"
  ON shifts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete shifts"
  ON shifts FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- shift_signups
CREATE POLICY "Volunteers can view their own signups"
  ON shift_signups FOR SELECT USING (auth.uid() = volunteer_id);

CREATE POLICY "Admins can view all signups"
  ON shift_signups FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Volunteers can sign up"
  ON shift_signups FOR INSERT WITH CHECK (auth.uid() = volunteer_id);

CREATE POLICY "Admins can update signups"
  ON shift_signups FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── Make someone an admin ────────────────────────────────────────────────────
-- After someone registers, run this in the SQL editor to promote them:
-- UPDATE profiles SET role = 'admin' WHERE id = 'their-user-uuid';
-- (find the UUID in Supabase > Authentication > Users)
