
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { FileUp, Search, Download, FileSpreadsheet, AlertCircle, Info, Filter, Plus, Trash2, X, Settings2 } from 'lucide-react';
import { FileData, LoanRow, AuditResult, AuditFilter } from './types';
import { exportToExcel } from './services/excelService';

const App: React.FC = () => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [primaryQuery, setPrimaryQuery] = useState('275032');
  const [additionalFilters, setAdditionalFilters] = useState<AuditFilter[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Helper to process multiple files (from input or drag-drop)
  const processFiles = useCallback((uploadedFiles: FileList | File[] | null) => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setLoading(true);
    const filesArray = Array.from(uploadedFiles);
    const filePromises = filesArray.map((file: File) => {
      return new Promise<FileData>((resolve) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            resolve({
              name: file.name,
              data: results.data.map((row: any) => {
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
      // Version 2.0 behavior: append new files to current inventory
      setFiles(prev => [...prev, ...results]);
      setLoading(false);
    });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    e.target.value = ''; // Reset to allow same file re-upload
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
    
    // Crucial: Access all files in the drop event
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const masterData = useMemo(() => files.flatMap(f => f.data), [files]);

  const availableColumns = useMemo(() => {
    const cols = new Set<string>();
    masterData.forEach(row => {
      Object.keys(row).forEach(k => { if (k !== 'Found_In_File') cols.add(k); });
    });
    return Array.from(cols).sort();
  }, [masterData]);

  // Determine the ID column (Loan #) - Reverting to version 2.0 auto-detection
  const idKey = useMemo(() => {
    if (availableColumns.length === 0) return null;
    return availableColumns.find(k => 
      k.toLowerCase().includes('loan #') || k.toLowerCase().includes('loan#') || k.toLowerCase().includes('loan number')
    ) || availableColumns[0];
  }, [availableColumns]);

  const addFilter = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setAdditionalFilters([...additionalFilters, { id, column: availableColumns[0] || '', value: '' }]);
  };

  const removeFilter = (id: string) => {
    setAdditionalFilters(additionalFilters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<AuditFilter>) => {
    setAdditionalFilters(additionalFilters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const auditResults = useMemo(() => {
    if (masterData.length === 0 || !idKey) return [];

    const hasPrimaryQuery = primaryQuery.trim() !== '';
    const activeAdditional = additionalFilters.filter(f => f.column && f.value.trim() !== '');

    // Filter logic: Multi-value (comma separated) support
    const filtered = masterData.filter(row => {
      // 1. Primary Check
      if (hasPrimaryQuery) {
        const primaryValues = primaryQuery.split(',').map(v => v.trim().toLowerCase());
        const rowVal = String(row[idKey] || '').toLowerCase();
        if (!primaryValues.some(v => rowVal === v)) return false;
      }

      // 2. Additional Checks
      for (const filter of activeAdditional) {
        const filterValues = filter.value.split(',').map(v => v.trim().toLowerCase());
        const rowVal = String(row[filter.column] || '').toLowerCase();
        if (!filterValues.some(v => rowVal === v)) return false;
      }

      return true;
    });

    // Version 2.0 grouping logic: Find differences within the filtered results for the same ID
    const results: AuditResult[] = [];
    const grouped: { [key: string]: any[] } = {};

    filtered.forEach(row => {
      const gid = String(row[idKey]);
      if (!grouped[gid]) grouped[gid] = [];
      grouped[gid].push(row);
    });

    Object.values(grouped).forEach(group => {
      group.forEach((row, index) => {
        const changes = new Set<string>();
        if (index > 0) {
          const prevRow = group[index - 1];
          Object.keys(row).forEach(key => {
            if (key === 'Found_In_File') return;
            if (String(row[key]) !== String(prevRow[key])) {
              changes.add(key);
            }
          });
        }
        results.push({ row, changes });
      });
    });

    return results;
  }, [masterData, primaryQuery, idKey, additionalFilters]);

  // Version 2.0 summary columns logic
  const summaryColumns = useMemo(() => {
    if (auditResults.length === 0 || !idKey) return [];
    
    const changedCols = new Set<string>();
    auditResults.forEach(res => {
      res.changes.forEach(c => changedCols.add(c));
    });

    return ['Found_In_File', idKey, ...Array.from(changedCols).sort()];
  }, [auditResults, idKey]);

  const handleDownload = useCallback(() => {
    if (auditResults.length > 0 && idKey) {
      exportToExcel(auditResults, primaryQuery || 'All');
    }
  }, [auditResults, primaryQuery, idKey]);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#fafafa]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-indigo-100 shadow-xl">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">Loan Auditor</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Version 2.0 Core • Enhanced Filtering</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {files.length > 0 && (
              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory</span>
                <span className="text-sm font-bold text-slate-700">{files.length} Source Files</span>
              </div>
            )}
            {auditResults.length > 0 && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-emerald-100 shadow-xl hover:scale-[1.02] active:scale-95 text-sm"
              >
                <Download size={18} />
                Export Audit Report
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* File Upload Section */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <FileUp size={16} className="text-indigo-600" /> 1. Upload Source
                </h2>
                {files.length > 0 && (
                  <button onClick={() => setFiles([])} className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest">Clear</button>
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
                <input type="file" multiple accept=".csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <div className="pointer-events-none">
                  <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${
                    isDragging ? 'bg-indigo-600 text-white shadow-indigo-200 shadow-2xl' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                  }`}>
                    <FileUp size={24} />
                  </div>
                  <p className="text-sm font-black text-slate-700">Drop Audit CSVs Here</p>
                  <p className="text-xs text-slate-400 mt-1">Supports multiple files</p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {files.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400">
                        <FileSpreadsheet size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-bold text-slate-700">{f.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black">{f.data.length} records</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filtering Section */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                <Search size={16} className="text-indigo-600" /> 2. Audit Parameters
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] px-1">
                    Primary: {idKey || 'Loan Number'}
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={primaryQuery}
                      onChange={(e) => setPrimaryQuery(e.target.value)}
                      placeholder="Enter Loan ID(s)..."
                      className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none transition-all font-bold text-slate-800 shadow-sm"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={18} />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] px-1">
                    Auto-Detected Column
                  </label>
                  <div className="flex items-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-500 text-sm font-bold shadow-sm">
                    <Settings2 size={16} className="text-slate-300" />
                    {idKey || 'Waiting for columns...'}
                  </div>
                </div>
              </div>

              {/* Additional Refinement */}
              {additionalFilters.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Additional Refinement</h3>
                  <div className="space-y-3">
                    {additionalFilters.map((filter) => (
                      <div key={filter.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                        <div className="md:col-span-5">
                          <select
                            value={filter.column}
                            onChange={(e) => updateFilter(filter.id, { column: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-600"
                          >
                            {availableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                          </select>
                        </div>
                        <div className="md:col-span-6">
                          <input
                            type="text"
                            value={filter.value}
                            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                            placeholder="Value(s)..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium"
                          />
                        </div>
                        <div className="md:col-span-1 flex justify-end">
                          <button onClick={() => removeFilter(filter.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button 
                  onClick={addFilter} 
                  disabled={availableColumns.length === 0} 
                  className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors"
                >
                  <Plus size={14} /> Add Refinement Filter
                </button>
                <div className="flex items-center gap-2">
                   {auditResults.length > 0 ? (
                     <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                       <span className="text-[10px] font-black uppercase tracking-widest">
                         {auditResults.length} Matches Found
                       </span>
                     </div>
                   ) : (
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Optional: Refine search above</span>
                   )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Results Table */}
        {auditResults.length > 0 && (
          <section className="space-y-4 animate-in fade-in duration-500">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                Audit Timeline
                <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full uppercase tracking-tighter">Live Analysis</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden md:block">Highlights indicate values differing from previous file version</p>
            </div>
            
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {summaryColumns.map((header) => (
                        <th key={header} className="px-6 py-4 font-black text-slate-400 uppercase tracking-[0.15em] text-[10px] whitespace-nowrap sticky top-0 bg-slate-50 z-20">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditResults.map((item, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors">
                        {summaryColumns.map((key) => {
                          const isChanged = item.changes.has(key);
                          const isIdentifier = key === idKey || key === 'Found_In_File';
                          return (
                            <td
                              key={key}
                              className={`px-6 py-5 whitespace-nowrap transition-all border-r border-slate-50 last:border-0 ${
                                isChanged 
                                  ? 'bg-yellow-100/60 font-black text-yellow-900 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.1)]' 
                                  : isIdentifier 
                                    ? 'bg-slate-50/50 font-bold text-slate-400 italic text-xs'
                                    : 'text-slate-600 font-medium'
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
          </section>
        )}

        {files.length > 0 && auditResults.length === 0 && (
          <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 p-20 text-center space-y-4 shadow-sm">
            <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
              <AlertCircle size={32} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">No Matching Records</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">Upload source files and enter search criteria to identify and compare record versions.</p>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 p-10 text-white mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4 opacity-70">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-indigo-500/20">LA</div>
            <div>
              <p className="text-xs font-black tracking-widest uppercase">Loan Auditor Pro v2.0</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5 uppercase tracking-tighter">Enterprise Verification Suite</p>
            </div>
          </div>
          <div className="flex gap-10 text-[10px] font-black uppercase tracking-[0.2em] opacity-30">
            <span>Client-Side Processing</span>
            <span>Intelligent Diffing</span>
            <span>Excel Formatting</span>
          </div>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; border: 2px solid transparent; background-clip: content-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; border: 2px solid transparent; background-clip: content-box; }
      `}</style>
    </div>
  );
};

export default App;
