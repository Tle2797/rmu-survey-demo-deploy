// client/app/login/page.tsx
"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { getThaiAlertMessage } from "@/lib/alert-message";
import {
  containsThaiCharacters,
  sanitizeUsernameInput,
  USERNAME_THAI_VALIDATION_MESSAGE,
} from "@/lib/username";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, User, UserPlus } from "lucide-react";
import Swal from "sweetalert2";

type LoginRes = {
  token: string;
  user: {
    id: number;
    username: string;
    role: "admin" | "exec" | "dept_head" | "staff";
    departmentId: number | null;
  };
};

function resolveHome(
  role: LoginRes["user"]["role"],
  departmentId: number | null,
) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "exec") return "/exec/dashboard";
  if (role === "dept_head" || role === "staff") {
    return `/dashboard/department/${departmentId}`;
  }
  return "/";
}

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      await Swal.fire({
        icon: "warning",
        title: "กรอกข้อมูลไม่ครบ",
        text: "กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน",
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
      return;
    }

    if (containsThaiCharacters(trimmedUsername)) {
      await Swal.fire({
        icon: "warning",
        title: "กรอกชื่อผู้ใช้ไม่ถูกต้อง",
        text: getThaiAlertMessage(
          USERNAME_THAI_VALIDATION_MESSAGE,
          "ชื่อผู้เข้าใช้งานระบบห้ามกรอกภาษาไทย",
        ),
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await apiPost<LoginRes>("/api/auth/login", {
        username: trimmedUsername,
        password,
      });

      localStorage.setItem("token", res.token);

      await Swal.fire({
        icon: "success",
        title: "เข้าสู่ระบบสำเร็จ",
        text: "กำลังนำคุณไปยังหน้าหลักของระบบ",
        timer: 1200,
        showConfirmButton: false,
      });

      router.replace(resolveHome(res.user.role, res.user.departmentId));
    } catch (err: unknown) {
      await Swal.fire({
        icon: "error",
        title: "เข้าสู่ระบบไม่สำเร็จ",
        text: getThaiAlertMessage(err, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"),
        confirmButtonText: "ลองอีกครั้ง",
        confirmButtonColor: "#0369a1",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen font-sans bg-gradient-to-br from-sky-50 via-white to-blue-50">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* ฝั่งซ้าย — Brand panel */}
        <section className="relative hidden overflow-hidden border-r border-sky-100 bg-gradient-to-b from-sky-100 via-sky-50 to-white lg:flex lg:items-center lg:justify-center">
          {/* Background decor */}
          <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-100/80" />

          <div className="relative z-10 flex w-full max-w-3xl flex-col items-center px-12 text-center">
            <div className="mb-8">
              <Image
                src="/logos/rmu.png"
                alt="มหาวิทยาลัยราชภัฏมหาสารคาม"
                width={110}
                height={110}
                className="object-contain drop-shadow-sm"
                priority
              />
            </div>

            <div className="flex w-full max-w-[760px] flex-col items-center px-6 text-center">
              <p className="text-[1.05rem] font-semibold tracking-[0.08em] text-sky-800 xl:text-[1.15rem]">
                ระบบประเมินความพึงพอใจ
              </p>

              <div className="mt-4 flex flex-col items-center gap-1.5 text-gray-800">
                <p className="text-[2rem] font-bold leading-[1.18] tracking-[-0.02em] xl:text-[2.0rem]">
                  การใช้บริการหน่วยงาน
                </p>
                <p className="text-[2rem] font-bold leading-[1.18] tracking-[-0.02em] xl:text-[2.0rem]">
                  ภายในมหาวิทยาลัยราชภัฏมหาสารคาม
                </p>
              </div>

              <p className="mt-5 max-w-[620px] text-[1.08rem] font-medium leading-8 text-sky-800 xl:text-[1.18rem]">
                โดยใช้เทคโนโลยีคิวอาร์โค้ด เพื่อความสะดวกและรวดเร็วในการประเมิน
              </p>
            </div>
          </div>
        </section>

        {/* ฝั่งขวา — Login form */}
        <section className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="rounded-3xl border border-sky-100 bg-white p-8 shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
              <div className="login-mobile-card-logo mb-5 justify-center">
                <Image
                  src="/logos/rmu.png"
                  alt="มหาวิทยาลัยราชภัฏมหาสารคาม"
                  width={64}
                  height={64}
                  className="login-mobile-card-logo-image h-16 w-16 object-contain drop-shadow-sm"
                  priority
                />
              </div>

              <div className="login-card-heading mb-6">
                <h2 className="login-card-title text-2xl font-bold text-slate-800">
                  เข้าสู่ระบบ
                </h2>
                <p className="login-card-subtitle mt-1 text-sm text-slate-500">
                  ระบบประเมินความพึงพอใจการใช้บริการหน่วยงาน
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Username */}
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <User size={16} className="text-slate-400" />
                    ชื่อผู้ใช้เข้างานระบบ
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) =>
                        setUsername(sanitizeUsernameInput(e.target.value))
                      }
                      suppressHydrationWarning
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Lock size={16} className="text-slate-400" />
                    รหัสผ่าน
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      suppressHydrationWarning
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPwd((v) => !v)}
                      suppressHydrationWarning
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-sky-700"
                    >
                      {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-sky-700 transition hover:text-sky-900 hover:underline"
                  >
                    ลืมรหัสผ่าน?
                  </Link>
                </div>

                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm">
                      <UserPlus size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-800">
                        ลงทะเบียนเพื่อใช้งานระบบ
                      </h3>
                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        สำหรับบุคคลากรที่ยังไม่ได้ลงทะเบียนเข้าใช้งานระบบกรุณาลงทะเบียน
                      </p>
                      <Link
                        href="/register"
                        className="mt-3 inline-flex h-9 items-center justify-center rounded-xl border border-sky-200 bg-white px-3 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50"
                      >
                        ลงทะเบียน
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  suppressHydrationWarning
                  className={`mt-2 h-11 w-full rounded-xl text-sm font-semibold shadow-sm transition ${
                    loading
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-sky-700 text-white hover:bg-sky-800 focus:outline-none focus:ring-4 focus:ring-sky-100"
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M12 2a10 10 0 00-10 10h4a6 6 0 016-6V2z"
                        />
                      </svg>
                      กำลังเข้าสู่ระบบ...
                    </span>
                  ) : (
                    "เข้าสู่ระบบ"
                  )}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
