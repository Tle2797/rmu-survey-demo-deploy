// client/app/dashboard/layout.tsx
"use client";

/**
 * Dashboard Layout (มี Auth Guard)
 * - โหลด /api/auth/me เพื่อตรวจสิทธิ์
 * - ถ้าไม่ login -> redirect ไป /login
 * - ถ้า role เป็น dept_head/staff -> ต้องมี departmentId
 * - ใส่ Sidebar และส่ง departmentId ให้ Sidebar สร้างลิงก์แบบ /.../1 อัตโนมัติ
 */

import React, { useEffect, useState } from "react";
import Sidebar, { type SidebarUser } from "../components/sidebar/sidebar";
import { apiGet } from "@/lib/api";
import { useRouter } from "next/navigation";

type MeRes = {
  user: SidebarUser;
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [me, setMe] = useState<MeRes["user"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        // 1) ต้องมี token ก่อน
        const token = localStorage.getItem("token");
        if (!token) {
          router.replace("/login");
          return;
        }

        // 2) ดึง role + departmentId
        const res = await apiGet<MeRes>("/api/auth/me");
        const user = res.user;

        // 3) บังคับ head/staff ต้องมี departmentId
        if ((user.role === "dept_head" || user.role === "staff") && !user.departmentId) {
          // เคสข้อมูล DB ผิด (role ต้องมี dept แต่ไม่มี)
          localStorage.removeItem("token");
          router.replace("/login");
          return;
        }

        setMe(user);
      } catch {
        // token ไม่ถูกต้อง/หมดอายุ
        localStorage.removeItem("token");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-xl mx-auto bg-white border rounded-xl p-4">
          กำลังตรวจสอบสิทธิ์...
        </div>
      </main>
    );
  }

  if (!me) return null;

  return (
    // ✅ คุม scroll เฉพาะ main (กันปัญหาเลื่อนหน้าไม่ได้)
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        role={me.role}
        departmentId={me.departmentId ?? undefined}
        user={me}
      />
      <main className="flex-1 h-full overflow-y-auto">{children}</main>
    </div>
  );
}
