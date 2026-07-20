// client/app/admin/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import Sidebar, { type SidebarUser } from "../components/sidebar/sidebar";
import { apiGet } from "@/lib/api";
import { useRouter } from "next/navigation";

type MeRes = {
  user: SidebarUser;
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<MeRes["user"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.replace("/login");
          return;
        }

        const res = await apiGet<MeRes>("/api/auth/me");
        const user = res.user;

        // บังคับ admin เท่านั้น
        if (user.role !== "admin") {
          router.replace("/login");
          return;
        }

        setMe(user);
      } catch {
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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar role="admin" user={me} />
      <main className="flex-1 h-full overflow-y-auto">{children}</main>
    </div>
  );
}
