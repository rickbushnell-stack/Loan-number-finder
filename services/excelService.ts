
import ExcelJS from 'exceljs';

export const exportToExcel = async (results: any[], loanId: string, columnKeys: string[]) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Audit Report');

  if (results.length === 0 || columnKeys.length === 0) return;

  // Set up worksheet columns with appropriate widths
  worksheet.columns = columnKeys.map(col => ({ 
    header: col, 
    key: col, 
    width: col === 'Found_In_File' ? 40 : 25 
  }));

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Slate-800
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Add rows and apply highlighting
  results.forEach((item) => {
    const rowData = item.row;
    const row = worksheet.addRow(rowData);
    
    // Highlight cells that changed based on the 'changes' set
    item.changes.forEach((colKey: string) => {
      // Find the position in our priority-ordered column set
      const colIndex = columnKeys.indexOf(colKey) + 1;
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

    // Consistent styling for first two columns (File and Loan ID)
    const fileCell = row.getCell(1);
    fileCell.font = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
    fileCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' } // Slate-50 background
    };

    const idCell = row.getCell(2);
    idCell.font = { bold: true, color: { argb: 'FF334155' } };
    idCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' } // Slate-50 background
    };
  });

  // Global alignment and row heights
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > 1) {
      row.height = 22;
      row.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    }
  });

  // Freeze top row and first two columns for easy auditing
  worksheet.views = [
    { state: 'frozen', xSplit: 2, ySplit: 1, topLeftCell: 'C2', activePane: 'bottomRight' }
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Audit_Full_Report_Loan_${loanId}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
};
