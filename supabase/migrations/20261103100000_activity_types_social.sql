-- Phase 4: two new activity types for follow requests. This is its own migration because a new
-- enum value cannot be used in the transaction that adds it; the follows migration that comes
-- next writes both.
--   follow_requested: someone asked to follow a private account (target_user_id = the account)
--   follow_accepted:  the account said yes (actor_id = the account, target_user_id = the asker)
alter type public.activity_type add value 'follow_requested';
alter type public.activity_type add value 'follow_accepted';
