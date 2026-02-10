
import ExcelJS from 'exceljs';

export const exportToExcel = async (results: any[], loanId: string) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Audit Report');

  if (results.length === 0) return;

  // Get columns from the first row
  const columns = Object.keys(results[0].row);
  worksheet.columns = columns.map(col => ({ header: col, key: col, width: 20 }));

  // Add rows and apply highlighting
  results.forEach((item, rowIndex) => {
    const row = worksheet.addRow(item.row);
    
    // Highlight cells that changed (skip the first row for comparison logic, 
    // though the 'changes' set already handles logic)
    item.changes.forEach((colKey: string) => {
      const colIndex = columns.indexOf(colKey) + 1;
      if (colIndex > 0) {
        const cell = row.getCell(colIndex);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF00' } // Yellow
        };
        cell.font = {
          bold: true,
          color: { argb: 'FF000000' }
        };
      }
    });
  });

  // Make header bold
  worksheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Audit_Report_Loan_${loanId}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};
