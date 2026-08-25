"use strict";

document.addEventListener("DOMContentLoaded", async () => {

    const loading = document.getElementById("loading");
    const empty = document.getElementById("empty");
    const errorBox = document.getElementById("error");
    const grid = document.getElementById("testsGrid");
    const gradeElement = document.getElementById("studentGrade");

    function showError(message) {

        if (loading) {
            loading.style.display = "none";
        }

        if (empty) {
            empty.style.display = "none";
        }

        if (errorBox) {
            errorBox.style.display = "block";
            errorBox.textContent = message;
        }

        console.error("TESTS ERROR:", message);
    }

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    try {

        // ==========================================
        // SUPABASE
        // ==========================================

        const supabaseClient =
            window.supabaseClient;

        if (!supabaseClient) {

            showError(
                "Supabase غير متصل. تأكد من ملف js/supabase.js"
            );

            return;
        }


        // ==========================================
        // المستخدم الحالي
        // ==========================================

        const {
            data: {
                user
            },
            error: userError
        } =
        await supabaseClient.auth.getUser();

        if (userError) {
            throw userError;
        }

        if (!user) {

            location.href = "auth.html";

            return;
        }


        // ==========================================
        // بيانات الطالب
        // ==========================================

        let student = null;


        /*
         * أولاً نحاول id
         */
        const {
            data: studentById,
            error: idError
        } =
        await supabaseClient
            .from("students")
            .select("full_name, grade, id")
            .eq("id", user.id)
            .maybeSingle();


        if (!idError && studentById) {

            student = studentById;

        } else {

            /*
             * لو قاعدة البيانات تستخدم user_id
             */
            const {
                data: studentByUserId,
                error: userIdError
            } =
            await supabaseClient
                .from("students")
                .select("full_name, grade, user_id")
                .eq("user_id", user.id)
                .maybeSingle();


            if (!userIdError && studentByUserId) {

                student = studentByUserId;

            }
        }


        if (!student) {

            showError(
                "لم يتم العثور على بيانات الطالب في قاعدة البيانات."
            );

            return;
        }


        // ==========================================
        // الصف
        // ==========================================

        const studentGrade =
            String(student.grade || "").trim();

        if (gradeElement) {

            gradeElement.textContent =
                `الصف: ${
                    studentGrade || "غير محدد"
                }`;

        }


        // ==========================================
        // تحميل الاختبارات
        // ==========================================

        let query =
            supabaseClient
                .from("exams")
                .select(`
                    id,
                    title,
                    description,
                    grade,
                    duration_minutes,
                    duration,
                    exam_code,
                    is_active,
                    created_at
                `)
                .eq("is_active", true);


        /*
         * عرض اختبارات صف الطالب فقط
         */
        if (studentGrade) {

            query =
                query.eq(
                    "grade",
                    studentGrade
                );

        }


        const {
            data: exams,
            error: examsError
        } =
        await query.order(
            "created_at",
            {
                ascending: false
            }
        );


        if (examsError) {
            throw examsError;
        }


        if (loading) {
            loading.style.display = "none";
        }


        // ==========================================
        // لا توجد اختبارات
        // ==========================================

        if (!exams || exams.length === 0) {

            if (empty) {
                empty.style.display = "block";
            }

            return;
        }


        // ==========================================
        // عرض الاختبارات
        // ==========================================

        grid.innerHTML = "";

        exams.forEach(exam => {

            const card =
                document.createElement("div");

            card.className = "card";


            const duration =
                exam.duration_minutes ||
                exam.duration ||
                30;


            card.innerHTML = `

                <h2>
                    ${escapeHTML(
                        exam.title || "اختبار"
                    )}
                </h2>

                <div class="description">
                    ${escapeHTML(
                        exam.description ||
                        "اختبار رياضيات"
                    )}
                </div>

                <div class="info">

                    <span class="badge">
                        ⏱ ${duration} دقيقة
                    </span>

                    <span class="badge">
                        📚 ${escapeHTML(
                            exam.grade || studentGrade
                        )}
                    </span>

                    ${
                        exam.exam_code
                        ? `
                            <span class="badge">
                                🔑 ${escapeHTML(
                                    exam.exam_code
                                )}
                            </span>
                        `
                        : ""
                    }

                </div>

                <button
                    class="start"
                    type="button"
                    data-id="${escapeHTML(exam.id)}"
                >
                    بدء الاختبار
                </button>

            `;


            const button =
                card.querySelector(".start");


            button.addEventListener(
                "click",
                () => {

                    const examId =
                        button.dataset.id;

                    if (!examId) {

                        alert(
                            "معرف الاختبار غير موجود."
                        );

                        return;
                    }


                    /*
                     * الانتقال إلى صفحة الاختبار
                     */
                    window.location.href =
                        "./exam.html?id=" +
                        encodeURIComponent(
                            examId
                        );

                }
            );


            grid.appendChild(card);

        });


    } catch (error) {

        console.error(
            "LOAD TESTS ERROR:",
            error
        );

        showError(
            "فشل تحميل الاختبارات:\n\n" +
            (
                error?.message ||
                "خطأ غير معروف"
            )
        );

    }

});
