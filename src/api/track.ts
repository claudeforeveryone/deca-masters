// The app's analytics tracker: src/lib/analytics.ts bound to the Supabase client. Fire and forget, never throws.
//   track("resource_opened", "PMK", { source: "official_sample" })
//   track("practice_started", "PMK", { mode: "roleplay" })   // role-play trainer start
//   track("practice_started", "marketing", { mode: "vocab" }) // vocab session start
import { makeTracker } from "../lib/analytics";
import { supabase } from "../lib/supabase";

export const track = makeTracker({
  rpc: (fn, args) => supabase.rpc(fn, args),
  signedIn: async () => {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  },
});
