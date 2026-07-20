export type ExcelXmlCellValue = string | number | null | undefined;

export type ExcelXmlCell = {
  value: ExcelXmlCellValue;
  styleId?: string;
  type?: "String" | "Number";
  mergeAcross?: number;
};

export type ExcelXmlRow = {
  cells: ExcelXmlCell[];
  height?: number;
  autoFitHeight?: boolean;
};

export type ExcelXmlSheet = {
  name: string;
  columns: number[];
  rows: ExcelXmlRow[];
  landscape?: boolean;
};

function escapeExcelXml(value: ExcelXmlCellValue) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\r?\n/g, "&#10;");
}

function renderExcelCell(cell: ExcelXmlCell) {
  const styleId = cell.styleId ?? "Cell";
  const merge = cell.mergeAcross ? ` ss:MergeAcross="${cell.mergeAcross}"` : "";
  const type = cell.type ?? "String";

  return `<Cell ss:StyleID="${styleId}"${merge}><Data ss:Type="${type}">${escapeExcelXml(
    cell.value,
  )}</Data></Cell>`;
}

function renderExcelRow(row: ExcelXmlRow) {
  const height = row.height ? ` ss:Height="${row.height}"` : "";
  const autoFit = row.autoFitHeight ? ` ss:AutoFitHeight="1"` : "";

  return `<Row${height}${autoFit}>${row.cells.map(renderExcelCell).join("")}</Row>`;
}

function renderWorksheet(sheet: ExcelXmlSheet) {
  const columns = sheet.columns
    .map((width) => `<Column ss:Width="${width}"/>`)
    .join("");

  return `<Worksheet ss:Name="${escapeExcelXml(sheet.name)}">
    <Table>
      ${columns}
      ${sheet.rows.map(renderExcelRow).join("\n      ")}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <PageSetup>
        <Layout x:Orientation="${sheet.landscape === false ? "Portrait" : "Landscape"}"/>
      </PageSetup>
      <FitToPage/>
    </WorksheetOptions>
  </Worksheet>`;
}

export function excelCell(
  value: ExcelXmlCellValue,
  styleId = "Cell",
  options?: Pick<ExcelXmlCell, "type" | "mergeAcross">,
): ExcelXmlCell {
  return {
    value,
    styleId,
    ...options,
  };
}

export function spacerRow(columnCount: number, height = 16): ExcelXmlRow {
  return {
    height,
    cells: [excelCell("", "Default", { mergeAcross: Math.max(columnCount - 1, 0) })],
  };
}

export function sanitizeExcelFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
}

export function buildExcelXmlWorkbook({
  documentTitle,
  sheets,
}: {
  documentTitle: string;
  sheets: ExcelXmlSheet[];
}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${escapeExcelXml(documentTitle)}</Title>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
      <Font ss:FontName="Tahoma" ss:Size="11" ss:Color="#0F172A"/>
    </Style>
    <Style ss:ID="Title" ss:Parent="Default">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Tahoma" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#16A34A" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="MetaLabel" ss:Parent="Default">
      <Alignment ss:Horizontal="Left" ss:Vertical="Top" ss:WrapText="0"/>
      <Font ss:FontName="Tahoma" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
    </Style>
    <Style ss:ID="MetaValue" ss:Parent="Default">
      <Font ss:FontName="Tahoma" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
    </Style>
    <Style ss:ID="MetaValueLeft" ss:Parent="MetaValue">
      <Alignment ss:Horizontal="Left" ss:Vertical="Top" ss:WrapText="1"/>
    </Style>
    <Style ss:ID="MetaValueRight" ss:Parent="MetaValue">
      <Alignment ss:Horizontal="Right" ss:Vertical="Top" ss:WrapText="1"/>
    </Style>
    <Style ss:ID="SectionTitle" ss:Parent="Default">
      <Font ss:FontName="Tahoma" ss:Size="13" ss:Bold="1" ss:Color="#000000"/>
    </Style>
    <Style ss:ID="Header" ss:Parent="Default">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Tahoma" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#22C55E" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
      </Borders>
    </Style>
    <Style ss:ID="Cell" ss:Parent="Default">
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
      </Borders>
    </Style>
    <Style ss:ID="CenterCell" ss:Parent="Cell">
      <Alignment ss:Horizontal="Center" ss:Vertical="Top" ss:WrapText="1"/>
    </Style>
  </Styles>
  ${sheets.map(renderWorksheet).join("\n  ")}
</Workbook>`;
}

export function downloadExcelFile(fileName: string, content: string) {
  const blob = new Blob(["\ufeff", content], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
