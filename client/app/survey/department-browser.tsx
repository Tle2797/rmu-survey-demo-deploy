"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Building2, Search } from "lucide-react";

type Department = {
  id: number;
  name: string;
  department_group_id: number;
  department_group_name: string;
  department_group_display_order: number;
};

type DepartmentGroup = {
  id: number;
  name: string;
  displayOrder: number;
  departments: Department[];
};

export default function DepartmentBrowser({
  departments,
  total,
  loadError,
  initialQuery = "",
}: {
  departments: Department[];
  total: number;
  loadError: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);

  const normalizedQuery = query.trim().toLowerCase();
  const departmentGroups = departments.reduce<DepartmentGroup[]>((groups, dept) => {
    const existingGroup = groups.find(
      (group) => group.id === dept.department_group_id,
    );

    if (existingGroup) {
      existingGroup.departments.push(dept);
      return groups;
    }

    groups.push({
      id: dept.department_group_id,
      name: dept.department_group_name,
      displayOrder: dept.department_group_display_order,
      departments: [dept],
    });
    return groups;
  }, []);
  const visibleGroups = departmentGroups
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id)
    .map((group) => {
      if (!normalizedQuery) return group;

      const groupMatches = group.name.toLowerCase().includes(normalizedQuery);
      return {
        ...group,
        departments: groupMatches
          ? group.departments
          : group.departments.filter((dept) =>
              dept.name.toLowerCase().includes(normalizedQuery),
            ),
      };
    })
    .filter((group) => group.departments.length > 0);
  const visibleDepartmentCount = visibleGroups.reduce(
    (sum, group) => sum + group.departments.length,
    0,
  );

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 px-4 py-6 text-slate-900 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 sm:gap-8">
        <section className="relative overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-5 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)] sm:p-6 lg:p-8">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 right-8 h-48 w-48 rounded-full bg-sky-200/15 blur-3xl" />

          <div className="survey-hero-inner relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <Image
              src="/logos/rmu.png"
              alt="ตรามหาวิทยาลัยราชภัฏมหาสารคาม"
              width={96}
              height={96}
              className="survey-hero-logo h-16 w-16 flex-shrink-0 object-contain drop-shadow-[0_8px_20px_rgba(15,23,42,0.16)] sm:h-20 sm:w-20 lg:mt-2 lg:h-24 lg:w-24"
              priority
            />

            <div className="survey-hero-copy min-w-0">
              <h1 className="survey-hero-title mt-2 text-lg font-bold leading-tight tracking-tight sm:text-xl md:text-2xl lg:text-3xl">
                <span className="block">ระบบประเมินความพึงพอใจ การใช้บริการหน่วยงาน</span>
                <span className="mt-2 block">
                  ภายในมหาวิทยาลัยราชภัฏมหาสารคาม 
                </span>
                <span className="mt-2 block">
                  โดยใช้เทคโนโลยีคิวอาร์โค้ด
                </span>
              </h1>
              <h1 className="survey-hero-title-mobile mt-1 hidden text-base font-bold leading-tight tracking-tight">
                <span className="block">ระบบประเมินความพึงพอใจ</span>
                <span className="block">การใช้บริการหน่วยงาน</span>
                <span className="block">ภายในมหาวิทยาลัยราชภัฏมหาสารคาม โดยใช้เทคโนโลยี</span>
                <span className="block">คิวอาร์โค้ด</span>
              </h1>
            </div>
          </div>
          <style jsx>{`
            @media (min-width: 340px) and (max-width: 479px) {
              .survey-hero-inner {
                flex-direction: row;
                align-items: center;
                gap: 0.875rem;
              }

              .survey-hero-copy {
                min-width: 0;
                flex: 1 1 auto;
              }

              .survey-hero-title {
                display: none;
              }

              .survey-hero-title-mobile {
                display: block;
                margin-top: 0;
                line-height: 1.35;
              }
            }

            @media (min-width: 340px) and (max-width: 413px) {
              .survey-hero-logo {
                width: 3.75rem;
                height: 3.75rem;
                margin-top: 0;
                align-self: center;
              }

              .survey-hero-title-mobile {
                font-size: 0.88rem;
              }
            }

            @media (min-width: 414px) and (max-width: 479px) {
              .survey-hero-logo {
                width: 4rem;
                height: 4rem;
                margin-top: 0;
                align-self: center;
              }

              .survey-hero-title-mobile {
                font-size: 1rem;
              }
            }
          `}</style>
        </section>

        <section className="rounded-[28px] border border-sky-100/80 bg-white/90 p-4 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm sm:p-6 lg:p-7">
          <div className="flex flex-col gap-3">
            <div className="min-w-0">
              <h2 className="mt-0 text-xl font-bold text-slate-900 sm:text-3xl">
                เลือกหน่วยงานเพื่อทำแบบประเมิน
              </h2>
            </div>
          </div>

          {loadError ? (
            <div className="mt-5 flex flex-col gap-4 rounded-[24px] border border-rose-200 bg-rose-50/80 px-5 py-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-rose-600 shadow-sm ring-1 ring-rose-100">
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </div>

                <div>
                  <h3 className="text-base font-semibold text-rose-900">
                    ไม่สามารถโหลดรายชื่อหน่วยงานได้
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-rose-700">
                    {loadError}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-5 rounded-3xl border border-sky-100/80 bg-white/95 p-4 shadow-[0_14px_32px_rgba(37,99,235,0.06)] sm:p-5">
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="department-search"
                      className="mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm"
                    >
                      ค้นหาชื่อหน่วยงาน
                    </label>
                    <div className="relative">
                      <input
                        id="department-search"
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-left text-sm text-slate-800 placeholder:text-left placeholder:text-slate-400 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50 sm:text-base"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 shadow-sm sm:text-sm">
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                      {normalizedQuery
                        ? `พบ ${visibleDepartmentCount.toLocaleString("th-TH")} จากทั้งหมด ${total.toLocaleString("th-TH")} หน่วยงาน`
                        : `ทั้งหมด ${total.toLocaleString("th-TH")} หน่วยงาน`}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5">
                {visibleDepartmentCount === 0 && query ? (
                  <div className="rounded-[24px] border border-dashed border-sky-200 bg-sky-50/50 px-5 py-10 text-center sm:px-8 sm:py-12">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm ring-1 ring-sky-100">
                      <Search className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">
                      ไม่พบหน่วยงานที่ตรงกับคำค้น
                    </h3>
                    <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      ลองพิมพ์คำค้นใหม่ให้สั้นลง หรือเคลียร์ข้อความที่ค้นหาอยู่
                    </p>
                  </div>
                ) : visibleDepartmentCount === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-sky-200 bg-sky-50/50 px-5 py-10 text-center sm:px-8 sm:py-12">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm ring-1 ring-sky-100">
                      <Building2 className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">
                      ยังไม่มีหน่วยงานในระบบ
                    </h3>
                    <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      ตอนนี้ backend ยังไม่ได้ส่งรายการหน่วยงานกลับมา
                      หากควรมีข้อมูลแล้ว กรุณาลองรีเฟรชหน้าอีกครั้ง
                      หรือแจ้งเจ้าหน้าที่ระบบ
                    </p>
                  </div>
                ) : (
                  <div className="space-y-7">
                    {visibleGroups.map((group) => (
                      <section key={group.id} className="space-y-2">
                        <div className="flex items-center gap-3 px-4 py-1 text-sm text-slate-800 sm:px-5">
                          <h3 className="font-semibold">{group.name}</h3>
                          <span className="ml-auto whitespace-nowrap text-xs text-slate-500 sm:text-sm">
                            {group.departments.length.toLocaleString("th-TH")} หน่วยงาน
                          </span>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(37,99,235,0.06)]">
                          <div className="overflow-x-auto">
                            <table className="w-full table-fixed border-collapse text-left sm:min-w-[560px] sm:table-auto">
                              <thead className="bg-gradient-to-r from-sky-600 to-blue-600 text-white">
                                <tr>
                                  <th className="w-12 px-1 py-3 text-center text-[11px] font-semibold sm:w-24 sm:px-5 sm:py-3.5 sm:text-sm">
                                    ลำดับ
                                  </th>
                                  <th className="px-2 py-3 text-[11px] font-semibold sm:px-5 sm:py-3.5 sm:text-sm">
                                    หน่วยงาน
                                  </th>
                                  <th className="w-20 px-1 py-3 text-center text-[10px] font-semibold sm:w-44 sm:px-5 sm:py-3.5 sm:text-sm">
                                    แบบประเมิน
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {group.departments.map((dept, index) => (
                                  <tr
                                    key={dept.id}
                                    className="transition-colors hover:bg-sky-50/60"
                                  >
                                    <td className="px-1 py-3 text-center text-xs font-medium text-slate-600 sm:px-5 sm:py-4 sm:text-sm">
                                      {(index + 1).toLocaleString("th-TH")}
                                    </td>
                                    <td className="break-words px-2 py-3 text-[11px] font-medium leading-5 text-slate-900 sm:px-5 sm:py-4 sm:text-base">
                                      {dept.name}
                                    </td>
                                    <td className="px-1.5 py-2.5 text-center sm:px-5 sm:py-3">
                                      <Link
                                        href={`/survey/${dept.id}`}
                                        aria-label={`เลือกหน่วยงาน ${dept.name}`}
                                        className="inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-1.5 py-2 text-[10px] font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 sm:w-auto sm:rounded-xl sm:px-4 sm:text-sm"
                                      >
                                        <span className="sm:hidden">ประเมิน</span>
                                        <span className="hidden sm:inline">ทำแบบประเมิน</span>
                                      </Link>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
