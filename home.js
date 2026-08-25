"use strict";

document.addEventListener("DOMContentLoaded", async () => {

    const supabaseClient = window.supabaseClient;

    if (!supabaseClient) {
        console.error("Supabase غير متصل");
        return;
    }

    // =========================================
    // عناصر الصفحة
    // =========================================

    const studentName =
        document.getElementById("studentName");

    const studentGrade =
        document.getElementById("studentGrade");

    const studentCity =
        document.getElementById("studentCity");

    const studentSchool =
        document.getElementById("studentSchool");

    const studentPhoto =
        document.getElementById("studentPhoto");

    const errorElement =
        document.getElementById("errorMessage");

    const testsBtn =
        document.getElementById("testsBtn");

    const logoutBtn =
        document.getElementById("logoutBtn");


    // =========================================
    // إظهار الخطأ
    // =========================================

    function showError(message) {

        if (errorElement) {

            errorElement.textContent = message;

            errorElement.style.display = "block";

        } else {

            console.error(message);

        }

    }


    // =========================================
    // عرض بيانات الطالب
    // =========================================

    function displayStudent(student) {

        if (!student) {
            showError("بيانات الطالب غير موجودة.");
            return;
        }


        // الاسم
        if (studentName) {

            studentName.textContent =
                student.full_name || "الطالب";

        }


        // الصف
        if (studentGrade) {

            studentGrade.textContent =
                student.grade || "غير محدد";

        }


        // المدينة
        if (studentCity) {

            studentCity.textContent =
                student.city || "";

        }


        // المدرسة
        if (studentSchool) {

            studentSchool.textContent =
                student.school || "";

        }


        // الصورة
        if (
            studentPhoto &&
            student.photo_url
        ) {

            studentPhoto.src =
                student.photo_url;

        }


        console.log(
            "بيانات الطالب:",
            student
        );

    }


    // =========================================
    // تحميل بيانات الطالب
    // =========================================

    async function loadStudent() {

        try {

            // ---------------------------------
            // الحصول على الجلسة الحالية
            // ---------------------------------

            const {
                data: {
                    session
                },
                error: sessionError
            } =
                await supabaseClient.auth.getSession();


            if (sessionError) {

                console.error(
                    "Session Error:",
                    sessionError
                );

                showError(
                    "تعذر التحقق من تسجيل الدخول."
                );

                return;

            }


            // ---------------------------------
            // لا يوجد تسجيل دخول
            // ---------------------------------

            if (!session || !session.user) {

                console.log(
                    "لا توجد جلسة تسجيل دخول"
                );

                location.replace(
                    "auth.html"
                );

                return;

            }


            const userId =
                session.user.id;


            console.log(
                "User ID:",
                userId
            );


            // ---------------------------------
            // جلب بيانات الطالب
            // ---------------------------------

            const {
                data: student,
                error: studentError
            } =
                await supabaseClient
                    .from("students")
                    .select(`
                        id,
                        full_name,
                        phone,
                        parent_phone,
                        grade,
                        city,
                        school,
                        governorate,
                        photo_url
                    `)
                    .eq(
                        "id",
                        userId
                    )
                    .maybeSingle();


            // ---------------------------------
            // خطأ قاعدة البيانات
            // ---------------------------------

            if (studentError) {

                console.error(
                    "Student Error:",
                    studentError
                );

                showError(
                    "تعذر تحميل بيانات الطالب."
                );

                return;

            }


            // ---------------------------------
            // الطالب غير موجود
            // ---------------------------------

            if (!student) {

                console.error(
                    "لا يوجد طالب بهذا الـ ID:",
                    userId
                );

                showError(
                    "بيانات الطالب غير موجودة."
                );

                return;

            }


            // ---------------------------------
            // عرض البيانات
            // ---------------------------------

            displayStudent(student);


        } catch (error) {

            console.error(
                "LOAD STUDENT ERROR:",
                error
            );

            showError(
                "حدث خطأ أثناء تحميل بيانات الطالب."
            );

        }

    }


    // =========================================
    // زر الاختبارات
    // =========================================

    if (testsBtn) {

        testsBtn.addEventListener(
            "click",
            () => {

                location.href =
                    "tests.html";

            }
        );

    }


    // =========================================
    // تسجيل الخروج
    // =========================================

    if (logoutBtn) {

        logoutBtn.addEventListener(
            "click",
            async () => {

                try {

                    logoutBtn.disabled = true;

                    const {
                        error
                    } =
                        await supabaseClient
                            .auth
                            .signOut();

                    if (error) {

                        console.error(
                            "Logout Error:",
                            error
                        );

                        logoutBtn.disabled =
                            false;

                        return;

                    }

                    location.replace(
                        "auth.html"
                    );

                } catch (error) {

                    console.error(
                        error
                    );

                    logoutBtn.disabled =
                        false;

                }

            }
        );

    }


    // =========================================
    // تشغيل تحميل الطالب
    // =========================================

    await loadStudent();

});
