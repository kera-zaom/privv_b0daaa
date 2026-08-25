"use strict";

document.addEventListener("DOMContentLoaded", async () => {

    const supabaseClient = window.supabaseClient;

    if (!supabaseClient) {
        location.href = "../auth.html";
        return;
    }

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
        location.href = "../auth.html";
        return;
    }

    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile) {
        alert("تعذر التحقق من صلاحيات الحساب.");
        await supabaseClient.auth.signOut();
        location.href = "../auth.html";
        return;
    }

    if (profile.role !== "admin") {
        alert("ليس لديك صلاحية دخول لوحة الإدارة.");
        location.href = "../home.html";
        return;
    }

    const adminName =
        document.getElementById("adminName");

    if (adminName) {
        adminName.textContent =
            profile.full_name || "المسؤول";
    }

    const logoutBtn =
        document.getElementById("logoutBtn");

    if (logoutBtn) {

        logoutBtn.addEventListener("click", async () => {

            await supabaseClient.auth.signOut();

            location.href = "../auth.html";

        });

    }

});
