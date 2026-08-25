// ======================================================
// SUPABASE CONNECTION
// منصة الخوارزمي
// ======================================================

"use strict";


// ======================================================
// SUPABASE PROJECT
// ======================================================

const SUPABASE_URL =
    "https://fdqolsygigqukejlwcon.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_fO1Xb-dtqq8rnGuvXcPahg_zz9WeW9x";


// ======================================================
// CREATE CLIENT
// ======================================================

let supabaseClient = null;

try {

    if (
        typeof window.supabase === "undefined"
    ) {

        console.error(
            "❌ Supabase JS Library غير موجودة."
        );

    } else {

        supabaseClient =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_PUBLISHABLE_KEY
            );

        console.log(
            "✅ Supabase connected successfully."
        );

    }

} catch (error) {

    console.error(
        "❌ Supabase connection error:",
        error
    );

}


// ======================================================
// GLOBAL CONFIG
// ======================================================

window.SUPABASE_URL =
    SUPABASE_URL;

window.SUPABASE_PUBLISHABLE_KEY =
    SUPABASE_PUBLISHABLE_KEY;

window.supabaseClient =
    supabaseClient;


// ======================================================
// CHECK CONNECTION
// ======================================================

async function checkSupabaseConnection() {

    if (!supabaseClient) {

        return {
            connected: false,
            error: "Supabase client غير موجود"
        };

    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("students")
            .select("id")
            .limit(1);


        if (error) {

            console.error(
                "❌ Supabase Database Error:",
                error
            );

            return {
                connected: false,
                error: error
            };

        }


        console.log(
            "✅ Supabase Database is working."
        );


        return {
            connected: true,
            data: data
        };

    } catch (error) {

        console.error(
            "❌ Supabase Check Error:",
            error
        );

        return {
            connected: false,
            error: error
        };

    }

}


// ======================================================
// EXPORT CHECK FUNCTION
// ======================================================

window.checkSupabaseConnection =
    checkSupabaseConnection;