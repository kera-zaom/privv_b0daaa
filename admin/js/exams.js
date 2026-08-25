"use strict";

document.addEventListener("DOMContentLoaded", async () => {

    const supabaseClient =
        window.supabaseClient;

    if (!supabaseClient) {
        return;
    }


    const form =
        document.getElementById("examForm");

    const teacherSelect =
        document.getElementById("teacher");

    const message =
        document.getElementById("message");

    const submitBtn =
        document.getElementById("submitBtn");


    // ==========================================
    // تحميل المدرسين
    // ==========================================

    const {
        data: teachers,
        error: teachersError
    } =
        await supabaseClient
            .from("teachers")
            .select("id, name")
            .eq("is_active", true)
            .order("name");


    if (!teachersError && teachers) {

        teachers.forEach(teacher => {

            const option =
                document.createElement("option");

            option.value =
                teacher.id;

            option.textContent =
                teacher.name;

            teacherSelect.appendChild(option);

        });

    }


    // ==========================================
    // إنشاء الاختبار
    // ==========================================

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const title =
                document
                    .getElementById("title")
                    .value
                    .trim();


            const description =
                document
                    .getElementById("description")
                    .value
                    .trim();


            const grade =
                document
                    .getElementById("grade")
                    .value;


            const duration =
                Number(
                    document
                        .getElementById("duration")
                        .value
                );


            const teacherId =
                teacherSelect.value || null;


            if (!title) {

                showMessage(
                    "اكتب اسم الاختبار."
                );

                return;
            }


            if (!grade) {

                showMessage(
                    "اختر الصف الدراسي."
                );

                return;
            }


            if (!duration || duration < 1) {

                showMessage(
                    "مدة الاختبار غير صحيحة."
                );

                return;
            }


            submitBtn.disabled = true;

            submitBtn.textContent =
                "جاري إنشاء الاختبار...";


            const {
                data,
                error
            } =
                await supabaseClient
                    .from("exams")
                    .insert({

                        title,

                        description,

                        grade,

                        duration_minutes:
                            duration,

                        teacher_id:
                            teacherId,

                        is_active:
                            true

                    })
                    .select()
                    .single();


            if (error) {

                console.error(error);

                showMessage(
                    "حدث خطأ: " +
                    error.message
                );

                submitBtn.disabled = false;

                submitBtn.textContent =
                    "إنشاء الاختبار";

                return;
            }


            showMessage(
                "✅ تم إنشاء الاختبار بنجاح."
            );


            form.reset();


            document
                .getElementById("duration")
                .value = 30;


            submitBtn.disabled = false;

            submitBtn.textContent =
                "إنشاء الاختبار";


            setTimeout(() => {

                location.href =
                    `questions.html?exam=${encodeURIComponent(data.id)}`;

            }, 800);

        }
    );


    function showMessage(text) {

        message.style.display =
            "block";

        message.textContent =
            text;

    }

});
