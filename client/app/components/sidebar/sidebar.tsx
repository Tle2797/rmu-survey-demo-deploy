"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { apiGet } from "@/lib/api";
import { SIDEBAR_MENU, Role, SidebarItem } from "./sidebar.config";
import Swal from "sweetalert2";

type SidebarProps = {
  role: Role;
  departmentId?: number;
  user?: SidebarUser;
};

export type SidebarUser = {
  id: number;
  username: string;
  role: Role;
  departmentId: number | null;
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  profile_image_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_active?: boolean;
};

type MeResponse = {
  user: SidebarUser;
};

type ApprovalCountsResponse = {
  counts?: {
    pending?: number;
    approved?: number;
    rejected?: number;
  };
};

const USER_APPROVALS_UPDATED_EVENT = "user-approvals:updated";
const PROFILE_UPDATED_EVENT = "profile:updated";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3080";

const PROFILE_PATHS: Record<Role, string> = {
  admin: "/admin/profile",
  exec: "/exec/profile",
  dept_head: "/dashboard/profile",
  staff: "/dashboard/profile",
};

const menuItemBase =
  "group relative flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-[13.5px] font-medium transition-colors";
const menuItemInactive =
  "text-slate-600 hover:bg-sky-50/80 hover:text-blue-700";
const menuItemActive =
  "bg-white/95 text-blue-700 font-semibold border-blue-200/70 shadow-[0_8px_22px_rgba(37,99,235,0.10)]";
const menuIconBase = "h-[17px] w-[17px] shrink-0 transition-colors";
const menuPillBase =
  "h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 transition-opacity";
const menuBadgeBase =
  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white shadow-sm";

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : count.toLocaleString("th-TH");
}

function getDisplayName(user?: SidebarUser | null) {
  if (!user) return "ผู้ใช้งานระบบ";
  return (
    [user.title, user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.username
  );
}

function getProfileInitial(user?: SidebarUser | null) {
  const source = (user?.first_name || user?.username || "?").trim();
  return source.charAt(0).toUpperCase();
}

function buildProfileImageUrl(user?: SidebarUser | null) {
  if (!user?.profile_image_url) return null;

  const source = /^https?:\/\//i.test(user.profile_image_url)
    ? user.profile_image_url
    : `${API_BASE_URL}${user.profile_image_url}`;
  const stamp = user.updated_at || user.created_at;
  if (!stamp) return source;

  const separator = source.includes("?") ? "&" : "?";
  return `${source}${separator}v=${encodeURIComponent(stamp)}`;
}

export default function Sidebar({
  role,
  departmentId,
  user,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const menu = SIDEBAR_MENU[role] ?? [];
  const isDeptRole = role === "dept_head" || role === "staff";
  const [pendingApprovalCount, setPendingApprovalCount] = useState<number | null>(
    null,
  );
  const [refreshedProfile, setRefreshedProfile] = useState<SidebarUser | null>(null);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    let active = true;

    const refreshProfile = async () => {
      try {
        const res = await apiGet<MeResponse>("/api/auth/me");
        if (active) setRefreshedProfile(res.user);
      } catch {
        // Keep the latest profile already rendered by the authenticated layout.
      }
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, refreshProfile);
    return () => {
      active = false;
      window.removeEventListener(PROFILE_UPDATED_EVENT, refreshProfile);
    };
  }, []);

  const profileUser = refreshedProfile ?? user ?? null;
  const avatarUrl = buildProfileImageUrl(profileUser);
  const displayName = getDisplayName(profileUser);
  const profilePath = PROFILE_PATHS[role];
  const canShowAvatar = Boolean(avatarUrl && failedAvatarUrl !== avatarUrl);

  useEffect(() => {
    if (role !== "admin") return;

    let active = true;

    const loadApprovalCount = async () => {
      try {
        const res = await apiGet<ApprovalCountsResponse>(
          "/api/admin/user-approvals/counts",
        );
        if (!active) return;
        setPendingApprovalCount(Number(res.counts?.pending ?? 0));
      } catch {
        if (active) setPendingApprovalCount(null);
      }
    };

    loadApprovalCount();

    window.addEventListener(USER_APPROVALS_UPDATED_EVENT, loadApprovalCount);
    return () => {
      active = false;
      window.removeEventListener(
        USER_APPROVALS_UPDATED_EVENT,
        loadApprovalCount,
      );
    };
  }, [role, pathname]);

  const buildHref = (item: SidebarItem) => {
    if (!isDeptRole || !departmentId || item.appendDepartmentId === false) {
      return item.path;
    }
    if (item.path === "/dashboard/profile") return item.path;
    return `${item.path}/${departmentId}`;
  };

  const isActiveMenu = (item: SidebarItem) => {
    const excludedPaths = item.excludePaths ?? [];
    if (excludedPaths.some((p) => pathname.startsWith(p))) {
      return false;
    }
    const pathsToMatch = item.matchPaths ?? [item.path];
    return pathsToMatch.some((p) => pathname.startsWith(p));
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      icon: "question",
      title: "ออกจากระบบ",
      text: "คุณต้องการออกจากระบบนี้หรือไม่",
      showCancelButton: true,
      confirmButtonText: "ออกจากระบบ",
      cancelButtonText: "ยกเลิก",
      focusCancel: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#0369a1",
      customClass: {
        popup:
          "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
        title: "text-xl font-semibold text-slate-900",
        htmlContainer: "text-sm leading-6 text-slate-500",
      },
    });

    if (!result.isConfirmed) return;
    localStorage.removeItem("token");
    router.replace("/login");
  };

  const roleLabel: Record<Role, string> = {
    admin: "แอดมิน",
    exec: "ผู้บริหาร",
    dept_head: "หัวหน้าหน่วยงาน",
    staff: "เจ้าหน้าที่หน่วยงาน",
  };

  return (
    <aside
      className={`font-sans sticky top-0 z-20 flex h-screen shrink-0 flex-col border-r border-sky-200/60 bg-gradient-to-b from-sky-50 to-white shadow-[inset_-1px_0_0_rgba(255,255,255,0.6)] backdrop-blur-md transition-[width] duration-300 ease-in-out ${
        isCollapsed ? "w-20" : "w-[260px]"
      }`}
    >
      <button
        type="button"
        onClick={() => setIsCollapsed((collapsed) => !collapsed)}
        className="absolute -right-3.5 top-4 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-sky-200 bg-white text-blue-600 shadow-[0_8px_20px_rgba(37,99,235,0.18)] transition hover:scale-105 hover:border-blue-300 hover:bg-sky-50"
        aria-label={isCollapsed ? "เปิดแถบเมนู" : "ปิดแถบเมนู"}
        aria-expanded={!isCollapsed}
        title={isCollapsed ? "เปิดแถบเมนู" : "ย่อแถบเมนู"}
      >
        {isCollapsed ? (
          <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
        ) : (
          <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      <div
        className={`shrink-0 bg-gradient-to-br from-sky-500 to-blue-600 py-5 shadow-[inset_0_-1px_0_rgba(255,255,255,0.14)] ${
          isCollapsed ? "px-2" : "px-4"
        }`}
      >
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center">
            <Image
              src="/logos/rmu.png"
              alt="RMU Logo"
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
              priority
            />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-bold leading-5 tracking-[-0.2px] text-white">
                RMU Satisfaction
              </div>
              <div className="mt-1.5 text-[11.5px] font-medium leading-4 text-white">
                ระบบประเมินความพึงพอใจ
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`shrink-0 pt-3 ${isCollapsed ? "px-2" : "px-2.5"}`}>
        <Link
          href={profilePath}
          className={`group block rounded-2xl border border-sky-200/80 bg-white/95 shadow-[0_10px_28px_rgba(37,99,235,0.10)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_14px_32px_rgba(37,99,235,0.15)] ${
            isCollapsed ? "p-2" : "p-2.5"
          }`}
          aria-label={`เปิดโปรไฟล์ของ ${displayName}`}
          title={isCollapsed ? displayName : undefined}
        >
          <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2.5"}`}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-sky-100 via-white to-blue-100 text-base font-black text-blue-700 shadow-[0_8px_18px_rgba(37,99,235,0.16)] ring-1 ring-sky-200/80">
              {avatarUrl && canShowAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={`รูปโปรไฟล์ของ ${displayName}`}
                  className="h-full w-full object-cover"
                  onError={() => setFailedAvatarUrl(avatarUrl)}
                />
              ) : (
                getProfileInitial(profileUser)
              )}
            </div>

            {!isCollapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold leading-5 text-slate-800">
                    {displayName}
                  </div>
                  <div className="truncate text-[11px] font-medium leading-4 text-slate-500">
                    ตำแหน่ง : {roleLabel[role]}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
              </>
            )}
          </div>
        </Link>
      </div>

      <nav
        className={`flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-3 ${
          isCollapsed ? "px-2" : "px-2.5"
        }`}
        aria-label="Sidebar navigation"
      >
        {menu.map((item, idx) => {
          const active = isActiveMenu(item);
          const href = buildHref(item);
          const prevItem = menu[idx - 1];
          const showDivider =
            idx > 0 &&
            item.group !== undefined &&
            prevItem?.group !== item.group;

          return (
            <div key={item.path}>
              {showDivider && (
                <div className="mx-2 my-0 h-px bg-sky-100/80" />
              )}
              <Link
                href={href}
                className={`${menuItemBase} ${
                  active ? menuItemActive : menuItemInactive
                } ${isCollapsed ? "justify-center px-2" : ""}`}
                title={isCollapsed ? item.label : undefined}
              >
                {item.icon && (
                  <item.icon
                    className={`${menuIconBase} ${
                      active
                        ? "text-blue-700"
                        : "text-slate-400 group-hover:text-blue-700"
                    }`}
                  />
                )}
                {!isCollapsed && (
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                )}
                {role === "admin" &&
                  item.path === "/admin/user-approvals" &&
                  pendingApprovalCount !== null &&
                  pendingApprovalCount > 0 && (
                    <span
                      className={
                        isCollapsed
                          ? "absolute right-1 top-1 h-2 w-2 rounded-full bg-red-600 ring-2 ring-white"
                          : menuBadgeBase
                      }
                      aria-label={`Pending approvals ${pendingApprovalCount}`}
                    >
                      {!isCollapsed && formatBadgeCount(pendingApprovalCount)}
                    </span>
                  )}
                {!isCollapsed && (
                  <span
                    className={`${menuPillBase} ${
                      active ? "opacity-100" : "opacity-0"
                    }`}
                  />
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className={`pb-4 pt-2 ${isCollapsed ? "px-2" : "px-2.5"}`}>
        <div className={`${isCollapsed ? "mx-1" : "mx-3"} mb-3 h-px bg-sky-200/80`} />

        <button
          type="button"
          onClick={handleLogout}
          className={`relative flex w-full items-center rounded-xl border border-red-300/60 bg-gradient-to-r from-red-500 to-red-600 py-2.5 text-[13px] font-medium text-white transition-colors hover:border-red-300/80 hover:from-red-400 hover:to-red-500 ${
            isCollapsed ? "justify-center px-0" : "px-3.5"
          }`}
          title={isCollapsed ? "ออกจากระบบ" : undefined}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={
              isCollapsed
                ? "h-[17px] w-[17px] shrink-0 text-white"
                : "absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 shrink-0 text-white"
            }
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {!isCollapsed && <span className="w-full text-center">ออกจากระบบ</span>}
        </button>
      </div>
    </aside>
  );
}
