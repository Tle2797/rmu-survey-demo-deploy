// client/app/components/sidebar/sidebar.config.ts
import {
  BarChart3,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  QrCode,
  Trophy,
  UserCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Role = "admin" | "exec" | "dept_head" | "staff";

export type SidebarItem = {
  label: string;
  path: string;
  group?: string;
  matchPaths?: string[];
  icon?: LucideIcon;
  appendDepartmentId?: boolean;
  excludePaths?: string[];
};

export const SIDEBAR_MENU: Record<Role, SidebarItem[]> = {
  admin: [
    {
      label: "แดชบอร์ดภาพรวม",
      path: "/admin/dashboard",
      matchPaths: ["/admin/dashboard"],
      icon: LayoutDashboard,
    },
    {
      label: "ผลการประเมิน",
      path: "/admin/evaluation-results",
      matchPaths: ["/admin/evaluation-results"],
      icon: BarChart3,
    },
    {
      label: "จัดการผู้ใช้งาน",
      path: "/admin/users",
      matchPaths: ["/admin/users"],
      icon: Users,
    },
    {
      label: "อนุมัติผู้ใช้งาน",
      path: "/admin/user-approvals",
      matchPaths: ["/admin/user-approvals"],
      icon: UserCheck,
    },
    {
      label: "จัดการหน่วยงาน",
      path: "/admin/departments",
      matchPaths: ["/admin/departments"],
      icon: Building2,
    },
    {
      label: "จัดการแบบสอบถาม",
      path: "/admin/surveys",
      matchPaths: ["/admin/surveys"],
      icon: ClipboardList,
    },
    {
      label: "จัดการคำถามส่วนกลาง",
      path: "/admin/questions",
      matchPaths: ["/admin/questions"],
      excludePaths: ["/admin/questions/departments"],
      icon: ListChecks,
    },
    {
      label: "ตรวจสอบคำถามหน่วยงาน",
      path: "/admin/questions/departments",
      matchPaths: ["/admin/questions/departments"],
      icon: Building2,
    },
    // {
    //   label: "จัดการช่วงเวลา",
    //   path: "/admin/time-slots",
    //   matchPaths: ["/admin/time-slots"],
    //   icon: Clock3,
    // },
    {
      label: "จัดการคิวอาร์โค้ด",
      path: "/admin/qrcodes",
      matchPaths: ["/admin/qrcodes"],
      icon: QrCode,
    },
    {
      label: "แก้ไขข้อมูลส่วนตัว",
      path: "/admin/profile",
      matchPaths: ["/admin/profile"],
      icon: UserRound,
    },
  ],

  exec: [
    {
      label: "แดชบอร์ดภาพรวม",
      path: "/exec/dashboard",
      matchPaths: ["/exec/dashboard"],
      icon: LayoutDashboard,
    },
    {
      label: "จัดอันดับหน่วยงาน",
      path: "/exec/ranking",
      matchPaths: ["/exec/ranking"],
      icon: Trophy,
    },
    {
      label: "ความคิดเห็นหน่วยงาน",
      path: "/exec/comments",
      matchPaths: ["/exec/comments"],
      icon: MessageSquareText,
    },
    {
      label: "สรุปข้อมูลรายปี",
      path: "/exec/yearly",
      matchPaths: ["/exec/yearly"],
      icon: BarChart3,
    },
    {
      label: "รายงานผลการประเมิน",
      path: "/exec/reports",
      matchPaths: ["/exec/reports"],
      icon: FileSpreadsheet,
    },
    {
      label: "แก้ไขข้อมูลส่วนตัว",
      path: "/exec/profile",
      matchPaths: ["/exec/profile"],
      icon: UserRound,
    },
  ],

  dept_head: [
    {
      label: "แดชบอร์ดหน่วยงาน",
      path: "/dashboard/department",
      matchPaths: ["/dashboard/department"],
      icon: LayoutDashboard,
    },
    {
      label: "จัดการคำถามหน่วยงาน",
      path: "/dashboard/questions",
      matchPaths: ["/dashboard/questions"],
      group: "questions",
      excludePaths: ["/dashboard/questions/central"],
      icon: ClipboardList,
    },
    {
      label: "สรุปข้อมูลรายปี",
      path: "/dashboard/yearly",
      matchPaths: ["/dashboard/yearly"],
      icon: BarChart3,
    },
    {
      label: "ออกรายงานหน่วยงาน",
      path: "/dashboard/reports",
      matchPaths: ["/dashboard/reports"],
      icon: FileSpreadsheet,
    },
    {
      label: "คิวอาร์โค้ดหน่วยงาน",
      path: "/dashboard/qrcode",
      matchPaths: ["/dashboard/qrcode"],
      icon: QrCode,
    },
    {
      label: "แก้ไขข้อมูลส่วนตัว",
      path: "/dashboard/profile",
      matchPaths: ["/dashboard/profile"],
      icon: UserRound,
    },
  ],

  staff: [
    {
      label: "แดชบอร์ดหน่วยงาน",
      path: "/dashboard/department",
      matchPaths: ["/dashboard/department"],
      icon: LayoutDashboard,
    },
    {
      label: "จัดการคำถามหน่วยงาน",
      path: "/dashboard/questions",
      matchPaths: ["/dashboard/questions"],
      group: "questions",
      excludePaths: ["/dashboard/questions/central"],
      icon: ClipboardList,
    },
    {
      label: "สรุปข้อมูลรายปี",
      path: "/dashboard/yearly",
      matchPaths: ["/dashboard/yearly"],
      icon: BarChart3,
    },
    {
      label: "ออกรายงานหน่วยงาน",
      path: "/dashboard/reports",
      matchPaths: ["/dashboard/reports"],
      icon: FileSpreadsheet,
    },
    {
      label: "คิวอาร์โค้ดหน่วยงาน",
      path: "/dashboard/qrcode",
      matchPaths: ["/dashboard/qrcode"],
      icon: QrCode,
    },
    {
      label: "แก้ไขข้อมูลส่วนตัว",
      path: "/dashboard/profile",
      matchPaths: ["/dashboard/profile"],
      icon: UserRound,
    },
  ],
};
