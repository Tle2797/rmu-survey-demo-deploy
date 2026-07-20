"use client";

import { useEffect, useState, type ChangeEvent, type ComponentType, type FormEvent } from "react";
import Link from "next/link";
import {
  AtSign,
  BadgeCheck,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Shield,
  User,
  Users,
  UserRound,
} from "lucide-react";
import Swal from "sweetalert2";
import { apiGet, apiPostForm, apiPut } from "@/lib/api";

type ProfileUser = {
  id: number;
  username: string;
  role: string;
  department_id?: number | null;
  departmentId?: number | null;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_image_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_active?: boolean;
};

type DepartmentResponse = {
  department: {
    id: number;
    name: string;
  };
};

type SaveResponse = {
  item?: ProfileUser;
};

type UploadResponse = {
  profile_image_url?: string | null;
  updated_at?: string | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3080";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const PROFILE_UPDATED_EVENT = "profile:updated";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const roleLabels: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  exec: "ผู้บริหาร",
  dept_head: "หัวหน้าหน่วยงาน",
  staff: "เจ้าหน้าที่",
};

const rolePills: Record<
  string,
  { wrapper: string; dot: string }
> = {
  admin: {
    wrapper: "border-sky-200 bg-sky-50 text-sky-700",
    dot: "bg-sky-500",
  },
  exec: {
    wrapper: "border-blue-200 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  dept_head: {
    wrapper: "border-indigo-200 bg-indigo-50 text-indigo-700",
    dot: "bg-indigo-500",
  },
  staff: {
    wrapper: "border-cyan-200 bg-cyan-50 text-cyan-700",
    dot: "bg-cyan-500",
  },
};

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const fieldBoxClass =
  "rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(15,23,42,0.08)]";

const heroGlowClass =
  "pointer-events-none absolute rounded-full blur-3xl";

function getFullName(user: ProfileUser | null) {
  if (!user) return "ผู้ใช้งาน";
  return [user.title, user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;
}

function getInitial(user: ProfileUser | null) {
  const source = (user?.first_name || user?.username || "?").trim();
  return source.charAt(0).toUpperCase();
}

function formatThaiDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function formatThaiDateTime(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function buildAvatarUrl(user: ProfileUser | null) {
  if (!user?.profile_image_url) return null;
  const stamp = user.updated_at || user.created_at;
  const cacheKey = stamp ? `?v=${encodeURIComponent(stamp)}` : "";
  return `${API_BASE_URL}${user.profile_image_url}${cacheKey}`;
}

function getDepartmentId(user: ProfileUser | null) {
  return user?.departmentId ?? user?.department_id ?? null;
}

const swalPanelClass = {
  popup:
    "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
  title: "text-xl font-semibold text-slate-900",
  htmlContainer: "text-sm leading-6 text-slate-500",
};

async function showProfileAlert(
  icon: "error" | "success" | "warning" | "info" | "question",
  title: string,
  text: string,
  options?: {
    confirmButtonText?: string;
    confirmButtonColor?: string;
    timer?: number;
    showConfirmButton?: boolean;
  },
) {
  return Swal.fire({
    icon,
    title,
    text,
    confirmButtonText: options?.confirmButtonText ?? "ตกลง",
    confirmButtonColor: options?.confirmButtonColor ?? "#0369a1",
    timer: options?.timer,
    showConfirmButton: options?.showConfirmButton ?? true,
    customClass: swalPanelClass,
  });
}

async function showProfileSuccess(title: string, text: string) {
  return showProfileAlert("success", title, text, {
    timer: 1800,
    showConfirmButton: false,
    confirmButtonColor: "#2563eb",
  });
}

function ProfileFieldCard({
  icon: Icon,
  label,
  value,
  accentClass,
  fullWidth = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accentClass: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={`${fieldBoxClass} ${fullWidth ? "sm:col-span-2" : ""}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${accentClass} text-white shadow-[0_10px_20px_rgba(15,23,42,0.14)]`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {label}
          </div>
          <div className="mt-1 break-words text-base font-bold text-slate-900">
            {value || "-"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [me, setMe] = useState<ProfileUser | null>(null);
  const [departmentName, setDepartmentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [error, setError] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [title, setTitle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const syncProfileForm = (user: ProfileUser | null) => {
    setProfileUsername(user?.username || "");
    setTitle(user?.title || "");
    setFirstName(user?.first_name || "");
    setLastName(user?.last_name || "");
  };

  const openProfileEditor = () => {
    syncProfileForm(me);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowProfileEditor(true);
  };

  const closeProfileEditor = () => {
    syncProfileForm(me);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowProfileEditor(false);
  };

  const retryLoad = () => {
    setReloadKey((prev) => prev + 1);
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await apiGet<{ user: ProfileUser }>("/api/auth/me");
        if (!active) return;

        const user = data?.user;
        if (!user) {
          throw new Error("ไม่พบข้อมูลผู้ใช้งาน");
        }

        setMe(user);
        syncProfileForm(user);

        const departmentId = getDepartmentId(user);

        if (departmentId) {
          try {
            const dept = await apiGet<DepartmentResponse>(`/api/departments/${departmentId}`);
            if (active) {
              setDepartmentName(dept.department?.name || "");
            }
          } catch {
            if (active) setDepartmentName("");
          }
        } else {
          setDepartmentName("");
        }
      } catch (e: unknown) {
        if (!active) return;
        const message = e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ";
        setError(message);
        void showProfileAlert("error", "ไม่สามารถโหลดโปรไฟล์ได้", message, {
          confirmButtonText: "ตกลง",
          confirmButtonColor: "#0369a1",
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const handleSave = async () => {
    if (!me) return;

    const nextUsername = (profileUsername.trim() || me.username || "").trim();
    const nextTitle = title.trim();
    const nextFirstName = firstName.trim();
    const nextLastName = lastName.trim();
    const nextPassword = password;
    const nextConfirmPassword = confirmPassword;
    const wantsPasswordChange = nextPassword.length > 0 || nextConfirmPassword.length > 0;

    if (!nextUsername) {
      await showProfileAlert("warning", "ข้อมูลไม่ครบ", "ไม่พบชื่อผู้ใช้ของบัญชีนี้", {
        confirmButtonText: "ตกลง",
      });
      return;
    }

    if (wantsPasswordChange) {
      if (!nextPassword || !nextConfirmPassword) {
        await showProfileAlert("warning", "กรุณากรอกรหัสผ่านให้ครบ", "กรุณากรอกรหัสผ่านและยืนยันรหัสผ่านให้ครบถ้วน", {
          confirmButtonText: "ตกลง",
        });
        return;
      }

      if (nextPassword.length < 8) {
        await showProfileAlert("warning", "รหัสผ่านไม่ถูกต้อง", "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร", {
          confirmButtonText: "ตกลง",
        });
        return;
      }

      if (nextPassword !== nextConfirmPassword) {
        await showProfileAlert("warning", "รหัสผ่านไม่ตรงกัน", "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน", {
          confirmButtonText: "ตกลง",
        });
        return;
      }
    }

    setBusy(true);

    try {
      const res = await apiPut<SaveResponse>("/api/auth/profile", {
        username: nextUsername,
        title: nextTitle || null,
        first_name: nextFirstName || null,
        last_name: nextLastName || null,
        ...(wantsPasswordChange ? { password: nextPassword } : {}),
      });

      if (res.item) {
        setMe((prev) => (prev ? { ...prev, ...res.item } : res.item || prev));
        setProfileUsername(res.item.username || nextUsername);
        setTitle(res.item.title || "");
        setFirstName(res.item.first_name || "");
        setLastName(res.item.last_name || "");
      } else {
        setMe((prev) =>
          prev
            ? {
                ...prev,
                username: nextUsername,
                title: nextTitle || null,
                first_name: nextFirstName || null,
                last_name: nextLastName || null,
              }
            : prev,
        );
        setProfileUsername(nextUsername);
        setTitle(nextTitle);
        setFirstName(nextFirstName);
        setLastName(nextLastName);
      }

      setShowPassword(false);
      setShowConfirmPassword(false);
      setShowProfileEditor(false);
      setPassword("");
      setConfirmPassword("");
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
      await showProfileSuccess("บันทึกสำเร็จ", "บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "บันทึกข้อมูลไม่สำเร็จ";
      await showProfileAlert("error", "บันทึกข้อมูลไม่สำเร็จ", message, {
        confirmButtonText: "ตกลง",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file || !me) return;

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      await showProfileAlert("warning", "ไฟล์ไม่ถูกต้อง", "รองรับเฉพาะไฟล์รูป JPG, PNG, WEBP หรือ GIF", {
        confirmButtonText: "ตกลง",
      });
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      await showProfileAlert("warning", "ไฟล์ใหญ่เกินไป", "ไฟล์รูปต้องมีขนาดไม่เกิน 5MB", {
        confirmButtonText: "ตกลง",
      });
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    setUploading(true);

    try {
      const res = await apiPostForm<UploadResponse>("/api/auth/profile/image", formData);
      if (!res?.profile_image_url) {
        throw new Error("อัปโหลดรูปโปรไฟล์ไม่สำเร็จ");
      }

      setMe((prev) =>
        prev
          ? {
              ...prev,
              profile_image_url: res.profile_image_url ?? null,
              updated_at: res.updated_at ?? prev.updated_at ?? null,
            }
          : prev,
      );
      setAvatarLoadFailed(false);
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
      await showProfileSuccess("อัปโหลดสำเร็จ", "อัปเดตรูปโปรไฟล์เรียบร้อยแล้ว");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ";
      await showProfileAlert("error", "อัปโหลดรูปไม่สำเร็จ", message, {
        confirmButtonText: "ตกลง",
      });
    } finally {
      setUploading(false);
    }
  };

  const avatarUrl = buildAvatarUrl(me);
  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarUrl]);

  const fullName = getFullName(me);
  const roleLabel = roleLabels[me?.role ?? ""] ?? me?.role ?? "-";
  const roleTone = rolePills[me?.role ?? ""] ?? rolePills.staff;
  const memberSince = formatThaiDate(me?.created_at);
  const updatedAt = formatThaiDateTime(me?.updated_at);
  const accountStatus = me?.is_active === false ? "ปิดใช้งาน" : "ใช้งานอยู่";

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 sm:p-6">
        <div className={`${heroGlowClass} -top-32 -left-24 h-80 w-80 bg-sky-200/30`} />
        <div className={`${heroGlowClass} -bottom-12 right-0 h-72 w-72 bg-blue-200/20`} />
        <div className="relative z-10 mx-auto max-w-6xl space-y-5 animate-pulse">
          <div className="h-44 rounded-[32px] border border-white/40 bg-white/80 shadow-[0_18px_40px_rgba(37,99,235,0.08)]" />
          <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="h-[620px] rounded-[28px] border border-white/60 bg-white/80 shadow-[0_18px_40px_rgba(37,99,235,0.08)]" />
            <div className="h-[620px] rounded-[28px] border border-white/60 bg-white/80 shadow-[0_18px_40px_rgba(37,99,235,0.08)]" />
          </div>
        </div>
      </main>
    );
  }

  if (error && !me) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 sm:p-6">
        <div className={`${heroGlowClass} -top-32 -left-24 h-80 w-80 bg-sky-200/30`} />
        <div className={`${heroGlowClass} -bottom-12 right-0 h-72 w-72 bg-blue-200/20`} />
        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] max-w-4xl items-center justify-center">
          <div className="w-full rounded-[28px] border border-white/60 bg-white/90 p-8 text-center shadow-[0_18px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <span className="text-2xl font-black">!</span>
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-900">ไม่สามารถโหลดโปรไฟล์ได้</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              กรุณาลองอีกครั้ง หรือกลับไปหน้าเข้าสู่ระบบ
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={retryLoad}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-3 font-semibold text-white shadow-[0_16px_35px_rgba(37,99,235,0.20)] transition hover:from-sky-500 hover:to-blue-500"
              >
                ลองอีกครั้ง
              </button>
              <Link
                href="/login"
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                ไปหน้าเข้าสู่ระบบ
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 sm:p-6 text-slate-900">
      <div className={`${heroGlowClass} -top-32 -left-24 h-80 w-80 bg-sky-200/30`} />
      <div className={`${heroGlowClass} -bottom-12 right-0 h-72 w-72 bg-blue-200/20`} />

      <div className="relative z-10 mx-auto max-w-6xl space-y-5">
        <section className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-200/15 blur-3xl" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
                <Users className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-sky-100/90">Administration</p>
                <h1 className="mt-1 text-2xl font-bold text-white">โปรไฟล์ผู้ใช้</h1>
                <div className="mt-4 h-1.5 w-20 rounded-full bg-white/25" />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-[30px] border border-white/70 bg-gradient-to-b from-[#edf3ff] to-white p-6 shadow-[0_20px_50px_rgba(37,99,235,0.08)] backdrop-blur-sm">
            <div className="flex h-full flex-col items-center text-center">
              <div className="relative">
                <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-sky-100 via-white to-blue-100 text-5xl font-black text-sky-700 shadow-[0_18px_35px_rgba(37,99,235,0.16)] ring-4 ring-sky-100/60">
                  {avatarUrl && !avatarLoadFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={`${fullName} profile`}
                      className="h-full w-full object-cover"
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : (
                    getInitial(me)
                  )}
                </div>

                <label
                  className="absolute -bottom-1 -right-1 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-sky-600 to-blue-600 text-white shadow-[0_14px_28px_rgba(37,99,235,0.28)] transition hover:scale-105"
                  title="เปลี่ยนรูปโปรไฟล์"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploading}
                    onChange={handleImageChange}
                  />
                </label>
              </div>

              <div className="mt-6 space-y-2">
                <h2 className="text-2xl font-black text-slate-900">{fullName}</h2>
                <div
                  className={`mx-auto inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-[0_12px_22px_rgba(37,99,235,0.18)] ${roleTone.wrapper}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${roleTone.dot}`} />
                  {roleLabel}
                </div>
              </div>

              <div className="mt-5 w-full">
                <div className="mx-auto flex w-fit items-center rounded-full border border-slate-100 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                  <UserRound className="mr-2 h-4 w-4 text-sky-600" />
                  {me?.username}
                </div>
              </div>

              <div className="mt-5 w-full rounded-[24px] border border-sky-200 bg-sky-50/80 p-4 text-left shadow-[0_10px_24px_rgba(37,99,235,0.10)]">
                <div className="flex items-center gap-2 text-sm font-bold text-sky-700">
                  <CalendarDays className="h-4 w-4" />
                  วันสมัครสมาชิก
                </div>
                <div className="mt-3 text-base font-extrabold text-slate-900">
                  {memberSince}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_20px_50px_rgba(37,99,235,0.08)] backdrop-blur-sm sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_12px_22px_rgba(37,99,235,0.25)]">
                  <BadgeCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    ข้อมูลส่วนตัว
                  </h2>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
                <BadgeCheck className="h-4 w-4" />
                Profile Info
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <ProfileFieldCard
                icon={UserRound}
                label="ชื่อ - นามสกุล"
                value={fullName}
                accentClass="from-sky-500 to-blue-600"
              />
              <ProfileFieldCard
                icon={AtSign}
                label="ชื่อผู้ใช้"
                value={me?.username || "-"}
                accentClass="from-blue-500 to-indigo-600"
              />
              <ProfileFieldCard
                icon={Building2}
                label="หน่วยงาน"
                value={departmentName || "-"}
                accentClass="from-sky-600 to-cyan-500"
              />
              <ProfileFieldCard
                icon={Shield}
                label="สิทธิ์การใช้งานระบบ"
                value={roleLabel}
                accentClass="from-blue-600 to-sky-500"
              />
              <ProfileFieldCard
                icon={CheckCircle2}
                label="สถานะบัญชี"
                value={accountStatus}
                accentClass="from-indigo-500 to-blue-600"
              />
              <ProfileFieldCard
                icon={CalendarDays}
                label="อัปเดตล่าสุด"
                value={updatedAt}
                accentClass="from-sky-500 to-indigo-500"
              />
            </div>


            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={openProfileEditor}
                disabled={busy || uploading}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-6 py-3 font-semibold text-white shadow-[0_16px_35px_rgba(37,99,235,0.22)] transition hover:from-sky-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                แก้ไขข้อมูล
              </button>
            </div>
          </section>
        </div>

        {showProfileEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
            <button
              type="button"
              aria-label="ปิดหน้าต่างแก้ไขโปรไฟล์"
              onClick={closeProfileEditor}
              className="absolute inset-0 bg-transparent"
            />

            <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-sky-50 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
              <div className="relative rounded-t-3xl border-b border-white/15 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 px-6 py-4 text-white">
                <button
                  type="button"
                  onClick={closeProfileEditor}
                  className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                  aria-label="ปิด"
                >
                  <span className="text-xl leading-none">×</span>
                </button>

                <h3 className="text-lg font-bold">
                  แก้ไขข้อมูลโปรไฟล์
                </h3>
                <p className="mt-1 text-sm text-sky-100/90">
                  ปรับข้อมูลส่วนตัวและรหัสผ่านให้ตรงกับบัญชีของคุณ
                </p>
              </div>

              <form
                className="space-y-6 p-6"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  void handleSave();
                }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                      <User className="h-4 w-4 text-slate-400" />
                      ชื่อผู้ใช้
                    </label>
                    <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700">
                      <span className="font-medium">{profileUsername || "-"}</span>
                      <span className="ml-auto text-xs text-slate-400">ไม่สามารถแก้ไขได้</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        คำนำหน้า
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        className={inputClass}
                        placeholder="เช่น นาย, นาง, นางสาว"
                          disabled={busy || uploading}
                        />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        ชื่อ
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        className={inputClass}
                        placeholder="ชื่อจริง"
                          disabled={busy || uploading}
                        />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        นามสกุล
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        className={inputClass}
                        placeholder="นามสกุล"
                        disabled={busy || uploading}
                        />
                      </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Lock className="h-4 w-4 text-slate-400" />
                        รหัสผ่านใหม่
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className={`${inputClass} pr-11`}
                        disabled={busy || uploading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          disabled={busy || uploading}
                          aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Lock className="h-4 w-4 text-slate-400" />
                        ยืนยันรหัสผ่านใหม่
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className={`${inputClass} pr-11`}
                        disabled={busy || uploading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((value) => !value)}
                          disabled={busy || uploading}
                          aria-label={showConfirmPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">
                    * เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน
                  </p>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        สิทธิ์การใช้งาน
                      </div>
                      <div className="mt-1 font-bold text-slate-900">{roleLabel}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        หน่วยงาน
                      </div>
                      <div className="mt-1 font-bold text-slate-900">{departmentName || "-"}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        สถานะ
                      </div>
                      <div className="mt-1 font-bold text-slate-900">{accountStatus}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="submit"
                    disabled={busy || uploading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-[0_16px_35px_rgba(37,99,235,0.22)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    บันทึกข้อมูล
                  </button>
                  <button
                    type="button"
                    onClick={closeProfileEditor}
                    disabled={busy || uploading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-red-500 px-5 py-3 font-semibold text-white shadow-[0_14px_28px_rgba(239,68,68,0.20)] transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
