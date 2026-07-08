/* =========================================================
 *  SUPABASE CONFIG — HSE Webapp
 *  Nạp thư viện supabase-js qua CDN ESM (không cần build step)
 *  và tạo client dùng chung cho toàn app.
 *
 *  CÁCH DÙNG (thêm vào TRƯỚC db.js / bhld-sync.js / app.js trong mỗi trang HTML):
 *    <script type="module" src="assets/supabase-config.js"></script>
 *
 *  Sau khi client sẵn sàng, module gán:
 *    window.HSE_SB          → supabase client
 *    window.HSE_SB_READY    → Promise resolve khi client sẵn sàng
 *  và phát sự kiện 'hse-sb-ready' trên window.
 *
 *  ⚠️  anon key nằm CÔNG KHAI ở frontend là bình thường với Supabase —
 *     bảo mật do RLS ở server đảm nhiệm (xem supabase/schema.sql).
 * ========================================================= */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════
//  ⚙️  DÁN THÔNG TIN PROJECT SUPABASE VÀO ĐÂY
//     Dashboard → Project Settings → Data API / API Keys
// ═══════════════════════════════════════════════════════════
const SUPABASE_URL      = "https://wvohlxxeatwirbusbtnj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_eCNPCoifzbMRnRTyHBtI1Q_f8yMQb8k";

// Domain email THẬT của công ty — username (VD "sonlhh.sd") được map thành
// email đăng nhập "sonlhh.sd@vietsov.com.vn" để nhận được mail đặt lại mật khẩu.
// (Người dùng vẫn đăng nhập bằng username như cũ; nếu nhập email đầy đủ cũng chấp nhận.)
export const HSE_EMAIL_DOMAIN = "vietsov.com.vn";

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,       // giữ phiên trong localStorage
    autoRefreshToken: true,
    storageKey: "hse_sb_auth",
    detectSessionInUrl: true,   // nhận token khi mở link đặt lại mật khẩu từ email
    flowType: "pkce"
  }
});

// Cảnh báo nếu quên cấu hình
if (SUPABASE_URL.includes("YOUR-PROJECT-REF")) {
  console.warn("[HSE] Chưa cấu hình assets/supabase-config.js — hãy dán Project URL và anon key.");
}

window.HSE_SB = client;
window.HSE_EMAIL_DOMAIN = HSE_EMAIL_DOMAIN;
window.HSE_SB_READY = Promise.resolve(client);
window.dispatchEvent(new CustomEvent("hse-sb-ready", { detail: client }));

export default client;
