-- Create matching_patterns table for learning from successful connections
CREATE TABLE IF NOT EXISTS public.matching_patterns (
  id BIGSERIAL PRIMARY KEY,
  user_a_id UUID REFERENCES auth.users(id) NOT NULL,
  user_b_id UUID REFERENCES auth.users(id) NOT NULL,
  user_a_favorites TEXT[] NOT NULL,
  user_b_favorites TEXT[] NOT NULL,
  match_score INTEGER NOT NULL,
  exact_matches TEXT[] DEFAULT '{}',
  related_matches JSONB DEFAULT '[]',
  vibe_match BOOLEAN DEFAULT FALSE,
  user_a_vibe TEXT,
  user_b_vibe TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Track conversation success
  message_count INTEGER DEFAULT 0,
  conversation_days INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  -- Track if this was a successful connection
  is_successful BOOLEAN DEFAULT FALSE,
  success_metrics JSONB DEFAULT '{}'
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_matching_patterns_users ON public.matching_patterns(user_a_id, user_b_id);
CREATE INDEX IF NOT EXISTS idx_matching_patterns_score ON public.matching_patterns(match_score);
CREATE INDEX IF NOT EXISTS idx_matching_patterns_created ON public.matching_patterns(created_at);

-- RLS Policies for matching_patterns
ALTER TABLE public.matching_patterns ENABLE ROW LEVEL SECURITY;

-- Users can view patterns involving themselves
CREATE POLICY "matching_patterns_select" ON public.matching_patterns
  FOR SELECT USING (
    auth.uid() = user_a_id OR 
    auth.uid() = user_b_id
  );

-- Users can insert patterns when they match
CREATE POLICY "matching_patterns_insert" ON public.matching_patterns
  FOR INSERT WITH CHECK (
    auth.uid() = user_a_id OR 
    auth.uid() = user_b_id
  );

-- Users can update patterns they're involved in (for tracking success)
CREATE POLICY "matching_patterns_update" ON public.matching_patterns
  FOR UPDATE USING (
    auth.uid() = user_a_id OR 
    auth.uid() = user_b_id
  );

-- Function to track successful patterns
CREATE OR REPLACE FUNCTION track_successful_pattern()
RETURNS TRIGGER AS $$
BEGIN
  -- Update conversation metrics when messages are sent
  IF TG_TABLE_NAME = 'messages' THEN
    UPDATE public.matching_patterns 
    SET 
      message_count = message_count + 1,
      last_message_at = NEW.created_at,
      conversation_days = EXTRACT(DAY FROM (NEW.created_at - created_at))
    WHERE 
      (user_a_id = NEW.sender_id OR user_b_id = NEW.sender_id)
      AND created_at >= NOW() - INTERVAL '30 days';
    
    -- Mark as successful if they've exchanged 10+ messages
    UPDATE public.matching_patterns 
    SET 
      is_successful = TRUE,
      success_metrics = jsonb_set(
        COALESCE(success_metrics, '{}'),
        '{message_count}',
        to_jsonb(message_count)
      )
    WHERE 
      message_count >= 10
      AND (user_a_id = NEW.sender_id OR user_b_id = NEW.sender_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track message success
CREATE TRIGGER track_message_success
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION track_successful_pattern();

-- Function to get pattern insights (for admin use)
CREATE OR REPLACE FUNCTION get_pattern_insights()
RETURNS TABLE (
  pattern_type TEXT,
  success_rate DECIMAL,
  avg_messages DECIMAL,
  sample_size INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH pattern_analysis AS (
    SELECT 
      CASE 
        WHEN array_length(exact_matches, 1) > 0 THEN 'exact_match'
        WHEN vibe_match THEN 'vibe_match'
        WHEN match_score >= 65 THEN 'high_score'
        WHEN match_score <= 15 THEN 'opposites_attract'
        ELSE 'regular_match'
      END as pattern_type,
      is_successful,
      message_count
    FROM public.matching_patterns
    WHERE created_at >= NOW() - INTERVAL '90 days'
  )
  SELECT 
    pa.pattern_type,
    ROUND(
      (COUNT(*) FILTER (WHERE pa.is_successful)::DECIMAL / COUNT(*)) * 100, 
      2
    ) as success_rate,
    ROUND(AVG(pa.message_count), 1) as avg_messages,
    COUNT(*)::INTEGER as sample_size
  FROM pattern_analysis pa
  GROUP BY pa.pattern_type
  ORDER BY success_rate DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_pattern_insights() TO authenticated;