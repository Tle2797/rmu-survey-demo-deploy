"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import Swal from "sweetalert2";
import { apiGet, apiPost } from "@/lib/api";
import { getThaiAlertMessage } from "@/lib/alert-message";
import {
  containsThaiCharacters,
  sanitizeUsernameInput,
  USERNAME_THAI_VALIDATION_MESSAGE,
} from "@/lib/username";

type Department = {
  id: number;
  name: string;
};

type RoleCode = "dept_head" | "staff";

type DepartmentsResponse = {
  total: number;
  items: Department[];
};

const roleOptions: Array<{ code: RoleCode; label: string }> = [
  { code: "dept_head", label: "หัวหน้าหน่วยงาน" },
  { code: "staff", label: "เจ้าหน้าที่หน่วยงาน" },
];

const titleOptions = ["นาย", "นาง", "นางสาว"] as const;

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100";

const selectClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100";

function PasswordField({
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} pr-11`}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-sky-700"
        aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    role: "" as "" | RoleCode,
    department_id: "",
    title: "",
    first_name: "",
    last_name: "",
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
  });

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await apiGet<DepartmentsResponse>("/api/departments");
        setDepartments(res.items ?? []);
      } catch (error: unknown) {
        await Swal.fire({
          icon: "error",
          title: "โหลดข้อมูลหน่วยงานไม่สำเร็จ",
          text: getThaiAlertMessage(error, "กรุณาลองใหม่อีกครั้ง"),
          confirmButtonText: "ตกลง",
          confirmButtonColor: "#0369a1",
        });
      } finally {
        setLoadingDepartments(false);
      }
    };

    loadDepartments();
  }, []);

  function validate() {
    const username = form.username.trim();
    if (containsThaiCharacters(username)) {
      throw new Error(USERNAME_THAI_VALIDATION_MESSAGE);
    }
    if (!form.role) throw new Error("กรุณาเลือกตำแหน่ง");
    if (!form.department_id) throw new Error("กรุณาเลือกหน่วยงาน");
    if (!form.title) throw new Error("กรุณาเลือกคำนำหน้า");
    if (!form.first_name.trim()) throw new Error("กรุณากรอกชื่อ");
    if (!form.last_name.trim()) throw new Error("กรุณากรอกนามสกุล");
    if (!form.username.trim()) throw new Error("กรุณากรอกชื่อผู้ใช้");
    if (!form.password || form.password.length < 8) {
      throw new Error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    }
    if (form.password !== form.confirmPassword) {
      throw new Error("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
    }
    if (!form.email.trim()) throw new Error("กรุณากรอกอีเมล");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      throw new Error("รูปแบบอีเมลไม่ถูกต้อง");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedUsername = form.username.trim();

    try {
      validate();
      setSubmitting(true);

      await apiPost("/api/auth/register", {
        role: form.role,
        department_id: Number(form.department_id),
        title: form.title,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: trimmedUsername,
        password: form.password,
        confirmPassword: form.confirmPassword,
        email: form.email.trim().toLowerCase(),
      });

      await Swal.fire({
        icon: "success",
        title: "ลงทะเบียนสำเร็จ",
        text: "กรุณารอการอนุมัติจากผู้ดูแลระบบ",
        confirmButtonText: "กลับหน้าเข้าสู่ระบบ",
        confirmButtonColor: "#0369a1",
      });

      router.replace("/login");
    } catch (error: unknown) {
      await Swal.fire({
        icon: "error",
        title: "ลงทะเบียนไม่สำเร็จ",
        text: getThaiAlertMessage(error, "กรุณาตรวจสอบข้อมูลแล้วลองใหม่อีกครั้ง"),
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#0369a1",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 px-6 py-10 font-sans">
      <section className="mx-auto w-full max-w-2xl rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_16px_50px_rgba(15,23,42,0.08)] sm:p-8">
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-sky-700"
        >
          <ArrowLeft size={16} />
          กลับหน้าเข้าสู่ระบบ
        </Link>

        <div className="mb-7 flex flex-col items-center text-center">
          <Image
            src="/logos/rmu.png"
            alt="RMU"
            width={76}
            height={76}
            className="mb-4 object-contain"
            priority
          />
          <h1 className="text-2xl font-bold text-slate-800">
            ลงทะเบียนเพื่อใช้งานระบบ
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            สำหรับบุคคลากรที่ยังไม่ได้ลงทะเบียนเข้าใช้งานระบบกรุณาลงทะเบียน
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                ตำแหน่ง
              </label>
              <select
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    role: event.target.value as "" | RoleCode,
                  }))
                }
                className={selectClass}
              >
                <option value="">เลือกตำแหน่ง</option>
                {roleOptions.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                หน่วยงาน
              </label>
              <select
                value={form.department_id}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    department_id: event.target.value,
                  }))
                }
                disabled={loadingDepartments}
                className={selectClass}
              >
                <option value="">
                  {loadingDepartments ? "กำลังโหลดหน่วยงาน..." : "เลือกหน่วยงาน"}
                </option>
                {departments.map((department) => (
                  <option key={department.id} value={String(department.id)}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                คำนำหน้า
              </label>
              <select
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                className={selectClass}
              >
                <option value="">เลือก</option>
                {titleOptions.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                ชื่อ
              </label>
              <input
                value={form.first_name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    first_name: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                นามสกุล
              </label>
              <input
                value={form.last_name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    last_name: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
              <User size={16} className="text-slate-400" />
              ชื่อผู้เข้าใช้งานระบบ
            </label>
            <div className="relative">
              <input
                autoComplete="username"
                value={form.username}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    username: sanitizeUsernameInput(event.target.value),
                  }))
                }
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Lock size={16} className="text-slate-400" />
                รหัสผ่าน
              </label>
              <PasswordField
                value={form.password}
                onChange={(value) =>
                  setForm((current) => ({ ...current, password: value }))
                }
                show={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Lock size={16} className="text-slate-400" />
                ยืนยันรหัสผ่าน
              </label>
              <PasswordField
                value={form.confirmPassword}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    confirmPassword: value,
                  }))
                }
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((value) => !value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              อีเมล
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Mail size={17} />
              </span>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="example@rmu.ac.th"
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || loadingDepartments}
            className={`h-11 w-full rounded-xl text-sm font-semibold shadow-sm transition ${
              submitting || loadingDepartments
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "bg-sky-700 text-white hover:bg-sky-800 focus:outline-none focus:ring-4 focus:ring-sky-100"
            }`}
          >
            {submitting ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
          </button>
        </form>
      </section>
    </main>
  );
}
