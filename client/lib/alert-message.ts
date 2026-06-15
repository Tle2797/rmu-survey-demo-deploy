type MessageLike = {
  message?: unknown;
};

function extractRawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as MessageLike).message === "string"
  ) {
    return (error as MessageLike).message as string;
  }
  return "";
}

function tryParseJsonMessage(message: string): string {
  try {
    const parsed = JSON.parse(message) as MessageLike;
    if (parsed && typeof parsed.message === "string") {
      return parsed.message.trim();
    }
  } catch {
    // Not JSON.
  }

  return message.trim();
}

const exactTranslations: Record<string, string> = {
  "username must not contain Thai characters": "ชื่อผู้เข้าใช้งานระบบห้ามกรอกภาษาไทย",
  "username/password is required": "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน",
  "username is required": "กรุณากรอกชื่อผู้ใช้",
  "username already exists": "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว",
  "email already exists": "อีเมลนี้มีอยู่ในระบบแล้ว",
  "password must be at least 8 characters":
    "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
  "department_id is required for dept_head/staff":
    "กรุณาเลือกหน่วยงานสำหรับตำแหน่งนี้",
  "Invalid user id": "รหัสผู้ใช้ไม่ถูกต้อง",
  "User not found": "ไม่พบข้อมูลผู้ใช้",
  "user_id is required": "กรุณาระบุผู้ใช้",
  "email is required": "กรุณากรอกอีเมล",
  "email/otp is required": "กรุณากรอกอีเมลและรหัส OTP",
  "resetToken/password is required": "ข้อมูลรีเซ็ตรหัสผ่านไม่ครบถ้วน",
  "Invalid credentials": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
  "User approval pending":
    "บัญชีผู้ใช้นี้อยู่ระหว่างรอการอนุมัติจากผู้ดูแลระบบ",
  "User registration rejected": "บัญชีผู้ใช้นี้ไม่ได้รับการอนุมัติ",
  "User is inactive": "บัญชีผู้ใช้นี้ถูกปิดใช้งาน",
  "รูปแบบอีเมลไม่ถูกต้อง": "รูปแบบอีเมลไม่ถูกต้อง",
  "Unauthorized: missing token":
    "ไม่พบข้อมูลการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
  "Unauthorized: invalid or expired token":
    "เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
  Unauthorized: "ไม่มีสิทธิ์เข้าถึงข้อมูล",
  "Request failed": "เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบ",
  "Invalid department_id": "ไม่พบหน่วยงานที่ต้องการประเมิน",
  "Invalid respondent_group": "กรุณาเลือกกลุ่มผู้ประเมินให้ถูกต้อง",
  "Invalid token":
    "ไม่สามารถยืนยันสิทธิ์การทำแบบประเมินได้ กรุณาเปิดแบบประเมินใหม่อีกครั้ง",
  "answers is required": "กรุณาตอบแบบประเมินให้ครบก่อนส่ง",
  "Active survey not found": "ยังไม่มีแบบประเมินที่เปิดใช้งาน",
  "Survey is not open yet": "แบบประเมินนี้ยังไม่เปิดให้ทำในขณะนี้",
  "Survey is closed": "แบบประเมินนี้ปิดรับการประเมินแล้ว",
  "Out of allowed time slot":
    "ขณะนี้อยู่นอกช่วงเวลาที่อนุญาตให้ทำแบบประเมิน กรุณาทำแบบประเมินในเวลาที่กำหนด",
  "Department not found": "ไม่พบหน่วยงานที่ต้องการประเมิน หรือหน่วยงานนี้ปิดใช้งานอยู่",
  "No questions configured for this department":
    "หน่วยงานนี้ยังไม่มีคำถามสำหรับแบบประเมิน",
  "Already submitted the maximum number of times in this time slot":
    "คุณทำแบบประเมินครบตามจำนวนครั้งที่กำหนดไว้สำหรับรอบเวลานี้แล้ว กรุณารอรอบถัดไปหรือวันถัดไป",
  "Already submitted in this time slot":
    "คุณทำแบบประเมินนี้ไปแล้วในรอบเวลานี้ กรุณารอรอบถัดไปหรือวันถัดไป",
  "Internal server error": "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
};

const patternTranslations: Array<{
  test: (message: string) => boolean;
  text: string;
}> = [
  {
    test: (message) => message.startsWith("Duplicate question_id"),
    text: "ระบบพบข้อมูลคำถามซ้ำในการส่งแบบประเมิน กรุณาลองส่งใหม่อีกครั้ง",
  },
  {
    test: (message) => message.startsWith("Invalid question_id"),
    text: "ข้อมูลคำถามของแบบประเมินไม่ถูกต้อง กรุณารีเฟรชหน้าแล้วลองใหม่อีกครั้ง",
  },
  {
    test: (message) => message.startsWith("Invalid rating for question_id"),
    text: "กรุณาให้คะแนนคำถามให้ครบถ้วนและถูกต้องก่อนส่งแบบประเมิน",
  },
  {
    test: (message) => message.startsWith("Invalid comment for question_id"),
    text: "ความคิดเห็นที่กรอกมีรูปแบบไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่อีกครั้ง",
  },
  {
    test: (message) => /^Request failed \(\d+\)$/.test(message),
    text: "เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบ กรุณาลองใหม่อีกครั้ง",
  },
];

function translateMessage(message: string): string | null {
  if (exactTranslations[message]) {
    return exactTranslations[message];
  }

  const matchedPattern = patternTranslations.find((item) => item.test(message));
  return matchedPattern?.text ?? null;
}

export function getThaiAlertMessage(error: unknown, fallback: string) {
  const rawMessage = extractRawMessage(error);
  if (!rawMessage) return fallback;

  const message = tryParseJsonMessage(rawMessage);
  if (!message) return fallback;

  const translated = translateMessage(message);
  if (translated) {
    return translated;
  }

  if (/^[\x00-\x7F]+$/.test(message)) {
    return fallback;
  }

  return message;
}
