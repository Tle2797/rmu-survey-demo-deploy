import { db } from "../config/db";
import {
  generateCentralQRCodeAsset,
  generateDepartmentQRCodeAsset,
  readQRCodeAssetBase64,
} from "../services/qrcode";

export async function listQRCodes() {
  const centralRes = await db.query(
    `SELECT id, image_path, link_target, created_at
     FROM qrcodes
     WHERE type = 'central'
     LIMIT 1`
  );
  const central = centralRes.rows[0] ?? null;

  const deptRes = await db.query(
    `SELECT
       d.id,
       d.name,
       d.is_active,
       q.id       AS qrcode_id,
       q.image_path,
       q.link_target,
       q.created_at AS qr_created_at
     FROM departments d
     LEFT JOIN qrcodes q
       ON q.department_id = d.id
      AND q.type = 'department'
     ORDER BY d.created_at DESC, d.id DESC`
  );

  const departments = deptRes.rows;

  const total = departments.length;
  const hasQr = departments.filter((d) => !!d.qrcode_id).length;
  const noQr = total - hasQr;

  return {
    central,
    departments,
    stats: {
      total,
      has_qr: hasQr,
      no_qr: noQr,
      central_ready: !!central,
    },
  };
}

export async function generateQRCode({ body, set }: any) {
  const b = body as any;
  const type: string = b?.type ?? "";

  if (type === "central") {
    const qrAsset = await generateCentralQRCodeAsset();

    await db.query(
      `DELETE FROM qrcodes WHERE type = 'central'`
    );
    await db.query(
      `INSERT INTO qrcodes (type, department_id, image_path, link_target, is_active)
       VALUES ('central', NULL, $1, $2, true)`,
      [qrAsset.imagePath, qrAsset.link]
    );

    const row = await db.query(
      `SELECT id, type, image_path, link_target, created_at FROM qrcodes WHERE type = 'central' LIMIT 1`
    );
    return { message: "QR Code เน€เธยเน€เธเธ…เน€เธเธ’เน€เธยเน€เธเธเน€เธเธเน€เธยเน€เธเธ’เน€เธยเน€เธเธเน€เธเธ“เน€เธโฌเน€เธเธเน€เธยเน€เธย", qrcode: row.rows[0] };
  }

  if (type === "department") {
    const deptId = Number(b?.department_id);
    if (!Number.isFinite(deptId) || deptId <= 0) {
      set.status = 400;
      return { message: "department_id is required" };
    }

    const deptRes = await db.query(
      `SELECT id, name FROM departments WHERE id = $1`,
      [deptId]
    );
    if ((deptRes.rowCount ?? 0) === 0) {
      set.status = 404;
      return { message: "Department not found" };
    }

    const qrAsset = await generateDepartmentQRCodeAsset(deptId);

    await db.query(
      `DELETE FROM qrcodes WHERE type = 'department' AND department_id = $1`,
      [deptId]
    );
    await db.query(
      `INSERT INTO qrcodes (type, department_id, image_path, link_target, is_active)
       VALUES ('department', $1, $2, $3, true)`,
      [deptId, qrAsset.imagePath, qrAsset.link]
    );

    const row = await db.query(
      `SELECT id, type, department_id, image_path, link_target, created_at
       FROM qrcodes WHERE type = 'department' AND department_id = $1 LIMIT 1`,
      [deptId]
    );
    return { message: "QR Code เน€เธเธเน€เธยเน€เธยเน€เธเธเน€เธเธเน€เธยเน€เธเธ’เน€เธยเน€เธเธเน€เธเธเน€เธยเน€เธเธ’เน€เธยเน€เธเธเน€เธเธ“เน€เธโฌเน€เธเธเน€เธยเน€เธย", qrcode: row.rows[0] };
  }

  set.status = 400;
  return { message: "type must be 'central' or 'department'" };
}

export async function downloadQRCode({ params, set }: any) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    set.status = 400;
    return { message: "Invalid id" };
  }

  const res = await db.query(
    `SELECT image_path, link_target, type, department_id FROM qrcodes WHERE id = $1 LIMIT 1`,
    [id]
  );

  if (res.rowCount === 0) {
    set.status = 404;
    return { message: "QR code not found" };
  }

  const { image_path, link_target, type, department_id } = res.rows[0];

  const downloadName =
    type === "central" ? "qr_central.png" : `qr_dept_${department_id}.png`;

  const base64 = await readQRCodeAssetBase64(image_path, link_target);
  if (!base64) {
    set.status = 404;
    return { message: "File not found on disk" };
  }

  return {
    filename: downloadName,
    content_type: "image/png",
    data: base64,
  };
}
