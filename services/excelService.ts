
import ExcelJS from 'exceljs';

export const exportToExcel = async (results: any[], loanId: string) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Audit Report');

  if (results.length === 0) return;

  // Get columns from the first row and ensure "Found_In_File" is always first
  const allKeys = Object.keys(results[0].row);
  const otherKeys = allKeys.filter(k => k !== 'Found_In_File');
  const finalColumns = ['Found_In_File', ...otherKeys];

  worksheet.columns = finalColumns.map(col => ({ 
    header: col, 
    key: col, 
    width: col === 'Found_In_File' ? 30 : 20 
  }));

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Slate-800
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Add rows and apply highlighting
  results.forEach((item, rowIndex) => {
    const rowData = item.row;
    const row = worksheet.addRow(rowData);
    
    // Highlight cells that changed based on the 'changes' set
    item.changes.forEach((colKey: string) => {
      const colIndex = finalColumns.indexOf(colKey) + 1;
      if (colIndex > 0) {
        const cell = row.getCell(colIndex);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF00' } // Bright Yellow
        };
        cell.font = {
          bold: true,
          color: { argb: 'FF000000' }
        };
        cell.border = {
          top: {style:'thin', color: {argb:'FFB45309'}},
          left: {style:'thin', color: {argb:'FFB45309'}},
          bottom: {style:'thin', color: {argb:'FFB45309'}},
          right: {style:'thin', color: {argb:'FFB45309'}}
        };
      }
    });

    // Style the File Name column to be distinct
    const fileCell = row.getCell(1);
    fileCell.font = { italic: true, color: { argb: 'FF64748B' } };
  });

  // Global alignment
  worksheet.eachRow((row) => {
    row.alignment = { vertical: 'middle' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Audit_Report_Loan_${loanId}_Full.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};
