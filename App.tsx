
import React, { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { FileUp, Search, Download, FileSpreadsheet, AlertCircle, Info } from 'lucide-react';
import { FileData, LoanRow, AuditResult } from './types';
import { exportToExcel } from './services/excelService';

const App: React.FC = () => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [searchQuery, setSearchQuery] = useState('275032');
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    setLoading(true);
    // Explicitly type 'file' as 'File' to ensure the 'name' property is recognized by the compiler.
    const filePromises = Array.from(uploadedFiles).map((file: File) => {
      return new Promise<FileData>((resolve) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            resolve({
              name: file.name,
              data: results.data.map((row: any) => ({
                ...row,
                Found_In_File: file.name,
              })),
            });
          },
        });
      });
    });

    Promise.all(filePromises).then((results) => {
      setFiles(results);
      setLoading(false);
    });
  };

  const masterData = useMemo(() => {
    return files.flatMap(f => f.data);
  }, [files]);

  const auditResults = useMemo(() => {
    if (!searchQuery || masterData.length === 0) return [];

    // Find the primary key column (Loan #)
    const firstRow = masterData[0];
    const idKey = Object.keys(firstRow).find(k => 
      k.toLowerCase().includes('loan #') || k.toLowerCase().includes('loan#')
    );

    if (!idKey) return [];

    // Filter instances of this loan
    const filtered = masterData.filter(row => 
      String(row[idKey]).trim() === searchQuery.trim()
    );

    // Calculate changes
    const results: AuditResult[] = [];
    filtered.forEach((row, index) => {
      const changes = new Set<string>();
      if (index > 0) {
        const prevRow = filtered[index - 1];
        Object.keys(row).forEach(key => {
          if (key === 'Found_In_File') return;
          if (String(row[key]) !== String(prevRow[key])) {
            changes.add(key);
          }
        });
      }
      results.push({ row, changes });
    });

    return results;
  }, [masterData, searchQuery]);

  const handleDownload = useCallback(() => {
    if (auditResults.length > 0) {
      exportToExcel(auditResults, searchQuery);
    }
  }, [auditResults, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <FileSpreadsheet size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Loan Auditor</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:inline">
              {files.length} files loaded
            </span>
            {auditResults.length > 0 && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm"
              >
                <Download size={18} />
                Download Report
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileUp size={16} /> 1. Upload CSV Files
            </h2>
            <div className="relative border-2 border-dashed border-slate-200 rounded-lg p-6 hover:border-indigo-400 transition-colors cursor-pointer group">
              <input
                type="file"
                multiple
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="text-center">
                <FileUp className="mx-auto text-slate-400 group-hover:text-indigo-500 transition-colors mb-2" size={32} />
                <p className="text-sm text-slate-600">Click to upload multiple audit files</p>
                <p className="text-xs text-slate-400 mt-1">Accepts .csv format</p>
              </div>
            </div>
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map(f => (
                  <div key={f.name} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="truncate max-w-[150px] font-medium text-slate-700">{f.name}</span>
                    <span className="text-slate-400">{f.data.length} rows</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Search size={16} /> 2. Audit Parameters
            </h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <label className="text-xs font-bold text-slate-500 block mb-1">LOAN NUMBER TO AUDIT</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter Loan ID (e.g. 275032)"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                </div>
              </div>
            </div>

            {!files.length && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-lg text-amber-800">
                <Info size={20} className="shrink-0" />
                <p className="text-sm">Please upload at least one CSV file to begin your audit comparison.</p>
              </div>
            )}

            {files.length > 0 && auditResults.length === 0 && searchQuery && (
              <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-lg text-rose-800">
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-sm">No records found for Loan #<strong>{searchQuery}</strong> in the uploaded data.</p>
              </div>
            )}
          </div>
        </div>

        {/* Audit Data Table */}
        {auditResults.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                Audit Timeline for Loan {searchQuery}
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full">{auditResults.length} versions found</span>
              </h3>
              <p className="text-xs text-slate-500 italic">Highlighted cells indicate changes from the previous version</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {Object.keys(auditResults[0].row).map((header) => (
                      <th key={header} className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap sticky top-0 bg-slate-50">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditResults.map((item, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-slate-50 transition-colors">
                      {Object.keys(item.row).map((key) => {
                        const isChanged = item.changes.has(key);
                        return (
                          <td
                            key={key}
                            className={`px-4 py-3 whitespace-nowrap transition-colors ${
                              isChanged 
                                ? 'bg-yellow-100 font-bold text-yellow-900 border-x border-yellow-200' 
                                : 'text-slate-600'
                            }`}
                          >
                            {item.row[key]}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 p-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <p>© 2024 Senior Loan Auditor Dashboard. Professional Version.</p>
          <div className="flex gap-6">
            <span className="flex items-center gap-1"><Info size={14} /> Compare versions row-by-row</span>
            <span className="flex items-center gap-1"><Download size={14} /> Styled Excel exports</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
