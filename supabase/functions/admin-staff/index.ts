import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type StaffRole = "case_officer" | "evidence_checker" | "system_admin";

type RequestBody =
  | {
      action: "create";
      fullName: string;
      email: string;
      role: StaffRole;
      password: string;
      department?: string;
      phone?: string;
      isActive?: boolean;
    }
  | {
      action: "set_active";
      staffId: string;
      isActive: boolean;
      reason?: string;
    };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function databaseRole(role: StaffRole) {
  return role === "evidence_checker" ? "evidence_validator" : role;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(
      { error: "Supabase function secrets are not configured." },
      500,
    );
  }

  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Authentication is required." }, 401);
  }

  const token = authorization.slice("Bearer ".length);
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await authClient.auth.getUser(token);

  if (callerError || !caller) {
    return json({ error: "Your session is invalid or expired." }, 401);
  }

  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, email, role, is_active, status")
    .eq("id", caller.id)
    .single();

  if (
    profileError ||
    !callerProfile ||
    callerProfile.role !== "system_admin" ||
    callerProfile.is_active === false ||
    callerProfile.status === "inactive" ||
    callerProfile.status === "suspended"
  ) {
    return json(
      { error: "Only an active System Administrator can do this." },
      403,
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return json({ error: "The request body is not valid JSON." }, 400);
  }

  if (body.action === "create") {
    const fullName = body.fullName?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const allowedRoles: StaffRole[] = [
      "case_officer",
      "evidence_checker",
      "system_admin",
    ];

    if (!fullName || fullName.length < 2) {
      return json(
        { error: "Full name must contain at least 2 characters." },
        400,
      );
    }
    if (!email || !validEmail(email)) {
      return json({ error: "Enter a valid work email address." }, 400);
    }
    if (!allowedRoles.includes(body.role)) {
      return json({ error: "Select a valid staff role." }, 400);
    }
    if (password.length < 6) {
      return json(
        { error: "Temporary password must contain at least 6 characters." },
        400,
      );
    }

    const { data: existing } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return json(
        { error: "An account already uses this email address." },
        409,
      );
    }

    const isActive = body.isActive !== false;
    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (createError || !created.user) {
      return json(
        { error: createError?.message ?? "Unable to create the Auth user." },
        400,
      );
    }

    const userId = created.user.id;
    const { data: profile, error: updateError } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: userId,
          email,
          full_name: fullName,
          role: databaseRole(body.role),
          department: body.department?.trim() || null,
          phone: body.phone?.trim() || null,
          is_active: isActive,
          status: isActive ? "active" : "inactive",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select(
        "id, email, full_name, role, department, phone, is_active, status, created_at, updated_at",
      )
      .single();

    if (updateError || !profile) {
      await adminClient.auth.admin.deleteUser(userId);
      return json(
        {
          error: updateError?.message ?? "Unable to create the staff profile.",
        },
        400,
      );
    }

    if (!isActive) {
      await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: "876000h",
      });
    }

    const { error: auditError } = await adminClient
      .from("staff_audit_logs")
      .insert({
        event_type: "ACCOUNT_CREATED",
        actor_id: caller.id,
        actor_email: callerProfile.email || caller.email,
        actor_role: "system_admin",
        target_user_id: userId,
        target_user_email: email,
        action: "STAFF_CREATE",
        description: `Created staff account for ${fullName}.`,
        details: {
          role: body.role,
          department: body.department?.trim() || null,
          isActive,
        },
      });

    if (auditError) {
      console.error("Audit insert failed:", auditError.message);
    }

    return json({ staff: profile }, 201);
  }

  if (body.action === "set_active") {
    if (!body.staffId) {
      return json({ error: "A staff account id is required." }, 400);
    }
    if (body.staffId === caller.id && !body.isActive) {
      return json(
        { error: "You cannot suspend your own administrator account." },
        400,
      );
    }

    const { data: target, error: targetError } = await adminClient
      .from("profiles")
      .select("id, email, full_name, role, is_active, status")
      .eq("id", body.staffId)
      .single();

    if (targetError || !target) {
      return json({ error: "Staff account not found." }, 404);
    }

    const { error: authUpdateError } =
      await adminClient.auth.admin.updateUserById(body.staffId, {
        ban_duration: body.isActive ? "none" : "876000h",
      });

    if (authUpdateError) {
      return json({ error: authUpdateError.message }, 400);
    }

    const status = body.isActive ? "active" : "suspended";
    const { data: updated, error: profileUpdateError } = await adminClient
      .from("profiles")
      .update({
        is_active: body.isActive,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.staffId)
      .select(
        "id, email, full_name, role, department, phone, is_active, status, created_at, updated_at",
      )
      .single();

    if (profileUpdateError || !updated) {
      return json(
        {
          error: profileUpdateError?.message ?? "Unable to update the profile.",
        },
        400,
      );
    }

    const action = body.isActive ? "STAFF_ACTIVATE" : "STAFF_DEACTIVATE";
    const { error: auditError } = await adminClient
      .from("staff_audit_logs")
      .insert({
        event_type: body.isActive ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED",
        actor_id: caller.id,
        actor_email: callerProfile.email || caller.email,
        actor_role: "system_admin",
        target_user_id: target.id,
        target_user_email: target.email,
        action,
        description: `${body.isActive ? "Activated" : "Suspended"} staff account for ${target.full_name || target.email}.`,
        details: {
          previousStatus: target.status,
          newStatus: status,
          reason: body.reason?.trim() || "Administrative action",
        },
      });

    if (auditError) {
      console.error("Audit insert failed:", auditError.message);
    }

    return json({ staff: updated });
  }

  return json({ error: "Unsupported action." }, 400);
});
