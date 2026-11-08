import { supabase } from "../lib/supabase";

export async function logAudit({
  action,
  category = "system",
  description,
  status = "success",
  entityType = null,
  entityId = null,
  amount = null,
  currency = "NGN",
  details = {},
}) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: userError || new Error("User not authenticated") };
    }

    const { error } = await supabase.from("uptrend_audit_logs").insert({
      user_id: user.id,
      actor_email: user.email ?? null,
      action,
      category,
      description,
      status,
      entity_type: entityType,
      entity_id: entityId,
      amount,
      currency,
      details,
    });

    if (error) {
      console.error("Audit log failed:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error("Audit log failed:", error);
    return { success: false, error };
  }
}
