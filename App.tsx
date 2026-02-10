
import React, { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { FileUp, Search, Download, FileSpreadsheet, AlertCircle, Info, Filter, Trash2 } from 'lucide-react';
import { FileData, LoanRow, AuditResult } from './types';
import { exportToExcel } from './services/excelService';

const App: React.FC = () => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [searchQuery, setSearchQuery] = useState('275032');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Core processing logic shared by both input change and drag-drop
  const processFiles = useCallback((fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;

    setLoading(true);
    const filesArray = Array.from(fileList);
    
    const filePromises = filesArray.map((file: File) => {
      return new Promise<FileData>((resolve) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            resolve({
              name: file.name,
              data: results.data.map((row: any) => {
                // Ensure Found_In_File is the first property for aesthetic ordering
                const newRow: any = { Found_In_File: file.name };
                Object.keys(row).forEach(k => {
                  newRow[k] = row[k];
                });
                return newRow;
              }),
            });
          },
        });
      });
    });

    Promise.all(filePromises).then((results) => {
      // Append new files to the current list (additive)
      setFiles(prev => [...prev, ...results]);
      setLoading(false);
    }).catch(err => {
      console.error("Error processing files:", err);
      setLoading(false);
    });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    e.target.value = ''; // Reset to allow re-uploading the same file if needed
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const masterData = useMemo(() => {
    return files.flatMap(f => f.data);
  }, [files]);

  // Determine the ID column (Loan #)
  const idKey = useMemo(() => {
    if (masterData.length === 0) return null;
    const firstRow = masterData[0];
    return Object.keys(firstRow).find(k => 
      k.toLowerCase().includes('loan #') || k.toLowerCase().includes('loan#') || k.toLowerCase().includes('loan number')
    ) || null;
  }, [masterData]);

  const auditResults = useMemo(() => {
    if (!searchQuery || !idKey || masterData.length === 0) return [];

    // Filter instances of this loan across all files
    const filtered = masterData.filter(row => 
      String(row[idKey]).trim().toLowerCase() === searchQuery.trim().toLowerCase()
    );

    // Calculate changes by comparing each version to the one before it chronologically (by upload/file order)
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
  }, [masterData, searchQuery, idKey]);

  // Summary columns show key IDs and any column that experienced a change
  const summaryColumns = useMemo(() => {
    if (auditResults.length === 0 || !idKey) return [];
    
    const changedCols = new Set<string>();
    auditResults.forEach(res => {
      res.changes.forEach(c => changedCols.add(c));
    });

    // Always include File Name and the ID column, then all columns that changed
    return ['Found_In_File', idKey, ...Array.from(changedCols).sort()];
  }, [auditResults, idKey]);

  const handleDownload = useCallback(() => {
    if (auditResults.length > 0 && idKey) {
      exportToExcel(auditResults, searchQuery);
    }
  }, [auditResults, searchQuery, idKey]);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#fcfcfd]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-indigo-100 shadow-xl">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">Loan Auditor</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Version 2.0 • Enterprise Edition</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {files.length > 0 && (
              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory</span>
                <span className="text-sm font-bold text-slate-700">{files.length} Files</span>
              </div>
            )}
            {auditResults.length > 0 && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-xl hover:scale-[1.02] active:scale-95 text-sm"
              >
                <Download size={18} />
                Export Audit Report
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10 space-y-10">
        {/* Step 1 & 2: Upload and Search */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <FileUp size={16} className="text-indigo-600" /> 1. Upload Source
              </h2>
              {files.length > 0 && (
                <button onClick={() => setFiles([])} className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition-colors uppercase tracking-widest">Clear All</button>
              )}
            </div>
            
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer group text-center ${
                isDragging ? 'border-indigo-600 bg-indigo-50 scale-[1.02]' : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20'
              }`}
            >
              <input
                type="file"
                multiple
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              <div className="pointer-events-none">
                <div className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
                  isDragging ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                }`}>
                  <FileUp size={24} />
                </div>
                <p className="text-sm font-black text-slate-700">Drop Audit CSVs Here</p>
                <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-tighter">Supports multiple files</p>
              </div>
            </div>

            {files.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {files.map((f, idx) => (
                  <div key={`${f.name}-${idx}`} className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 group">
                    <div className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 group-hover:text-indigo-600 transition-colors">
                      <FileSpreadsheet size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-black text-slate-700">{f.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-tight">{f.data.length} records</p>
                    </div>
                    <button 
                      onClick={() => removeFile(idx)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-8 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-8 border-b border-slate-100 pb-4">
              <Search size={16} className="text-indigo-600" /> 2. Audit Parameters
            </h2>
            
            <div className="space-y-8 flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 px-1">Search Identifier (Loan Number)</label>
                <div className="relative group">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter Loan ID (e.g. 275032)"
                    className="w-full pl-14 pr-4 py-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none transition-all text-xl font-bold text-slate-800 placeholder:text-slate-300"
                  />
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={24} />
                </div>
              </div>

              {!files.length ? (
                <div className="flex items-center gap-5 p-6 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                    <Info size={24} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight">System Ready</p>
                    <p className="text-xs font-medium opacity-80 mt-1">Please upload source CSV files to begin the cross-file comparison process.</p>
                  </div>
                </div>
              ) : auditResults.length === 0 && searchQuery ? (
                <div className="flex items-center gap-5 p-6 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center shrink-0">
                    <AlertCircle size={24} className="text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight">Record Not Found</p>
                    <p className="text-xs font-medium opacity-80 mt-1">Identifier <span className="font-black underline">{searchQuery}</span> was not located in the current batch of {files.length} files.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-5 p-6 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-800 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                    <Filter size={24} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight">Audit Matching Success</p>
                    <p className="text-xs font-medium opacity-80 mt-1">Synthesized {auditResults.length} versions. {summaryColumns.length - 2} data fields identified with variations across the timeline.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Audit Results Table */}
        {auditResults.length > 0 && (
          <section className="space-y-6 animate-in fade-in duration-700">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                Change Timeline
                <span className="text-[10px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full uppercase tracking-tighter shadow-lg shadow-indigo-100">Live Diff Engine</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden md:block">Yellow highlights indicate deviation from the chronologically preceding record</p>
            </div>
            
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {summaryColumns.map((header) => (
                        <th key={header} className="px-8 py-5 font-black text-slate-400 uppercase tracking-[0.15em] text-[10px] whitespace-nowrap sticky top-0 bg-slate-50 z-20 border-r border-slate-100 last:border-0">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditResults.map((item, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-slate-50 transition-colors group">
                        {summaryColumns.map((key) => {
                          const isChanged = item.changes.has(key);
                          const isIdentifier = key === idKey || key === 'Found_In_File';
                          return (
                            <td
                              key={key}
                              className={`px-8 py-6 whitespace-nowrap transition-all border-r border-slate-50 last:border-0 ${
                                isChanged 
                                  ? 'bg-yellow-50/70 font-black text-yellow-900 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.15)]' 
                                  : isIdentifier 
                                    ? 'bg-slate-50/50 font-bold text-slate-400 italic text-xs'
                                    : 'text-slate-600 font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isChanged && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>}
                                {item.row[key]}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 p-10 text-white mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4 opacity-70">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <p className="text-xs font-black tracking-widest uppercase">Loan Auditor Enterprise v2.0</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">Secure Local Browser Processing</p>
            </div>
          </div>
          <div className="flex flex-col md:items-end gap-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
            <div className="flex gap-6">
              <span>Client-Side Encryption</span>
              <span>Zero-Data Retention</span>
            </div>
            <p className="text-slate-600">Built for accuracy and speed</p>
          </div>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 20px;
          border: 3px solid transparent;
          background-clip: content-box;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
          border: 3px solid transparent;
          background-clip: content-box;
        }
      `}</style>
    </div>
  );
};

export default App;
