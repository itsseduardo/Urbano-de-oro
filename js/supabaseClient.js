import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://derdvczgpllqrufrbiao.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlcmR2Y3pncGxscXJ1ZnJiaWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjU0NjMsImV4cCI6MjA3MzUwMTQ2M30.vqKxFGP_iQBuwAu8b37fmOuv4l-eTIS6e8WIqe6S2q0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);