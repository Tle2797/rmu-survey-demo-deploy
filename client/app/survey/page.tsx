// client/app/survey/page.tsx

/**
 * หน้า "เลือกหน่วยงาน" สำหรับ QR กลาง
 * - ดึงรายชื่อหน่วยงานจาก backend จริง
 * - คลิกแล้วไปยังแบบประเมินของหน่วยงานนั้น
 * - ส่งข้อมูลไปยัง client component เพื่อกรองหน่วยงานแบบพิมพ์แล้วเห็นผลทันที
 */

import { redirect } from "next/navigation";

import { apiGet } from "@/lib/api";
import DepartmentBrowser from "./department-browser";

type Department = {
  id: number;
  name: string;
  department_group_id: number;
  department_group_name: string;
  department_group_display_order: number;
};

type DepartmentResponse = {
  total: number;
  items: Department[];
};

type SurveySearchParams = {
  dept?: string | string[];
  departmentId?: string | string[];
  q?: string | string[];
};

function pickFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export default async function SurveyIndexPage({
  searchParams,
}: {
  searchParams?: Promise<SurveySearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const rawDepartmentId =
    pickFirstParam(sp.dept) ?? pickFirstParam(sp.departmentId);
  const departmentId = Number(rawDepartmentId);
  const initialQuery = (pickFirstParam(sp.q) ?? "").trim();

  if (Number.isFinite(departmentId) && departmentId > 0) {
    redirect(`/survey/${departmentId}`);
  }

  let data: DepartmentResponse = {
    total: 0,
    items: [],
  };
  let loadError = "";

  try {
    data = await apiGet<DepartmentResponse>("/api/departments");
  } catch (error) {
    loadError = getErrorMessage(error, "ไม่สามารถโหลดรายชื่อหน่วยงานได้");
  }

  return (
    <DepartmentBrowser
      departments={data.items ?? []}
      total={data.total ?? (data.items ?? []).length}
      loadError={loadError}
      initialQuery={initialQuery}
    />
  );
}
