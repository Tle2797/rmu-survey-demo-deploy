"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, ClipboardList, Loader2, Star } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

import { apiGet, apiPost } from "@/lib/api";
import { getThaiAlertMessage } from "@/lib/alert-message";

type Department = {
  id: number;
  name: string;
};

type Question = {
  id: number;
  text: string;
  type: "rating" | "text";
  scope: "central" | "department";
};

type SurveyInfo = {
  id: number;
  year_be: number;
  title: string;
};

type QuestionResponse = {
  total: number;
  items: Question[];
  survey?: SurveyInfo;
};

type RespondentGroup = "student" | "staff" | "public";
type GroupValue = "" | RespondentGroup;

type SubmitPayload = {
  department_id: number;
  respondent_group: RespondentGroup;
  token: string;
  answers: Array<{
    question_id: number;
    rating?: number;
    comment?: string;
  }>;
};

type AnswersByQuestion = Record<
  number,
  {
    rating?: number;
    comment?: string;
  }
>;

type DepartmentResponse = {
  department: Department;
};

const RATING_OPTIONS = [
  { score: 1, label: "น้อยที่สุด" },
  { score: 2, label: "น้อย" },
  { score: 3, label: "ปานกลาง" },
  { score: 4, label: "ดี" },
  { score: 5, label: "ดีมาก" },
] as const;

function getOrCreateToken(): string {
  const key = "rmu_survey_token";
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const token =
    crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  localStorage.setItem(key, token);
  return token;
}

function fireSurveyAlert(options: Record<string, unknown>) {
  return Swal.fire({
    confirmButtonColor: "#0369a1",
    customClass: {
      popup:
        "rounded-3xl border border-sky-100 shadow-[0_24px_80px_rgba(15,23,42,0.14)]",
      title: "text-xl font-semibold text-slate-900",
      htmlContainer: "text-sm leading-6 text-slate-500",
    },
    ...options,
  });
}

export default function SurveyDepartmentPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = React.use(params);
  const deptId = Number(departmentId);
  const router = useRouter();

  const [department, setDepartment] = useState<Department | null>(null);
  const [survey, setSurvey] = useState<SurveyInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswersByQuestion>({});
  const [group, setGroup] = useState<GroupValue>("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setLoadError("");

        if (Number.isNaN(deptId)) {
          throw new Error("ไม่พบหน่วยงานที่ต้องการประเมิน");
        }

        const nextToken = getOrCreateToken();
        if (cancelled) return;

        setToken(nextToken);
        setDepartment(null);
        setSurvey(null);
        setQuestions([]);
        setAnswers({});

        const deptRes = await apiGet<DepartmentResponse>(`/api/departments/${deptId}`);
        const qRes = await apiGet<QuestionResponse>(`/api/questions/${deptId}`);

        if (cancelled) return;

        setDepartment(deptRes.department);
        setSurvey(qRes.survey ?? null);
        setQuestions(qRes.items);
        setAnswers(
          qRes.items.reduce<AnswersByQuestion>((accumulator, question) => {
            accumulator[question.id] = {};
            return accumulator;
          }, {}),
        );
      } catch (error) {
        if (cancelled) return;

        const message = getThaiAlertMessage(error, "โหลดข้อมูลแบบประเมินไม่สำเร็จ");
        setLoadError(message);

        await fireSurveyAlert({
          icon: "error",
          title: "โหลดแบบประเมินไม่สำเร็จ",
          text: message,
          confirmButtonText: "ตกลง",
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [deptId, reloadKey]);

  const hasQuestions = questions.length > 0;

  const canSubmit = useMemo(() => {
    if (!token || !department || !group || !hasQuestions) return false;

    return questions.every((question) => {
      const answer = answers[question.id];
      if (!answer) return false;

      if (question.type === "rating") {
        return typeof answer.rating === "number";
      }

      return true;
    });
  }, [answers, department, group, hasQuestions, questions, token]);

  const ratingQuestions = useMemo(
    () => questions.filter((question) => question.type === "rating"),
    [questions],
  );
  const totalQuestions = questions.length;
  const totalRequiredQuestions = ratingQuestions.length;
  const answeredRequiredQuestionCount = useMemo(() => {
    return questions.reduce((total, question) => {
      if (question.type !== "rating") return total;

      const answer = answers[question.id];
      if (!answer) return total;

      return typeof answer.rating === "number" ? total + 1 : total;
    }, 0);
  }, [answers, questions]);
  const progressPercent =
    totalRequiredQuestions > 0
      ? Math.round((answeredRequiredQuestionCount / totalRequiredQuestions) * 100)
      : 100;
  const progressText = `ตอบแบบประเมินแล้ว ${answeredRequiredQuestionCount}/${totalQuestions} ข้อ`;

  const surveyYearLabel =
    survey?.year_be && Number.isFinite(survey.year_be)
      ? `ปีการศึกษา ${survey.year_be}`
      : "แบบประเมินที่เปิดใช้งาน";

  const handleSubmit = async () => {
    if (!hasQuestions) return;

    if (!group) {
      await fireSurveyAlert({
        icon: "warning",
        title: "ข้อมูลไม่ครบถ้วน",
        text: "กรุณาเลือกกลุ่มผู้ประเมินก่อนส่งแบบประเมิน",
        confirmButtonText: "ตกลง",
      });
      return;
    }

    try {
      setSubmitting(true);

      const payload: SubmitPayload = {
        department_id: deptId,
        respondent_group: group,
        token,
        answers: questions
          .map((question) => ({
            question_id: question.id,
            rating: question.type === "rating" ? answers[question.id]?.rating : undefined,
            comment:
              question.type === "text"
                ? answers[question.id]?.comment?.trim()
                : undefined,
          }))
          .filter((answer) => answer.rating !== undefined || Boolean(answer.comment)),
      };

      await apiPost<{
        response_id: number;
        slot_id: number;
        survey_id: number;
      }>("/api/responses", payload);

      await fireSurveyAlert({
        icon: "success",
        title: "ส่งแบบประเมินเรียบร้อย",
        text: "ระบบกำลังนำคุณไปยังหน้าถัดไป",
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
      });

      router.replace("/survey/success");
    } catch (error) {
      await fireSurveyAlert({
        icon: "error",
        title: "ส่งแบบประเมินไม่สำเร็จ",
        text: getThaiAlertMessage(error, "ไม่สามารถส่งแบบประเมินได้"),
        confirmButtonText: "ตกลง",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="relative min-h-[100svh] overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 px-4 py-6 text-slate-900 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

        <div className="relative z-10 mx-auto flex max-w-5xl items-center justify-center rounded-[28px] border border-sky-100/80 bg-white/90 px-6 py-16 shadow-[0_24px_60px_rgba(37,99,235,0.12)] backdrop-blur-sm">
          <div className="flex items-center gap-3 text-slate-700">
            <Loader2 className="h-5 w-5 animate-spin text-sky-600" aria-hidden="true" />
            <span className="text-base font-medium">กำลังโหลดข้อมูลแบบประเมิน...</span>
          </div>
        </div>
      </main>
    );
  }

  if (loadError && !department) {
    return (
      <main className="relative min-h-[100svh] overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 px-4 py-6 text-slate-900 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

        <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center rounded-[28px] border border-sky-100/80 bg-white/90 px-6 py-10 text-center shadow-[0_24px_60px_rgba(37,99,235,0.12)] backdrop-blur-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertCircle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">ไม่สามารถโหลดแบบประเมินได้</h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="mt-6 inline-flex items-center justify-center rounded-[18px] bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(37,99,235,0.18)] transition hover:brightness-105"
          >
            ลองโหลดอีกครั้ง
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50 px-4 py-6 text-slate-900 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[26px] border border-white/20 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 px-4 py-4 text-white shadow-[0_24px_60px_rgba(37,99,235,0.20)] sm:rounded-[28px] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl sm:h-40 sm:w-40" />
          <div className="pointer-events-none absolute -bottom-16 right-4 h-40 w-40 rounded-full bg-sky-200/15 blur-3xl sm:right-8 sm:h-48 sm:w-48" />

          <div className="relative z-10 flex items-start gap-3 sm:gap-5">
            <Image
              src="/logos/rmu.png"
              alt="ตรามหาวิทยาลัยราชภัฏมหาสารคาม"
              width={96}
              height={96}
              className="h-12 w-12 flex-shrink-0 object-contain drop-shadow-[0_8px_20px_rgba(15,23,42,0.16)] sm:h-16 sm:w-16 lg:h-20 lg:w-20"
              priority
            />

            <div className="min-w-0 flex-1">
              <h1 className="text-[13px] font-bold leading-[1.45] tracking-tight text-white sm:text-lg sm:leading-tight lg:text-2xl">
                <span className="block line-clamp-2">
                  {survey?.title?.trim() || "แบบประเมินความพึงพอใจในการให้บริการ"}
                </span>
                <span className="mt-1 block text-[12px] font-semibold leading-[1.4] text-sky-50 sm:mt-2 sm:text-base lg:text-xl">
                  มหาวิทยาลัยราชภัฏมหาสารคาม
                </span>
              </h1>

              <div className="mt-3 grid grid-cols-1 justify-items-start gap-2 sm:mt-4 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                <div className="flex w-full min-w-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-2 text-left text-[11px] leading-4 text-sky-50 backdrop-blur-sm sm:inline-flex sm:w-auto sm:gap-2 sm:px-3 sm:text-sm">
                  <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-white sm:h-4 sm:w-4" aria-hidden="true" />
                  <span className="truncate">หน่วยงาน: {department?.name || "-"}</span>
                </div>

                <div className="flex w-full min-w-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-2 text-left text-[11px] leading-4 text-sky-50 backdrop-blur-sm sm:inline-flex sm:w-auto sm:gap-2 sm:px-3 sm:text-sm">
                  <ClipboardList className="h-3.5 w-3.5 flex-shrink-0 text-white sm:h-4 sm:w-4" aria-hidden="true" />
                  <span className="truncate">{surveyYearLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {hasQuestions ? (
          <section className="rounded-[28px] border border-sky-100/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="mt-1 text-base font-semibold text-slate-900 sm:text-xl">{progressText}</h2>
              </div>
              <div className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-700">
                  คำถามทั้งหมด {totalQuestions} ข้อ
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </section>
        ) : null}

        {hasQuestions ? (
          <section className="rounded-[28px] border border-sky-100/80 bg-white/90 p-6 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm sm:p-7">
            <div className="max-w-xl">
              <h2 className="mt-2 text-base font-semibold text-slate-900 sm:text-xl">เลือกกลุ่มผู้ประเมิน</h2>
              <select
                className={`mt-4 w-full rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm shadow-sm outline-none transition hover:border-sky-200 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100 ${
                  group ? "text-slate-800" : "text-slate-500"
                }`}
                value={group}
                onChange={(event) => setGroup(event.target.value as GroupValue)}
              >
                <option value="">เลือกกลุ่มผู้ทำแบบประเมิน</option>
                <option value="student">นักศึกษา</option>
                <option value="staff">บุคลากร</option>
                <option value="public">บุคคลทั่วไป</option>
              </select>
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          {hasQuestions ? (
            questions.map((question, index) => (
              <article
                key={question.id}
                className="rounded-[28px] border border-sky-100/80 bg-white/95 p-5 shadow-[0_16px_36px_rgba(37,99,235,0.07)] backdrop-blur-sm"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="mt-0.5 flex h-8 min-w-8 flex-shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-2 text-sm font-semibold text-sky-700 shadow-sm sm:h-9 sm:min-w-9">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-semibold leading-6 text-slate-900 sm:text-lg sm:leading-7">
                      {question.text}
                      {question.type === "rating" ? (
                        <span className="ml-1 text-red-500" aria-label="จำเป็นต้องเลือก">*</span>
                      ) : null}
                    </h3>
                  </div>
                </div>

                {question.type === "rating" ? (
                  <div className="mt-5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      {RATING_OPTIONS.map(({ score, label }) => (
                        <button
                          key={score}
                          type="button"
                          className={`rounded-[22px] border px-4 py-4 text-left transition ${
                            answers[question.id]?.rating === score
                              ? "border-sky-400 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 text-white shadow-[0_16px_32px_rgba(37,99,235,0.22)]"
                              : "border-sky-100 bg-white text-slate-700 shadow-sm hover:border-sky-300 hover:bg-sky-50/80 hover:shadow-[0_12px_28px_rgba(56,189,248,0.10)]"
                          }`}
                          onClick={() =>
                            setAnswers((previous) => ({
                              ...previous,
                              [question.id]: {
                                ...previous[question.id],
                                rating: score,
                              },
                            }))
                          }
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1">
                              {Array.from({ length: score }).map((_, starIndex) => (
                                <Star
                                  key={starIndex}
                                  className={`h-4 w-4 ${
                                    answers[question.id]?.rating === score
                                      ? "fill-amber-300 text-amber-300"
                                      : "fill-amber-400 text-amber-400"
                                  }`}
                                  aria-hidden="true"
                                />
                              ))}
                            </div>
                            <span className="text-base font-semibold">{score}</span>
                          </div>
                          <div className="mt-3 text-sm font-medium">{label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <textarea
                    className="mt-5 min-h-32 w-full rounded-[22px] border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    rows={3}
                    placeholder="กรุณาแสดงความคิดเห็นเพิ่มเติม"
                    value={answers[question.id]?.comment ?? ""}
                    onChange={(event) =>
                      setAnswers((previous) => ({
                        ...previous,
                        [question.id]: {
                          ...previous[question.id],
                          comment: event.target.value,
                        },
                      }))
                    }
                  />
                )}
              </article>
            ))
          ) : (
            <article className="rounded-[28px] border border-dashed border-sky-200 bg-sky-50/50 p-8 text-center shadow-[0_16px_36px_rgba(37,99,235,0.05)] backdrop-blur-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <AlertCircle className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">หน่วยงานนี้ยังไม่มีคำถาม</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                ตอนนี้ยังไม่มีคำถามสำหรับหน่วยงานนี้ในแบบประเมิน กรุณาติดต่อผู้ดูแลระบบหรือกลับมาใหม่ภายหลัง
              </p>
            </article>
          )}
        </section>

        {hasQuestions ? (
          <section className="rounded-[28px] border border-sky-100/80 bg-white/90 p-6 shadow-[0_16px_40px_rgba(37,99,235,0.08)] backdrop-blur-sm sm:p-7">
            <button
              type="button"
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
              className={`inline-flex w-full items-center justify-center rounded-[22px] py-3.5 text-base font-semibold transition ${
                canSubmit && !submitting
                  ? "bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white shadow-[0_16px_34px_rgba(37,99,235,0.20)] hover:brightness-105"
                  : "cursor-not-allowed bg-slate-200 text-slate-500"
              }`}
            >
              {submitting ? "กำลังส่งแบบประเมิน..." : "ส่งแบบประเมิน"}
            </button>
          </section>
        ) : null}
      </div>
    </main>
  );
}
