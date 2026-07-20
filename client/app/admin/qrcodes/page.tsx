// client/app/admin/qrcodes/page.tsx
"use client";

import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import {
  Building2,
  CircleCheck,
  CircleX,
  Download,
  Eye,
  Link2,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { apiGet, apiPost } from "@/lib/api";
import { getThaiAlertMessage } from "@/lib/alert-message";

/* =============================================================
   Types
   ============================================================= */
type QRCodeRow = {
  id: number;
  type: "central" | "department";
  department_id: number | null;
  image_path: string;
  link_target: string;
  created_at: string;
};

type DeptRow = {
  id: number;
  name: string;
  is_active: boolean;
  department_group_id: number;
  department_group_name: string;
  department_group_display_order: number;
  created_at: string;
  qrcode_id: number | null;
  image_path: string | null;
  link_target: string | null;
  qr_created_at: string | null;
};

type QRStats = {
  total: number;
  has_qr: number;
  no_qr: number;
  central_ready: boolean;
};

type PageData = {
  central: QRCodeRow | null;
  departments: DeptRow[];
  stats: QRStats;
};

type KpiIcon = ComponentType<SVGProps<SVGSVGElement>>;

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50";

/* =============================================================
   Helper: Download base64 PNG
   ============================================================= */
async function downloadQR(id: number, filename: string) {
  const BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3080";
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`${BASE_URL}/api/admin/qrcodes/download/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "omit",
  });

  if (!res.ok) throw new Error("ดาวน์โหลดไม่สำเร็จ");

  const data = await res.json();
  const binary = atob(data.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const blob = new Blob([bytes], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function showSuccessAlert(title: string, text: string) {
  await Swal.fire({
    icon: "success",
    title,
    text,
    confirmButtonText: "ตกลง",
    showConfirmButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    allowEnterKey: false,
    timer: 1800,
    timerProgressBar: true,
    customClass: {
      popup:
        "rounded-3xl border border-emerald-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
      title: "text-xl font-semibold text-slate-900",
      htmlContainer: "text-sm leading-6 text-slate-500",
    },
  });
}

async function showErrorAlert(title: string, text: string) {
  await Swal.fire({
    icon: "error",
    title,
    text,
    confirmButtonText: "ตกลง",
    confirmButtonColor: "#dc2626",
    customClass: {
      popup:
        "rounded-3xl border border-rose-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
      title: "text-xl font-semibold text-slate-900",
      htmlContainer: "text-sm leading-6 text-slate-500",
    },
  });
}

async function showConfirmAlert({
  title,
  text,
  confirmButtonText,
  confirmButtonColor,
}: {
  title: string;
  text: string;
  confirmButtonText: string;
  confirmButtonColor: string;
}) {
  const result = await Swal.fire({
    icon: "question",
    title,
    text,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: "ยกเลิก",
    focusCancel: true,
    confirmButtonColor,
    cancelButtonColor: "#0369a1",
    customClass: {
      popup:
        "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
      title: "text-xl font-semibold text-slate-900",
      htmlContainer: "text-sm leading-6 text-slate-500",
    },
  });

  return result.isConfirmed;
}

/* =============================================================
   Sub-components
   ============================================================= */

/** Stat card (เหมือน Admin Users / Departments) */
function StatCard({
  title,
  value,
  sub,
  cardClass,
  icon: Icon,
  iconClass,
}: {
  title: string;
  value: number | string;
  sub?: string;
  cardClass: string;
  icon: KpiIcon;
  iconClass: string;
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
            {value}
          </div>
          {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/** Badge แสดงสถานะ QR */
function QrStatusBadge({ hasQr }: { hasQr: boolean }) {
  return hasQr ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
      สร้างแล้ว
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
      ยังไม่สร้าง
    </span>
  );
}

/* =============================================================
   Page
   ============================================================= */
export default function AdminQRCodesPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>(""); // current busy key: "central" | "dept-{id}" | "dl-{id}"

  // search
  const [q, setQ] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // preview modal
  const [preview, setPreview] = useState<{
    url: string;
    name: string;
    link: string;
  } | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  /* --------------------------------
     Load data
     -------------------------------- */
  const load = useCallback(async () => {
    const res = await apiGet<PageData>("/api/admin/qrcodes");
    setData(res);
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        await load();
      } catch (e: unknown) {
        await showErrorAlert(
          "โหลดข้อมูลไม่สำเร็จ",
          getThaiAlertMessage(e, "โหลดข้อมูลไม่สำเร็จ")
        );
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [load]);

  useEffect(() => {
    setCurrentPage(1);
  }, [q]);

  /* --------------------------------
     Derived: filtered departments
     -------------------------------- */
  const filtered = useMemo(() => {
    if (!data) return [];
    const keyword = q.trim().toLowerCase();
    if (!keyword) return data.departments;
    return data.departments.filter(
      (d) =>
        d.name.toLowerCase().includes(keyword) ||
        d.department_group_name.toLowerCase().includes(keyword),
    );
  }, [data, q]);

  const groupedDepartments = useMemo(() => {
    const groups: DeptRow[][] = [];

    for (const department of filtered) {
      const currentGroup = groups[groups.length - 1];
      const currentGroupId = currentGroup?.[0]?.department_group_id;

      if (
        currentGroup === undefined ||
        Number(currentGroupId) !== Number(department.department_group_id)
      ) {
        groups.push([department]);
      } else {
        currentGroup.push(department);
      }
    }

    return groups;
  }, [filtered]);

  const totalPages = Math.max(1, groupedDepartments.length);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => {
    return groupedDepartments[safeCurrentPage - 1] ?? [];
  }, [groupedDepartments, safeCurrentPage]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  /* --------------------------------
     Actions
     -------------------------------- */
  const generateCentral = async () => {
    const action = central ? "รีเซต" : "สร้าง";
    const confirmed = await showConfirmAlert({
      title: `${action} QR Code กลาง`,
      text: `ต้องการ${action}คิวอาร์โค้ดกลางใช่หรือไม่?`,
      confirmButtonText: action,
      confirmButtonColor: central ? "#dc2626" : "#2563eb",
    });

    if (!confirmed) return;

    try {
      setBusy("central");
      await apiPost("/api/admin/qrcodes/generate", { type: "central" });
      await load();
      await showSuccessAlert(
        `${action} QR Code กลางสำเร็จ`,
        `QR Code กลางเรียบร้อยแล้ว`
      );
    } catch (e: unknown) {
      await showErrorAlert(
        `${action} QR Code กลางไม่สำเร็จ`,
        getThaiAlertMessage(e, "เกิดข้อผิดพลาด")
      );
    } finally {
      setBusy("");
    }
  };

  const generateDept = async (dept: DeptRow) => {
    const action = dept.qrcode_id ? "รีเซต" : "สร้าง";
    const confirmed = await showConfirmAlert({
      title: `${action} QR Code ของ "${dept.name}"`,
      text: `ต้องการ${action}คิวอาร์โค้ดของ "${dept.name}" ใช่หรือไม่?`,
      confirmButtonText: action,
      confirmButtonColor: dept.qrcode_id ? "#dc2626" : "#2563eb",
    });

    if (!confirmed) return;

    try {
      setBusy(`dept-${dept.id}`);
      await apiPost("/api/admin/qrcodes/generate", {
        type: "department",
        department_id: dept.id,
      });
      await load();
      await showSuccessAlert(
        `${action} QR Code "${dept.name}" สำเร็จ`,
        `${action}คิวอาร์โค้ด "${dept.name}" เรียบร้อยแล้ว`
      );
    } catch (e: unknown) {
      await showErrorAlert(
        `${action} QR Code ไม่สำเร็จ`,
        getThaiAlertMessage(e, "เกิดข้อผิดพลาด")
      );
    } finally {
      setBusy("");
    }
  };

  const handleDownload = async (
    qrId: number,
    filename: string,
    label: string
  ) => {
    try {
      setBusy(`dl-${qrId}`);
      await downloadQR(qrId, filename);
      await showSuccessAlert(
        `ดาวน์โหลด ${label} สำเร็จ`,
        `ดาวน์โหลด ${label} เรียบร้อยแล้ว`
      );
    } catch (e: unknown) {
      await showErrorAlert(
        `ดาวน์โหลด ${label} ไม่สำเร็จ`,
        getThaiAlertMessage(e, "ดาวน์โหลดไม่สำเร็จ")
      );
    } finally {
      setBusy("");
    }
  };

  const openPreview = (url: string, name: string, link: string) => {
    setPreviewLoaded(false);
    setPreview({ url, name, link });
  };

  /* --------------------------------
     Render helpers
     -------------------------------- */
  const BASE_URL_CLIENT =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3080";

  const qrImageSrc = (imagePath: string) =>
    `${BASE_URL_CLIENT}${imagePath}?t=${Date.now()}`;

  /* --------------------------------
     Loading state
     -------------------------------- */
  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6">
        <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl space-y-4 animate-pulse">
          <div className="h-44 rounded-[28px] border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
              />
            ))}
          </div>
          <div className="h-80 rounded-3xl border border-sky-100/80 bg-white/90 shadow-[0_16px_40px_rgba(37,99,235,0.08)]" />
        </div>
      </main>
    );
  }

  const stats = data?.stats;
  const central = data?.central;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 p-6 text-slate-900">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">

        {/* ===================== Header ===================== */}
        <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-md">
                <QrCode className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-sky-100/90">
                  Administration
                </p>
                <h1 className="mt-1 text-2xl font-bold text-white">
                  จัดการ QR Code
                </h1>
                <div className="mt-4 h-1.5 w-20 rounded-full bg-white/25" />
              </div>
            </div>
          </div>

        </div>

        {/* ===================== Stat Cards ===================== */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Building2}
            title="หน่วยงานทั้งหมด"
            value={stats?.total ?? 0}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass="from-sky-500 to-cyan-500"
          />
          <StatCard
            icon={CircleCheck}
            title="สร้าง QR แล้ว"
            value={stats?.has_qr ?? 0}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass="from-emerald-500 to-teal-500"
          />
          <StatCard
            icon={CircleX}
            title="ยังไม่สร้าง QR"
            value={stats?.no_qr ?? 0}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass="from-amber-500 to-orange-500"
          />
          <StatCard
            icon={QrCode}
            title="QR Code กลาง"
            value={stats?.central_ready ? "พร้อมใช้งาน" : "ยังไม่สร้าง"}
            cardClass="border-slate-200/80 bg-white/95 shadow-[0_16px_40px_rgba(37,99,235,0.08)]"
            iconClass={
              stats?.central_ready
                ? "from-indigo-500 to-blue-500"
                : "from-slate-500 to-slate-600"
            }
          />
        </div>

        {/* ===================== QR Code กลาง ===================== */}
        <div className="rounded-3xl border border-sky-100/80 bg-white/90 p-6 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                <QrCode className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900">QR Code กลาง </h2>
              </div>
            </div>

            <button
              onClick={generateCentral}
              disabled={!!busy}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-sky-500 hover:to-blue-500 disabled:opacity-60"
            >
              {busy === "central" ? (
                <>
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  กำลังสร้าง...
                </>
              ) : central ? (
                <>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  รีเซต QR กลาง
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  สร้าง QR กลาง
                </>
              )}
            </button>
          </div>

          {central ? (
            <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-sky-100 bg-sky-50/70 p-5">
              {/* QR Preview */}
              <div
                className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm transition hover:shadow-md"
                onClick={() =>
                  openPreview(
                    qrImageSrc(central.image_path),
                    "QR Code กลาง",
                    central.link_target
                  )
                }
                title="คลิกเพื่อดูขนาดเต็ม"
              >
                <img
                  src={qrImageSrc(central.image_path)}
                  alt="QR Code กลาง"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800">QR Code กลาง</div>
                <div className="mt-1 break-all text-xs text-slate-500">
                  <Link2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>Link: {central.link_target}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  สร้างเมื่อ:{" "}
                  {new Date(central.created_at).toLocaleString("th-TH")}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-nowrap gap-2 flex-shrink-0">
                <button
                  onClick={() =>
                    openPreview(
                      qrImageSrc(central.image_path),
                      "QR Code กลาง",
                      central.link_target
                    )
                  }
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-sky-600 bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:border-sky-700 hover:bg-sky-700"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  ดู QR
                </button>
                <button
                  onClick={() =>
                    handleDownload(central.id, "qr_central.png", "QR Code กลาง")
                  }
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:border-emerald-700 hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy === `dl-${central.id}` ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                      กำลังดาวน์โหลด...
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      ดาวน์โหลด
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-sky-100 bg-sky-50/70 p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm">
                <QrCode className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="text-sm text-slate-500">
                ยังไม่มี QR Code กลาง — กดปุ่ม{" "}
                <strong>สร้าง QR กลาง</strong> ด้านบนเพื่อสร้าง
              </p>
            </div>
          )}
        </div>

        {/* ===================== Department Table ===================== */}
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_18px_50px_rgba(37,99,235,0.08)]">
          {/* Table Header / Search bar */}
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="pt-0.5 text-lg font-bold text-slate-900">QR Code หน่วยงาน</h2>
              </div>
              <div className="relative flex-1 max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className={`${inputClass} pl-10`}
                  placeholder="ค้นหาหน่วยงาน..."
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-blue-700/20 bg-gradient-to-r from-sky-600 to-blue-600 text-white">
                <tr>
                  <th className="w-14 px-5 py-3 text-left font-semibold">ลำดับ</th>
                  <th className="px-5 py-3 text-left font-semibold">ชื่อหน่วยงาน</th>
                  <th className="w-32 px-5 py-3 text-center font-semibold">QR Code</th>
                  <th className="px-5 py-3 text-left font-semibold">Link</th>
                  <th className="w-64 px-5 py-3 text-center font-semibold">การทำงาน</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-slate-400"
                    >
                      {q ? `ไม่พบหน่วยงานที่ค้นหา "${q}"` : "ไม่มีข้อมูลหน่วยงาน"}
                    </td>
                  </tr>
                ) : (
                  paginated.map((dept, idx) => {
                    const hasQr = !!dept.qrcode_id && !!dept.image_path;
                    const isBusyGen = busy === `dept-${dept.id}`;
                    const isBusyDl = busy === `dl-${dept.qrcode_id}`;
                    const showGroupHeader =
                      idx === 0 ||
                      paginated[idx - 1]?.department_group_id !==
                        dept.department_group_id;

                    return (
                      <Fragment key={dept.id}>
                        {showGroupHeader && (
                          <tr className="border-b border-sky-100">
                            <td
                              colSpan={5}
                              className="bg-gradient-to-r from-sky-50 via-cyan-50/80 to-blue-50 px-5 py-2.5 text-sky-700"
                            >
                              <div className="flex items-center gap-2.5 text-sm font-bold">
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-sky-200 bg-white/80">
                                  <Building2
                                    className="h-4 w-4"
                                    strokeWidth={2}
                                    aria-hidden="true"
                                  />
                                </span>
                                {dept.department_group_name}
                              </div>
                            </td>
                          </tr>
                        )}

                        <tr
                          className={`transition hover:bg-slate-50 ${
                            !dept.is_active ? "opacity-50" : ""
                          }`}
                        >
                        {/* ลำดับ */}
                        <td className="px-5 py-3 text-center text-slate-500">
                          {idx + 1}
                        </td>

                        {/* ชื่อหน่วยงาน */}
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-900">
                            {dept.name}
                          </div>
                          {!dept.is_active && (
                            <div className="mt-0.5 text-xs text-red-500">
                              (ปิดใช้งาน)
                            </div>
                          )}
                        </td>

                        {/* QR Code Preview */}
                        <td className="px-5 py-3 text-center">
                          {hasQr ? (
                            <div
                              className="mx-auto h-12 w-12 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 shadow-sm transition hover:shadow-md"
                              onClick={() =>
                                openPreview(
                                  qrImageSrc(dept.image_path!),
                                  dept.name,
                                  dept.link_target!
                                )
                              }
                              title="คลิกดูขนาดเต็ม"
                            >
                              <img
                                src={qrImageSrc(dept.image_path!)}
                                alt={`QR ${dept.name}`}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <QrStatusBadge hasQr={false} />
                          )}
                        </td>

                        {/* Link */}
                        <td className="px-5 py-3">
                          {dept.link_target ? (
                            <a
                              href={dept.link_target}
                              target="_blank"
                              rel="noreferrer"
                            className="break-all text-xs text-sky-700 hover:underline"
                            >
                              {dept.link_target}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3 text-center">
                          <div className="flex flex-nowrap justify-center gap-2">
                            {/* Generate / Reset */}
                            <button
                              onClick={() => generateDept(dept)}
                              disabled={!!busy}
                              className={`order-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                                hasQr
                                  ? "bg-amber-500 text-white hover:bg-amber-600"
                                  : "bg-gradient-to-r from-sky-600 to-blue-600 text-white hover:from-sky-500 hover:to-blue-500"
                              }`}
                            >
                              {isBusyGen ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  กำลังสร้าง...
                                </span>
                              ) : hasQr ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                                  รีเซต
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                  สร้าง QR
                                </>
                              )}
                            </button>

                            {/* Download */}
                            {hasQr && (
                              <button
                                onClick={() =>
                                  handleDownload(
                                    dept.qrcode_id!,
                                    `qr_dept_${dept.id}.png`,
                                    dept.name
                                  )
                                }
                                disabled={!!busy}
                                className="order-2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:border-emerald-700 hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {isBusyDl ? (
                                  <>
                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                                    กำลังดาวน์โหลด...
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                                    ดาวน์โหลด
                                  </>
                                )}
                              </button>
                            )}

                            {/* Preview (เมื่อมี QR แล้ว) */}
                            {hasQr && (
                              <button
                                onClick={() =>
                                  openPreview(
                                    qrImageSrc(dept.image_path!),
                                    dept.name,
                                    dept.link_target!
                                  )
                                }
                                className="order-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:border-sky-700 hover:bg-sky-700"
                              >
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                ดู QR
                              </button>
                            )}
                          </div>
                        </td>
                        </tr>
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer summary */}
          {filtered.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-400">
                ทั้งหมด{" "} {filtered.length.toLocaleString("th-TH")} หน่วยงาน
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ย้อนกลับ
                </button>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                  กลุ่ม {groupedDepartments.length === 0 ? 0 : safeCurrentPage} / {groupedDepartments.length}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={safeCurrentPage >= totalPages}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================== Preview Modal ===================== */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >

            <button
              onClick={() => setPreview(null)}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="px-6 pt-7 pr-16">
              <h3 className="truncate text-lg font-bold leading-6 text-slate-900">
                {preview.name}
              </h3>
            </div>

            <div className="relative mx-6 mt-5 aspect-square overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-sky-50 shadow-[0_16px_36px_rgba(37,99,235,0.08)]">
              {!previewLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(186,230,253,0.35),transparent_50%),linear-gradient(135deg,rgba(248,250,252,0.96),rgba(255,255,255,0.92))]">
                  <div className="flex flex-col items-center gap-3 px-6 text-center">
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-[28px] border border-sky-100 bg-white shadow-sm">
                      <QrCode className="h-10 w-10 text-sky-500" aria-hidden="true" />
                      <div className="absolute -inset-2 animate-pulse rounded-[32px] border border-sky-100/80" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold leading-6 text-slate-700">
                        กำลังเตรียม QR Code
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400 [animation-delay:-0.2s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400 [animation-delay:-0.1s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400" />
                      </div>
                      <div className="text-xs leading-5 text-slate-400">
                        โปรดรอสักครู่
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <img
                key={preview.url}
                src={preview.url}
                alt={preview.name}
                onLoad={() => setPreviewLoaded(true)}
                className={`absolute inset-0 h-full w-full object-contain p-8 transition-opacity duration-300 ${
                  previewLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>

            <div className="px-6 pt-4 text-center text-xs text-slate-500">
              <span className="inline-flex items-start gap-1.5 break-all rounded-full bg-slate-100 px-3 py-2">
                <Link2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{preview.link}</span>
              </span>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
