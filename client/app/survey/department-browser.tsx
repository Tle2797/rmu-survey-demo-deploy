"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Building2, Search } from "lucide-react";

type Department = {
  id: number;
  name: string;
};

const MOBILE_PAGE_SIZE = 10;
const TABLET_PAGE_SIZE = 10;
const DESKTOP_PAGE_SIZE = 10;

function getDepartmentPageSize(viewportWidth: number) {
  if (viewportWidth >= 1024) return DESKTOP_PAGE_SIZE;
  if (viewportWidth >= 640) return TABLET_PAGE_SIZE;
  return MOBILE_PAGE_SIZE;
}

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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(TABLET_PAGE_SIZE);

  useEffect(() => {
    const syncItemsPerPage = () =>
      setItemsPerPage(getDepartmentPageSize(window.innerWidth));

    syncItemsPerPage();
    window.addEventListener("resize", syncItemsPerPage);

    return () => window.removeEventListener("resize", syncItemsPerPage);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleDepartments = normalizedQuery
    ? departments.filter((dept) =>
        dept.name.toLowerCase().includes(normalizedQuery),
      )
    : departments;
  const totalPages =
    visibleDepartments.length === 0
      ? 0
      : Math.ceil(visibleDepartments.length / itemsPerPage);
  const safeCurrentPage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const paginatedDepartments = visibleDepartments.slice(
    startIndex,
    startIndex + itemsPerPage,
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
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-left text-sm text-slate-800 placeholder:text-left placeholder:text-slate-400 shadow-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50 sm:text-base"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 shadow-sm sm:text-sm">
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                      ทั้งหมด {total.toLocaleString("th-TH")} หน่วยงาน
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5">
                {visibleDepartments.length === 0 && query ? (
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
                ) : visibleDepartments.length === 0 ? (
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
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {paginatedDepartments.map((dept) => (
                        <DepartmentCard key={dept.id} dept={dept} />
                      ))}
                    </div>

                    {visibleDepartments.length > 0 ? (
                      <div className="mt-5 flex flex-col items-center gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-center">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                            disabled={safeCurrentPage <= 1}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            ย้อนกลับ
                          </button>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                            หน้า {safeCurrentPage} / {totalPages}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentPage(
                                Math.min(totalPages, safeCurrentPage + 1),
                              )
                            }
                            disabled={safeCurrentPage >= totalPages}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            ถัดไป
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function DepartmentCard({ dept }: { dept: Department }) {
  return (
    <Link
      href={`/survey/${dept.id}`}
      aria-label={`เลือกหน่วยงาน ${dept.name}`}
      className="group relative flex h-full min-h-[156px] flex-col justify-between overflow-hidden rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-sky-50/60 p-5 text-left shadow-[0_12px_30px_rgba(37,99,235,0.06)] transition duration-200 hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_18px_45px_rgba(37,99,235,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 sm:p-6"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 opacity-80" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] ring-1 ring-white/35">
            <Building2
              className="h-6 w-6"
              strokeWidth={2.2}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-sky-600/80 sm:text-xs">
              หน่วยงาน
            </p>
            <h2 className="mt-2 break-words text-base font-bold leading-snug text-slate-900 sm:text-xl">
              {dept.name}
            </h2>
          </div>
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-end border-t border-slate-200/70 pt-4">
        <span className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-[11px] font-semibold text-white shadow-sm transition group-hover:bg-sky-700 sm:text-xs">
          ทำแบบประเมิน
        </span>
      </div>
    </Link>
  );
}
