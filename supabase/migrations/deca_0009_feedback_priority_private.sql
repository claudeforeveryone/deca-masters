-- deca_0009 A member no longer reads the priority an owner sets on their report. Ledger name:
-- deca_0009_feedback_priority_private.
--
-- deca_0005 granted members select on every report column except reviewed_by, which included priority. FBLA (fbla
-- migration 0103) keeps priority to owners: a member sees their report, its status and the team's note, not how
-- urgent the team rated it. Owners still read and set priority through deca_owner_feedback_list and
-- deca_owner_feedback_update (definer functions, unaffected). Nothing else changes.
revoke select (priority) on public.deca_feedback from authenticated;
