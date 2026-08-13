import { createClient } from '@supabase/supabase-js';

// ===== Supabase 云端数据库配置 =====
// Project URL（已去掉 /rest/v1/ 后缀）
const SUPABASE_URL = 'https://yigtntahxnrnrrwgnars.supabase.co';
// anon / publishable 公钥（前端可用，仅用于基础数据访问）
const SUPABASE_ANON_KEY = 'sb_publishable_6yGVfnZtZPyXVJ6eCqp1dQ_TQ4MuUAn';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
