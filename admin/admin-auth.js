"use strict";

window.ADMIN_AUTH = {

    client: null,
    user: null,

    async init() {

        if (!window.supabaseClient) {
            throw new Error(
                "Supabase غير متصل. تأكد من ../supabase.js"
            );
        }

        this.client = window.supabaseClient;

        const {
            data,
            error
        } = await this.client.auth.getSession();

        if (error) {
            throw new Error(
                "خطأ في جلسة الدخول: " +
                error.message
            );
        }

        if (
            !data ||
            !data.session ||
            !data.session.user
        ) {
            window.location.replace("../auth.html");
            return false;
        }

        this.user = data.session.user;

        console.log(
            "CURRENT USER:",
            this.user.id
        );

        const {
            data: roleData,
            error: roleError
        } = await this.client
            .from("user_roles")
            .select("user_id, role")
            .eq("user_id", this.user.id)
            .maybeSingle();

        if (roleError) {
            throw new Error(
                "خطأ في قراءة صلاحيات الأدمن: " +
                roleError.message
            );
        }

        if (
            !roleData ||
            String(roleData.role).toLowerCase() !== "admin"
        ) {
            throw new Error(
                "هذا الحساب ليس لديه صلاحية Admin."
            );
        }

        console.log("ADMIN VERIFIED");

        return true;
    },

    async logout() {

        try {

            if (this.client) {
                await this.client.auth.signOut();
            }

        } catch (error) {

            console.error(
                "LOGOUT ERROR:",
                error
            );

        }

        window.location.replace("../auth.html");
    }
};
