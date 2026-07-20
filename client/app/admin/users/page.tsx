// client/app/admin/users/page.tsx
"use client";

import React, { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import { Eye, EyeOff, Lock, User, Users, UserCheck, UserX, X } from "lucide-react";
import Swal from "sweetalert2";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import {
  containsThaiCharacters,
  sanitizeUsernameInput,
  USERNAME_THAI_VALIDATION_MESSAGE,
} from "@/lib/username";

type RoleCode = "admin" | "exec" | "dept_head" | "staff";
type RoleValue = "" | RoleCode;
type StatusFilter = "all" | "active" | "inactive";

type RoleRow = {
  code: RoleCode;
  name_th: string;
};

type Department = {
  id: number;
  name: string;
  is_active?: boolean;
};

type UserRow = {
  id: number;
  username: string;
  email: string | null;
  role: RoleCode;
  role_name?: string;
  department_id: number | null;
  department_name?: string;
  is_active: boolean;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at?: string;
  updated_at?: string;
};

type UsersResponse = {
  total: number;
  items: UserRow[];
};

type MeResponse = {
  id: number;
  username: string;
  role: RoleCode;
  department_id: number | null;
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

function RoleBadge({
  role,
  roleName,
}: {
  role: RoleCode;
  roleName: string;
}) {
  const roleClass: Record<RoleCode, string> = {
    admin: "border-violet-200 bg-violet-50 text-violet-700",
    exec: "border-amber-200 bg-amber-50 text-amber-700",
    dept_head: "border-sky-200 bg-sky-50 text-sky-700",
    staff: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${roleClass[role]}`}>
      <span className="whitespace-normal leading-4">{roleName}</span>
    </span>
  );
}

function formatFullName(
  title: string | null,
  firstName: string | null,
  lastName: string | null,
) {
  const firstPart = `${title ?? ""}${firstName ?? ""}`.trim();
  const lastPart = (lastName ?? "").trim();

  if (firstPart && lastPart) return `${firstPart} ${lastPart}`;
  return firstPart || lastPart || "-";
}

type KpiIcon = ComponentType<SVGProps<SVGSVGElement>>;

function KpiCard({
  icon: Icon,
  title,
  value,
  sub,
  cardClass = "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
  iconClass = "from-sky-500 to-blue-600",
}: {
  icon: KpiIcon;
  title: string;
  value: number;
  sub?: string;
  cardClass?: string;
  iconClass?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-5 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 ${cardClass}`}
    >
      <div className="relative flex items-start gap-4">
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${iconClass} text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/35`}
          aria-hidden="true"
        >
          <Icon className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className="text-2xl font-black leading-tight tracking-tight text-slate-900">
            {value.toLocaleString("th-TH")}
          </div>
          {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

const USER_OVERVIEW_THEMES = {
  total: {
    cardClass: "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-sky-500 to-cyan-500",
  },
  active: {
    cardClass: "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-emerald-500 to-teal-500",
  },
  inactive: {
    cardClass: "border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]",
    iconClass: "from-slate-500 to-slate-600",
  },
} as const;

const PAGE_SIZE = 10;
const TITLE_OPTIONS = ["นาย", "นาง", "นางสาว"] as const;

/* Toggle Switch Component */
function ToggleSwitch({
  checked,
  onChange,
  disabled,
  title,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <label
      className="relative inline-flex cursor-pointer items-center"
      title={title}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <div className="h-5 w-10 rounded-full bg-slate-300 transition peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-100 peer-checked:bg-emerald-500 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white disabled:cursor-not-allowed disabled:opacity-50"></div>
    </label>
  );
}

function PasswordField({
  value,
  onChange,
  placeholder,
  showValue,
  onToggle,
  disabled,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder: string;
  showValue: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <input
        type={showValue ? "text" : "password"}
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${inputClass} pr-11`}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={showValue ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
      >
        {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const message = rawMessage.trim();
  if (!message) return fallback;

  const translations: Record<string, string> = {
    "username must not contain Thai characters": "ชื่อผู้เข้าใช้งานระบบห้ามกรอกภาษาไทย",
    "email already exists": "อีเมลนี้มีอยู่ในระบบแล้ว",
    "username already exists": "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว",
    "username is required": "กรุณากรอกชื่อผู้ใช้",
    "password must be at least 8 characters":
      "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
    "department_id is required for dept_head/staff":
      "กรุณาเลือกหน่วยงานสำหรับตำแหน่งนี้",
    "Invalid user id": "รหัสผู้ใช้ไม่ถูกต้อง",
    "User not found": "ไม่พบข้อมูลผู้ใช้",
    "Deleted successfully": "ลบผู้ใช้เรียบร้อยแล้ว",
    "user_id is required": "กรุณาระบุผู้ใช้",
    "Request failed": "เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบ",
  };

  if (translations[message]) return translations[message];
  if (/^Request failed \(\d+\)$/.test(message)) {
    return "เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบ";
  }
  if (/^[\x00-\x7F]+$/.test(message)) return fallback;

  return message;
}

async function showSuccessAlert(title: string, text: string) {
  await Swal.fire({
    icon: "success",
    title,
    text,
    confirmButtonText: "ตกลง",
    confirmButtonColor: "#2563eb",
    showConfirmButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    allowEnterKey: false,
    timer: 2000,
    timerProgressBar: false,
    customClass: {
      popup:
        "rounded-3xl border border-emerald-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
      title: "text-xl font-semibold text-slate-900",
      htmlContainer: "text-sm leading-6 text-slate-500",
    },
  });
}

function getStatusFilterStyle(status: StatusFilter): React.CSSProperties {
  if (status === "active") {
    return {
      backgroundColor: "#eff6ff",
      borderColor: "#93c5fd",
      color: "#1d4ed8",
      boxShadow: "0 8px 20px rgba(37, 99, 235, 0.08)",
    };
  }

  if (status === "inactive") {
    return {
      backgroundColor: "#f8fafc",
      borderColor: "#cbd5e1",
      color: "#334155",
      boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
    };
  }

  return {
    backgroundColor: "#f8fbff",
    borderColor: "#bfdbfe",
    color: "#1e3a8a",
    boxShadow: "0 8px 20px rgba(37, 99, 235, 0.06)",
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles] = useState<RoleRow[]>([
    { code: "admin", name_th: "แอดมิน" },
    { code: "exec", name_th: "ผู้บริหารมหาวิทยาลัย" },
    { code: "dept_head", name_th: "หัวหน้าหน่วยงาน" },
    { code: "staff", name_th: "เจ้าหน้าที่หน่วยงาน" },
  ]);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [changePassword, setChangePassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    username: "",
    title: "นาย",
    first_name: "",
    last_name: "",
    role: "" as RoleValue,
    department_id: "" as string,
    password: "",
    confirmPassword: "",
    email: "",
  });
  const [currentPage, setCurrentPage] = useState(1);

  const loadAll = async () => {
    const [uRes, dRes] = await Promise.all([
      apiGet<UsersResponse>("/api/admin/users"),
      apiGet<{ total: number; items: Department[] }>("/api/departments"),
    ]);

    const deptMap = new Map<number, string>();
    (dRes.items ?? []).forEach((d) => deptMap.set(d.id, d.name));

    const roleMap = new Map<RoleCode, string>(
      roles.map((r) => [r.code, r.name_th]),
    );

    const items = (uRes.items ?? []).map((u) => ({
      ...u,
      role_name: u.role_name ?? roleMap.get(u.role) ?? u.role,
      department_name:
        u.department_name ??
        (u.department_id ? (deptMap.get(u.department_id) ?? "") : ""),
    }));

    setUsers(items);
    setDepartments(dRes.items ?? []);
  };

  const loadMe = async () => {
    try {
      const res = await apiGet<{ user: MeResponse }>("/api/auth/me");
      setCurrentUserId(res?.user?.id ?? null);
    } catch {
      setCurrentUserId(null);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadMe(), loadAll()]);
      } catch (e: unknown) {
        setError(getErrorMessage(e, "โหลดข้อมูลไม่สำเร็จ"));
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [q, statusFilter]);

  const counts = useMemo(() => {
    const total = users.length;
    let active = 0;
    let inactive = 0;
    for (const u of users) {
      if (u.is_active) active += 1;
      else inactive += 1;
    }
    return { total, active, inactive };
  }, [users]);

  const filteredUsers = useMemo(() => {
    let list = [...users];

    if (statusFilter === "active") list = list.filter((u) => u.is_active === true);
    if (statusFilter === "inactive") list = list.filter((u) => u.is_active === false);

    const keyword = q.trim().toLowerCase();
    if (keyword) {
      list = list.filter((u) => {
        const username = (u.username ?? "").toLowerCase();
        const email = (u.email ?? "").toLowerCase();
        const roleName = (u.role_name ?? "").toLowerCase();
        const deptName = (u.department_name ?? "").toLowerCase();
        return (
          username.includes(keyword) ||
          email.includes(keyword) ||
          roleName.includes(keyword) ||
          deptName.includes(keyword)
        );
      });
    }

    list.sort((a, b) => {
      const aTime = a.created_at ? Date.parse(a.created_at) : 0;
      const bTime = b.created_at ? Date.parse(b.created_at) : 0;
      const safeATime = Number.isFinite(aTime) ? aTime : 0;
      const safeBTime = Number.isFinite(bTime) ? bTime : 0;

      if (safeATime !== safeBTime) {
        return safeBTime - safeATime;
      }

      return b.id - a.id;
    });

    return list;
  }, [users, q, statusFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [filteredUsers.length]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedUsers = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredUsers, safeCurrentPage]);
  const startItem =
    filteredUsers.length === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;

  const resetForm = () => {
    setForm({
      username: "",
      title: "นาย",
      first_name: "",
      last_name: "",
      role: "",
      department_id: "",
      password: "",
      confirmPassword: "",
      email: "",
    });
    setChangePassword(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({
      username: u.username,
      title: u.title || "นาย",
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      role: u.role,
      department_id: u.department_id ? String(u.department_id) : "",
      password: "",
      confirmPassword: "",
      email: u.email || "",
    });
    setChangePassword(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    resetForm();
  };

  const validate = () => {
    if (editing === null) {
      const username = form.username.trim();
      if (containsThaiCharacters(username)) {
        throw new Error(USERNAME_THAI_VALIDATION_MESSAGE);
      }
      if (!username) throw new Error("กรุณากรอกชื่อผู้ใช้");
    }

    if (!form.role) {
      throw new Error("กรุณาเลือกตำแหน่ง");
    }

    const deptRequired = form.role === "dept_head" || form.role === "staff";
    if (deptRequired && !form.department_id) {
      throw new Error("กรุณาเลือกหน่วยงานสำหรับตำแหน่งนี้");
    }

    if (editing === null) {
      if (!form.password || form.password.length < 8) {
        throw new Error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      }
      if (form.password !== form.confirmPassword) {
        throw new Error("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      }
    }

    if (editing !== null && changePassword) {
      if (!form.password || form.password.length < 8) {
        throw new Error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      }
      if (form.password !== form.confirmPassword) {
        throw new Error("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      }
    }
  };

  const save = async () => {
    try {
      setError("");
      validate();
      setBusy(true);
      const isCreate = editing === null;
      const role = form.role as RoleCode;
      const successTitle = isCreate ? "เพิ่มข้อมูลผู้ใช้สำเร็จ" : "แก้ไขข้อมูลผู้ใช้สำเร็จ";
      const successText = isCreate
        ? `เพิ่มผู้ใช้ "${form.username.trim()}" เรียบร้อยแล้ว`
        : `แก้ไขผู้ใช้ "${editing?.username ?? form.username.trim()}" เรียบร้อยแล้ว`;

      if (editing === null) {
        const payload = {
          username: form.username.trim(),
          title: form.title.trim() || null,
          first_name: form.first_name.trim() || null,
          last_name: form.last_name.trim() || null,
          role,
          department_id: form.department_id === "" ? null : Number(form.department_id),
          password: form.password,
          email: form.email.trim() || null,
        };
        await apiPost("/api/admin/users", payload);
      } else {
        const payload: {
          title: string | null;
          first_name: string | null;
          last_name: string | null;
          role: RoleCode;
          department_id: number | null;
          email: string | null;
          password?: string;
        } = {
          title: form.title.trim() || null,
          first_name: form.first_name.trim() || null,
          last_name: form.last_name.trim() || null,
          role,
          department_id: form.department_id === "" ? null : Number(form.department_id),
          email: form.email.trim() || null,
        };
        if (changePassword) payload.password = form.password;
        await apiPut(`/api/admin/users/${editing.id}`, payload);
      }

      await loadAll();
      closeModal();
      await showSuccessAlert(successTitle, successText);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "บันทึกไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (user: UserRow) => {
    try {
      setError("");

      const isSelf = currentUserId != null && user.id === currentUserId;
      if (isSelf && user.is_active) {
        throw new Error("ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้");
      }

      const nextActive = !user.is_active;
      const result = await Swal.fire({
        icon: "question",
        title: nextActive ? "เปิดใช้งานผู้ใช้" : "ปิดใช้งานผู้ใช้",
        text: nextActive
          ? `ต้องการเปิดใช้งานผู้ใช้ ${user.username} ใช่ไหม?`
          : `ต้องการปิดใช้งานผู้ใช้ ${user.username} ใช่ไหม?`,
        showCancelButton: true,
        confirmButtonText: nextActive ? "เปิดใช้งาน" : "ปิดใช้งาน",
        cancelButtonText: "ยกเลิก",
        focusCancel: true,
        confirmButtonColor: nextActive ? "#2563eb" : "#dc2626",
        cancelButtonColor: "#0369a1",
        customClass: {
          popup:
            "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
          title: "text-xl font-semibold text-slate-900",
          htmlContainer: "text-sm leading-6 text-slate-500",
        },
      });
      if (!result.isConfirmed) return;

      setBusy(true);
      await apiPut(`/api/admin/users/${user.id}`, { is_active: nextActive });
      await loadAll();
      await showSuccessAlert(
        nextActive ? "เปิดใช้งานผู้ใช้สำเร็จ" : "ปิดใช้งานผู้ใช้สำเร็จ",
        `${nextActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}ผู้ใช้ "${user.username}" เรียบร้อยแล้ว`,
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "เปลี่ยนสถานะไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async (user: UserRow) => {
    try {
      setError("");

      const isSelf = currentUserId != null && user.id === currentUserId;
      if (isSelf) {
        throw new Error("ไม่สามารถลบบัญชีของตัวเองได้");
      }

      const result = await Swal.fire({
        icon: "question",
        title: "ลบผู้ใช้",
        text: `ต้องการลบผู้ใช้ "${user.username}" `,
        showCancelButton: true,
        confirmButtonText: "ลบ",
        cancelButtonText: "ยกเลิก",
        focusCancel: true,
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#2563eb",
        customClass: {
          popup:
            "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
          title: "text-xl font-semibold text-slate-900",
          htmlContainer: "text-sm leading-6 text-slate-500",
        },
      });

      if (!result.isConfirmed) return;

      setBusy(true);
      await apiDelete(`/api/admin/users/${user.id}`);
      await loadAll();
      await showSuccessAlert(
        "ลบข้อมูลผู้ใช้สำเร็จ",
        `ลบผู้ใช้ "${user.username}" เรียบร้อยแล้ว`,
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, "ลบผู้ใช้ไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm">
            กำลังโหลดข้อมูลผู้ใช้...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-200/15 blur-3xl" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
                <Users className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-sky-100/90">Administration</p>
                <h1 className="mt-1 text-2xl font-bold text-white">จัดการผู้ใช้</h1>
                <div className="mt-4 h-1.5 w-20 rounded-full bg-white/25" />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-3 text-red-700 shadow-sm">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="px-2 font-bold text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            icon={Users}
            title="ผู้ใช้ทั้งหมด"
            value={counts.total}
            cardClass={USER_OVERVIEW_THEMES.total.cardClass}
            iconClass={USER_OVERVIEW_THEMES.total.iconClass}
          />
          <KpiCard
            icon={UserCheck}
            title="ใช้งานอยู่"
            value={counts.active}
            cardClass={USER_OVERVIEW_THEMES.active.cardClass}
            iconClass={USER_OVERVIEW_THEMES.active.iconClass}
          />
          <KpiCard
            icon={UserX}
            title="ปิดใช้งาน"
            value={counts.inactive}
            cardClass={USER_OVERVIEW_THEMES.inactive.cardClass}
            iconClass={USER_OVERVIEW_THEMES.inactive.iconClass}
          />
        </div>

        {/* Controls */}
        <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/80 to-sky-50/30 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm">
          {/* Search + Filter */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                ค้นหา (ชื่อผู้ใช้ / อีเมล / ตำแหน่ง / หน่วยงาน)
              </label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="w-full sm:w-52">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                สถานะ
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                style={getStatusFilterStyle(statusFilter)}
                className={selectClass}
              >
                <option value="all">ทั้งหมด</option>
                <option value="active">ใช้งานอยู่</option>
                <option value="inactive">ปิดใช้งาน</option>
              </select>
            </div>
          </div>

        </div>

        <div className="flex justify-end pr-4 sm:pr-4">
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-sky-500 hover:to-blue-500 disabled:opacity-60"
            disabled={busy}
          >
            + เพิ่มผู้ใช้
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-3xl border border-sky-100 bg-white/95 shadow-[0_20px_55px_rgba(37,99,235,0.10)]">
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full table-fixed border-collapse text-[13px]">
              <thead className="bg-gradient-to-r from-sky-600 via-blue-600 to-blue-700 text-white">
                <tr className="border-b border-blue-700/30">
                  <th className="w-[5%] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">ลำดับ</th>
                  <th className="w-[14%] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">ตำแหน่ง</th>
                  <th className="w-[18%] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">หน่วยงาน</th>
                  <th className="w-[18%] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">ชื่อ นามสกุล</th>
                  <th className="w-[10%] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">ชื่อผู้ใช้</th>
                  <th className="w-[18%] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">อีเมล</th>
                  <th className="w-[7%] border-r border-white/20 px-3 py-3.5 text-center text-sm font-bold">สถานะ</th>
                  <th className="w-[10%] px-3 py-3.5 text-center text-sm font-bold">การทำงาน</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                      ไม่พบข้อมูลผู้ใช้
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u, idx) => {
                    const isSelf = currentUserId != null && u.id === currentUserId;
                    return (
                      <tr key={u.id} className="border-b border-sky-100 transition last:border-b-0 hover:bg-sky-50/50">
                        <td className="border-r border-sky-100 px-3 py-3.5 text-center text-slate-500">
                          {startItem + idx}
                        </td>

                        <td className="border-r border-sky-100 px-3 py-3.5">
                          <RoleBadge role={u.role} roleName={u.role_name ?? u.role} />
                        </td>

                        <td className="border-r border-sky-100 px-3 py-3.5 leading-5 text-slate-700">
                          <span className="block whitespace-normal break-words leading-5" title={u.department_name || undefined}>
                            {u.department_name || "-"}
                          </span>
                        </td>

                        <td className="border-r border-sky-100 px-3 py-3.5 font-normal leading-5 text-slate-900">
                          <span className="block truncate" title={formatFullName(u.title, u.first_name, u.last_name)}>
                            {formatFullName(u.title, u.first_name, u.last_name)}
                          </span>
                        </td>

                        <td className="border-r border-sky-100 px-3 py-3.5 text-slate-600">
                          <span className="block truncate" title={u.username}>
                            {u.username}
                          </span>
                        </td>

                        <td className="border-r border-sky-100 px-3 py-3.5 text-slate-600">
                          <span className="block truncate" title={u.email || "-"}>
                            {u.email || "-"}
                          </span>
                        </td>

                        <td className="border-r border-sky-100 px-3 py-3.5 text-center">
                          <div className="flex justify-center">
                            <ToggleSwitch
                              checked={u.is_active}
                              onChange={() => toggleActive(u)}
                              disabled={busy || (isSelf && u.is_active)}
                              title={
                                isSelf && u.is_active
                                  ? "ไม่สามารถปิดการใช้งานบัญชีตัวเองได้"
                                  : u.is_active
                                    ? "คลิกเพื่อปิดใช้งาน"
                                    : "คลิกเพื่อเปิดใช้งาน"
                              }
                            />
                          </div>
                          {false && (u.is_active ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              ใช้งานอยู่
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                              ปิดใช้งาน
                            </span>
                          ))}
                        </td>

                        <td className="px-3 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="hidden">
                            {false && (
                            <ToggleSwitch
                              checked={u.is_active}
                              onChange={() => toggleActive(u)}
                              disabled={busy || (isSelf && u.is_active)}
                              title={
                                isSelf && u.is_active
                                  ? "ไม่สามารถปิดการใช้งานบัญชีตัวเองได้"
                                  : u.is_active
                                    ? "คลิกเพื่อปิดใช้งาน"
                                    : "คลิกเพื่อเปิดใช้งาน"
                              }
                            />
                            )}

                            </div>

                            <button
                              onClick={() => openEdit(u)}
                              className="rounded-lg border border-amber-400 bg-gradient-to-b from-amber-400 to-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-amber-500 hover:to-amber-600 disabled:opacity-50"
                              disabled={busy}
                            >
                              แก้ไข
                            </button>

                            <button
                              onClick={() => deleteUser(u)}
                              className="rounded-lg border border-red-500 bg-gradient-to-b from-red-500 to-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-red-600 hover:to-red-700 disabled:opacity-50"
                              disabled={busy || isSelf}
                              title={isSelf ? "ไม่สามารถลบบัญชีตัวเองได้" : ""}
                            >
                              ลบ
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end border-t border-sky-100 bg-sky-50/30 px-4 py-3">
            <div className="flex items-center gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage <= 1}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
              >
                ย้อนกลับ
              </button>
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm">
                หน้า {safeCurrentPage} / {totalPages}
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>

        {/* Modal */}
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 sm:p-6">
            <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-sky-50 shadow-[0_24px_70px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-4rem)]">
              <div className="relative shrink-0 rounded-t-3xl border-b border-white/15 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 px-6 py-4 text-white">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={busy}
                  className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-60"
                  aria-label="ปิด"
                  title="ปิด"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>

                <h3 className="text-lg font-bold">
                  {editing ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}
                </h3>
                <p className="mt-1 text-sm text-sky-100/90">
                  กำหนดข้อมูลผู้ใช้ สิทธิ์การใช้งาน และหน่วยงานที่เกี่ยวข้อง
                </p>
              </div>

              <div className="min-h-0 overflow-y-auto p-6">
                <div className="space-y-4">
                  {/* Role */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      ตำแหน่ง
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) => {
                        const role = e.target.value as RoleValue;
                        setForm((p) => ({
                          ...p,
                          role,
                          department_id:
                            role === "dept_head" || role === "staff"
                              ? p.department_id
                              : "",
                        }));
                      }}
                      className={selectClass}
                    >
                      <option value="">เลือกตำแหน่ง</option>
                      {roles.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.name_th}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      หน่วยงาน
                    </label>
                    <select
                      value={form.department_id}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, department_id: e.target.value }))
                      }
                      className={selectClass}
                      disabled={!(form.role === "dept_head" || form.role === "staff")}
                    >
                      <option value="">เลือกหน่วยงาน</option>
                      {departments.map((d) => (
                        <option key={d.id} value={String(d.id)}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Name Fields */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)]">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        คำนำหน้า
                      </label>
                      <select
                        value={form.title}
                        onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                        className={selectClass}
                      >
                        {TITLE_OPTIONS.map((title) => (
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
                        onChange={(e) =>
                          setForm((p) => ({ ...p, first_name: e.target.value }))
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
                        onChange={(e) =>
                          setForm((p) => ({ ...p, last_name: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                      <User className="h-4 w-4 text-slate-400" />
                      ชื่อผู้เข้าใช้งานระบบ
                    </label>
                    {editing ? (
                      <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700">
                        <span className="font-medium">{editing.username}</span>
                        <span className="ml-auto text-xs text-slate-400">
                          ไม่สามารถแก้ไขได้
                        </span>
                      </div>
                    ) : (
                      <input
                        value={form.username}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            username: sanitizeUsernameInput(e.target.value),
                          }))
                        }
                        className={inputClass}
                      />
                    )}
                    {!editing && (
                      <p className="mt-1 text-xs text-slate-500">
                        ชื่อผู้เข้าใช้งานระบบห้ามกรอกภาษาไทย
                      </p>
                    )}
                  </div>

                  {editing && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        อีเมล
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, email: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </div>
                  )}

                  {/* Password */}
                  {editing ? (
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                        <input
                          type="checkbox"
                          checked={changePassword}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setChangePassword(checked);
                            if (!checked) {
                              setShowPassword(false);
                              setShowConfirmPassword(false);
                            }
                          }}
                        />
                        เปลี่ยนรหัสผ่าน
                      </label>

                      {changePassword && (
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                              <Lock className="h-4 w-4 text-slate-400" />
                              รหัสผ่านใหม่
                            </label>
                            <PasswordField
                              value={form.password}
                              onChange={(nextValue) =>
                                setForm((p) => ({ ...p, password: nextValue }))
                              }
                              placeholder=""
                              showValue={showPassword}
                              onToggle={() => setShowPassword((value) => !value)}
                              disabled={busy}
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                              <Lock className="h-4 w-4 text-slate-400" />
                              ยืนยันรหัสผ่านใหม่
                            </label>
                            <PasswordField
                              value={form.confirmPassword}
                              onChange={(nextValue) =>
                                setForm((p) => ({
                                  ...p,
                                  confirmPassword: nextValue,
                                }))
                              }
                              placeholder=""
                              showValue={showConfirmPassword}
                              onToggle={() =>
                                setShowConfirmPassword((value) => !value)
                              }
                              disabled={busy}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                          <Lock className="h-4 w-4 text-slate-400" />
                          รหัสผ่าน
                        </label>
                        <PasswordField
                          value={form.password}
                          onChange={(nextValue) =>
                            setForm((p) => ({ ...p, password: nextValue }))
                          }
                          placeholder=""
                          showValue={showPassword}
                          onToggle={() => setShowPassword((value) => !value)}
                          disabled={busy}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                          <Lock className="h-4 w-4 text-slate-400" />
                          ยืนยันรหัสผ่าน
                        </label>
                        <PasswordField
                          value={form.confirmPassword}
                          onChange={(nextValue) =>
                            setForm((p) => ({
                              ...p,
                              confirmPassword: nextValue,
                            }))
                          }
                          placeholder=""
                          showValue={showConfirmPassword}
                          onToggle={() =>
                            setShowConfirmPassword((value) => !value)
                          }
                          disabled={busy}
                        />
                      </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          อีเมล
                        </label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, email: e.target.value }))
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={save}
                    disabled={busy}
                    className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {busy ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                  <button
                    onClick={closeModal}
                    disabled={busy}
                    className="rounded-xl text-white border border-slate-200 bg-red-500 px-4 py-2 text-slate-700 transition hover:bg-red-600 disabled:opacity-60"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
