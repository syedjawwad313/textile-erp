'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import {
  Upload,
  FileSpreadsheet,
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  RotateCcw,
  Loader2,
  ShieldCheck,
  History,
  FileText,
  Layers,
  Database,
  Info,
} from 'lucide-react';
import {
  dataManagementClient,
} from '@/lib/api/client';
import {
  EntitySchemaDefinition,
  ImportEntity,
  ImportSourceType,
  ImportMode,
  TransactionMode,
  ParseFileResponse,
  ImportPreviewResponse,
  ImportCommitResponse,
  DataImportLog,
} from '@/lib/api/types';

export default function DataImportPage() {
  const [activeTab, setActiveTab] = useState<'import' | 'audit'>('import');

  // Schema state
  const [schemas, setSchemas] = useState<EntitySchemaDefinition[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<ImportEntity>('BUYER');
  const [isLoadingSchemas, setIsLoadingSchemas] = useState(true);

  // Workflow step: 1 = Source Upload, 2 = Column Mapping, 3 = Preview & Validate, 4 = Results
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Source selection state
  const [sourceType, setSourceType] = useState<'FILE' | 'GOOGLE_SHEETS'>('FILE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [selectedWorksheet, setSelectedWorksheet] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parsed file response
  const [parseResult, setParseResult] = useState<ParseFileResponse | null>(null);

  // Column mapping state: targetField -> sourceColumn
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Preview state
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Import options
  const [importMode, setImportMode] = useState<ImportMode>('CREATE_ONLY');
  const [transactionMode, setTransactionMode] = useState<TransactionMode>('ALL_OR_NOTHING');

  // Commit state
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<ImportCommitResponse | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<DataImportLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Active schema
  const activeSchema = useMemo(() => {
    return schemas.find((s) => s.entity === selectedEntity) || null;
  }, [schemas, selectedEntity]);

  // Load schemas
  useEffect(() => {
    async function loadSchemas() {
      setIsLoadingSchemas(true);
      try {
        const data = await dataManagementClient.getSchemas();
        setSchemas(data);
      } catch (err) {
        console.error('Failed to load schemas:', err);
      } finally {
        setIsLoadingSchemas(false);
      }
    }
    loadSchemas();
  }, []);

  // Load audit logs when switching to audit tab
  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  const loadAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const logs = await dataManagementClient.getAuditLogs({ limit: 50 });
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Reset workflow on entity change
  const handleEntityChange = (entity: ImportEntity) => {
    setSelectedEntity(entity);
    setStep(1);
    setSelectedFile(null);
    setParseResult(null);
    setColumnMapping({});
    setPreviewResult(null);
    setCommitResult(null);
    setParseError(null);
    setPreviewError(null);
    setCommitError(null);
    setImportMode('CREATE_ONLY');
    setTransactionMode('ALL_OR_NOTHING');
  };

  // Step 1: Parse file or Google Sheets
  const handleParseSource = async () => {
    setParseError(null);
    setIsParsing(true);

    try {
      let res: ParseFileResponse;
      if (sourceType === 'FILE') {
        if (!selectedFile) {
          throw new Error('Please select a file to import (.csv, .xlsx, .xls)');
        }
        res = await dataManagementClient.parseFile(selectedFile, selectedWorksheet || undefined);
      } else {
        if (!googleSheetsUrl.trim()) {
          throw new Error('Please provide a valid Google Sheets URL');
        }
        res = await dataManagementClient.parseGoogleSheets(
          googleSheetsUrl.trim(),
          selectedWorksheet || undefined,
        );
      }

      setParseResult(res);
      setSelectedWorksheet(res.selectedSheet);

      // Initialize mapping with suggested mapping
      setColumnMapping(res.suggestedMapping || {});
      setStep(2);
    } catch (err: any) {
      console.error('Parse error:', err);
      setParseError(err?.message || 'Failed to parse data source.');
    } finally {
      setIsParsing(false);
    }
  };

  // Step 2: Validate & Preview
  const handlePreview = async () => {
    if (!parseResult || !activeSchema) return;
    setPreviewError(null);
    setIsPreviewing(true);

    try {
      const res = await dataManagementClient.previewImport({
        entity: selectedEntity,
        columnMapping,
        rows: parseResult.rawRows,
      });

      setPreviewResult(res);
      setStep(3);
    } catch (err: any) {
      console.error('Preview error:', err);
      setPreviewError(err?.message || 'Failed to generate import preview.');
    } finally {
      setIsPreviewing(false);
    }
  };

  // Step 3: Commit Import
  const handleCommit = async () => {
    if (!parseResult) return;
    setCommitError(null);
    setIsCommitting(true);

    const actualSourceType: ImportSourceType =
      sourceType === 'GOOGLE_SHEETS'
        ? 'GOOGLE_SHEETS'
        : selectedFile?.name.endsWith('.csv')
        ? 'CSV'
        : 'XLSX';

    try {
      const res = await dataManagementClient.commitImport({
        entity: selectedEntity,
        sourceType: actualSourceType,
        fileName: selectedFile?.name,
        sourceUrl: sourceType === 'GOOGLE_SHEETS' ? googleSheetsUrl : undefined,
        worksheet: selectedWorksheet,
        columnMapping,
        rows: parseResult.rawRows,
        importMode: activeSchema?.supportsUpsert ? importMode : 'CREATE_ONLY',
        transactionMode,
      });

      setCommitResult(res);
      setStep(4);
    } catch (err: any) {
      console.error('Commit error:', err);
      setCommitError(err?.message || 'Failed to commit import transaction.');
    } finally {
      setIsCommitting(false);
    }
  };

  // Template downloads
  const handleDownloadTemplate = async (format: 'csv' | 'xlsx') => {
    try {
      await dataManagementClient.downloadTemplate(selectedEntity, format);
    } catch (err) {
      alert('Failed to download template');
    }
  };

  // Error report download
  const handleDownloadErrors = async (importId?: string) => {
    const id = importId || commitResult?.importId;
    if (!id) return;
    try {
      await dataManagementClient.downloadErrorReport(id);
    } catch (err) {
      alert('Failed to download error report');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Enterprise Bulk Data Import / Export"
        description="High-throughput tabular data ingestion and audit-tracked exports across ERP and MES modules with domain validation and strict invariant enforcement."
        breadcrumbs={[
          { label: 'Workspace', href: '/' },
          { label: 'Data Management', href: '/data-import' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('import')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'import'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Upload className="w-3.5 h-3.5 inline mr-1.5" />
              Import Wizard
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'audit'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <History className="w-3.5 h-3.5 inline mr-1.5" />
              Audit Log
            </button>
          </div>
        }
      />

      {/* Main Tab: Import Wizard */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Entity Selection & Template Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Select Target ERP / MES Entity
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedEntity}
                    onChange={(e) => handleEntityChange(e.target.value as ImportEntity)}
                    disabled={step > 1}
                    className="bg-slate-950 border border-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  >
                    <optgroup label="Master Data (CREATE + UPSERT)">
                      <option value="BUYER">BUYER (Commercial Master)</option>
                      <option value="SUPPLIER">SUPPLIER (Commercial Master)</option>
                      <option value="STYLE">STYLE (Apparel Design Master)</option>
                      <option value="MATERIAL">MATERIAL (Fabric & Trims Master)</option>
                      <option value="WAREHOUSE">WAREHOUSE (Facility Master)</option>
                      <option value="BIN">BIN (Storage Location Master)</option>
                      <option value="DEFECT_CATALOG">DEFECT_CATALOG (Quality Standards)</option>
                    </optgroup>
                    <optgroup label="Transactional / Invariant-Governed (CREATE ONLY)">
                      <option value="BUYER_PO">BUYER_PO (Approved Costing Enforced)</option>
                      <option value="PRODUCTION_ORDER">PRODUCTION_ORDER (Confirmed PO Enforced)</option>
                      <option value="FABRIC_ROLL">FABRIC_ROLL (Warehouse Inventory Ingest)</option>
                      <option value="CUTTING_RECORD">CUTTING_RECORD (Fabric Depletion Enforced)</option>
                      <option value="BUNDLE">BUNDLE (Barcode Sequential Integrity)</option>
                      <option value="CARTON">CARTON (Finished Goods Packing Mode)</option>
                    </optgroup>
                  </select>

                  {activeSchema && (
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          activeSchema.category === 'MASTER_DATA'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                            : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800'
                        }`}
                      >
                        {activeSchema.category === 'MASTER_DATA'
                          ? 'CREATE + UPSERT Supported'
                          : 'CREATE ONLY (Invariants Enforced)'}
                      </span>
                      <span className="text-xs text-slate-400">
                        Primary Key: <code className="text-slate-200">{activeSchema.uniqueKeyField}</code>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Template Download Actions */}
              <div className="flex items-center gap-2 self-start lg:self-center">
                <span className="text-xs text-slate-400 mr-1 hidden sm:inline">Templates:</span>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('csv')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md border border-slate-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  CSV Template
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('xlsx')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-md border border-slate-700 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  Excel Template
                </button>
              </div>
            </div>
          </div>

          {/* Stepper Progress Header */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { num: 1, label: 'Source Upload' },
              { num: 2, label: 'Column Mapping' },
              { num: 3, label: 'Preview & Validate' },
              { num: 4, label: 'Commit & Report' },
            ].map((s) => (
              <div
                key={s.num}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${
                  step === s.num
                    ? 'bg-indigo-950/60 border-indigo-500/80 text-indigo-300'
                    : step > s.num
                    ? 'bg-slate-900 border-slate-700 text-emerald-400'
                    : 'bg-slate-950 border-slate-850 text-slate-500'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step === s.num
                      ? 'bg-indigo-600 text-white'
                      : step > s.num
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {step > s.num ? '✓' : s.num}
                </span>
                <span className="truncate">{s.label}</span>
              </div>
            ))}
          </div>

          {/* STEP 1: Source Upload */}
          {step === 1 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-100">Step 1: Choose Import Source</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Upload a CSV or Excel workbook from your computer, or connect a public/published Google Sheets URL.
                </p>
              </div>

              {/* Source Type Toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSourceType('FILE')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border text-sm font-semibold transition-all ${
                    sourceType === 'FILE'
                      ? 'bg-indigo-950/70 border-indigo-500 text-indigo-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
                  }`}
                >
                  <Upload className="w-4 h-4 text-indigo-400" />
                  Local File Upload (CSV, XLSX, XLS)
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('GOOGLE_SHEETS')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border text-sm font-semibold transition-all ${
                    sourceType === 'GOOGLE_SHEETS'
                      ? 'bg-indigo-950/70 border-indigo-500 text-indigo-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
                  }`}
                >
                  <LinkIcon className="w-4 h-4 text-emerald-400" />
                  Google Sheets URL (SSRF-Protected)
                </button>
              </div>

              {/* File Upload Area */}
              {sourceType === 'FILE' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/70 rounded-xl p-8 text-center transition-colors bg-slate-950/50">
                    <input
                      type="file"
                      id="bulk-file-input"
                      accept=".csv, .xlsx, .xls"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedFile(e.target.files[0]);
                          setParseError(null);
                        }
                      }}
                      className="hidden"
                    />
                    <label htmlFor="bulk-file-input" className="cursor-pointer block">
                      <FileSpreadsheet className="w-10 h-10 text-indigo-400 mx-auto mb-2 opacity-80" />
                      <p className="text-sm font-medium text-slate-200">
                        {selectedFile ? (
                          <span className="text-emerald-400 font-semibold">{selectedFile.name}</span>
                        ) : (
                          'Click to browse or drag and drop your file here'
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Supported formats: .csv, .xlsx, .xls (Up to 10MB, up to 5,000 rows)
                      </p>
                    </label>
                  </div>

                  {selectedFile && (
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                      <span className="text-slate-300">
                        File selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-rose-400 hover:text-rose-300 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Google Sheets URL Area */}
              {sourceType === 'GOOGLE_SHEETS' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Google Sheets Share / Published URL
                    </label>
                    <input
                      type="url"
                      value={googleSheetsUrl}
                      onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit#gid=0"
                      className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                    />
                  </div>

                  {/* Security & SSRF Callout */}
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-indigo-400 font-semibold">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Security & SSRF Policy</span>
                    </div>
                    <p className="text-slate-400">
                      Requests are strictly validated to prevent SSRF. Only secure HTTPS connections to{' '}
                      <code className="text-slate-200">docs.google.com</code> are permitted. Local, private, or loopback IP addresses are blocked by default.
                    </p>
                    <div className="border-t border-slate-850 pt-2 text-slate-400">
                      <strong className="text-amber-300">Secure Fallback for Restricted / Internal Sheets:</strong>
                      <p className="mt-0.5">
                        If your Google Sheet requires internal company authentication, export it securely via{' '}
                        <em>File → Download → Comma Separated Values (.csv)</em> and upload using the Local File tab.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Parse Error Display */}
              {parseError && (
                <div className="bg-rose-950/80 border border-rose-800 rounded-lg p-3 text-xs text-rose-300 flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Action */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleParseSource}
                  disabled={isParsing || (sourceType === 'FILE' && !selectedFile) || (sourceType === 'GOOGLE_SHEETS' && !googleSheetsUrl)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Parsing Data Source...
                    </>
                  ) : (
                    <>
                      Detect Columns & Map <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {step === 2 && parseResult && activeSchema && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-100">Step 2: Map Columns</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Detected <strong>{parseResult.detectedColumns.length}</strong> columns and{' '}
                    <strong>{parseResult.totalRows}</strong> rows in selected worksheet.
                  </p>
                </div>

                {/* Worksheet Switcher if multiple sheets */}
                {parseResult.sheets && parseResult.sheets.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Sheet:</span>
                    <select
                      value={selectedWorksheet}
                      onChange={(e) => {
                        setSelectedWorksheet(e.target.value);
                      }}
                      className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5"
                    >
                      {parseResult.sheets.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Column Mapping Table */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Entity Schema Field</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Source Tabular Column</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {activeSchema.columns.map((col) => {
                      const mappedCol = columnMapping[col.field] || '';
                      const isMapped = Boolean(mappedCol);
                      return (
                        <tr key={col.field} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                              {col.label}
                              {col.required && (
                                <span className="text-rose-400 font-bold" title="Required field">
                                  *
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">{col.field}</div>
                            {col.description && (
                              <div className="text-[10px] text-slate-400 mt-0.5">{col.description}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{col.type}</td>
                          <td className="py-3 px-4">
                            <select
                              value={mappedCol}
                              onChange={(e) => {
                                const val = e.target.value;
                                setColumnMapping((prev) => ({
                                  ...prev,
                                  [col.field]: val,
                                }));
                              }}
                              className={`bg-slate-900 border text-xs rounded-md px-3 py-1.5 w-full max-w-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                isMapped
                                  ? 'border-indigo-600/70 text-slate-100'
                                  : col.required
                                  ? 'border-rose-800/80 text-slate-400'
                                  : 'border-slate-750 text-slate-400'
                              }`}
                            >
                              <option value="">-- Do Not Map --</option>
                              {parseResult.detectedColumns.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isMapped ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" /> Mapped
                              </span>
                            ) : col.required ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950 text-rose-400 border border-rose-800">
                                Required
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-medium">Optional</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {previewError && (
                <div className="bg-rose-950/80 border border-rose-800 rounded-lg p-3 text-xs text-rose-300 flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                  <span>{previewError}</span>
                </div>
              )}

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Upload
                </button>

                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isPreviewing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                >
                  {isPreviewing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Validating Rows...
                    </>
                  ) : (
                    <>
                      Validate & Preview Rows <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview & Invariant Validation */}
          {step === 3 && previewResult && activeSchema && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div>
                <h3 className="text-base font-semibold text-slate-100">Step 3: Preview & Mutation Policy</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Examine pre-mutation rows, review domain validation results, and select atomic transaction mode before applying changes to database.
                </p>
              </div>

              {/* Metric Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Rows</span>
                  <p className="text-lg font-bold text-slate-100 mt-0.5">{previewResult.totalRows}</p>
                </div>
                <div className="bg-slate-950 border border-emerald-900/60 rounded-lg p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Valid Rows</span>
                  <p className="text-lg font-bold text-emerald-400 mt-0.5">{previewResult.validRows}</p>
                </div>
                <div className="bg-slate-950 border border-rose-900/60 rounded-lg p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">Invalid Rows</span>
                  <p className="text-lg font-bold text-rose-400 mt-0.5">{previewResult.invalidRows}</p>
                </div>
                <div className="bg-slate-950 border border-indigo-900/60 rounded-lg p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">Planned Creates</span>
                  <p className="text-lg font-bold text-indigo-400 mt-0.5">{previewResult.createCount}</p>
                </div>
                <div className="bg-slate-950 border border-purple-900/60 rounded-lg p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">Planned Upserts</span>
                  <p className="text-lg font-bold text-purple-400 mt-0.5">{previewResult.upsertCount}</p>
                </div>
              </div>

              {/* Policy & Transaction Boundaries Control */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950 border border-slate-800 rounded-lg p-4">
                {/* Import Mode Policy */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Import Mode Policy
                  </label>
                  {activeSchema.supportsUpsert ? (
                    <select
                      value={importMode}
                      onChange={(e) => setImportMode(e.target.value as ImportMode)}
                      className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-md px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="CREATE_ONLY">CREATE ONLY (Fail if record already exists)</option>
                      <option value="CREATE_AND_UPSERT">CREATE + UPSERT (Update existing by unique key)</option>
                    </select>
                  ) : (
                    <div className="text-xs text-amber-400 bg-amber-950/40 border border-amber-900/60 rounded-md p-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>
                        <strong>CREATE ONLY:</strong> Transactional & MES records are invariant-governed and do not permit bulk upsert or overwrite.
                      </span>
                    </div>
                  )}
                </div>

                {/* Transaction Boundary Mode */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Transaction Boundary
                  </label>
                  <select
                    value={transactionMode}
                    onChange={(e) => setTransactionMode(e.target.value as TransactionMode)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-md px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="ALL_OR_NOTHING">
                      ALL_OR_NOTHING (Strict atomic rollback if any row fails)
                    </option>
                    <option value="SKIP_INVALID">
                      SKIP_INVALID (Commit valid rows, export error CSV for invalid)
                    </option>
                  </select>
                </div>
              </div>

              {/* Row Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Showing first {Math.min(previewResult.rows.length, 50)} preview rows</span>
                  {previewResult.invalidRows > 0 && transactionMode === 'ALL_OR_NOTHING' && (
                    <span className="text-rose-400 font-semibold">
                      ⚠ Fix errors or switch to SKIP_INVALID mode to proceed
                    </span>
                  )}
                </div>

                <div className="border border-slate-800 rounded-lg overflow-x-auto bg-slate-950 max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-16">Row #</th>
                        <th className="py-2.5 px-3 w-24">Action</th>
                        <th className="py-2.5 px-3 w-28">Status</th>
                        <th className="py-2.5 px-3">Mapped Values</th>
                        <th className="py-2.5 px-3">Validation Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {previewResult.rows.slice(0, 50).map((r) => (
                        <tr
                          key={r.rowNumber}
                          className={r.isValid ? 'hover:bg-slate-900/30' : 'bg-rose-950/20 hover:bg-rose-950/30'}
                        >
                          <td className="py-2 px-3 font-mono text-slate-400">{r.rowNumber}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.action === 'CREATE'
                                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                  : r.action === 'UPSERT'
                                  ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                  : 'bg-rose-950 text-rose-300 border border-rose-800'
                              }`}
                            >
                              {r.action}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {r.isValid ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-medium">
                                <XCircle className="w-3.5 h-3.5" /> Error
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-300 max-w-xs truncate">
                            {Object.entries(r.mappedData)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' | ')}
                          </td>
                          <td className="py-2 px-3 text-[11px]">
                            {r.errors && r.errors.length > 0 ? (
                              <span className="text-rose-300 font-medium">{r.errors.join('; ')}</span>
                            ) : (
                              <span className="text-slate-500">Passed domain validation</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {commitError && (
                <div className="bg-rose-950/80 border border-rose-800 rounded-lg p-3 text-xs text-rose-300 flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                  <span>{commitError}</span>
                </div>
              )}

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Mapping
                </button>

                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={
                    isCommitting ||
                    (transactionMode === 'ALL_OR_NOTHING' && previewResult.invalidRows > 0) ||
                    previewResult.validRows === 0
                  }
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                >
                  {isCommitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Executing Import Transaction...
                    </>
                  ) : (
                    <>
                      Commit Import Transaction ({previewResult.validRows} Rows) <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Results & Error Remediation */}
          {step === 4 && commitResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div
                className={`border rounded-xl p-5 flex items-start gap-3.5 ${
                  commitResult.status === 'COMPLETED'
                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                    : commitResult.status === 'PARTIAL'
                    ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                    : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                }`}
              >
                {commitResult.status === 'COMPLETED' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                )}
                <div className="space-y-1">
                  <h3 className="text-base font-bold">
                    Import Transaction {commitResult.status}
                  </h3>
                  <p className="text-xs opacity-90">
                    Import ID: <code className="font-mono">{commitResult.importId}</code>. Invariant enforcement and audit logging completed.
                  </p>
                </div>
              </div>

              {/* Result Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Rows</span>
                  <p className="text-xl font-bold text-slate-100 mt-1">{commitResult.totalRows}</p>
                </div>
                <div className="bg-slate-950 border border-emerald-900/60 rounded-lg p-3 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Created</span>
                  <p className="text-xl font-bold text-emerald-400 mt-1">{commitResult.createdRows}</p>
                </div>
                <div className="bg-slate-950 border border-purple-900/60 rounded-lg p-3 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">Updated</span>
                  <p className="text-xl font-bold text-purple-400 mt-1">{commitResult.updatedRows}</p>
                </div>
                <div className="bg-slate-950 border border-rose-900/60 rounded-lg p-3 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">Failed / Skipped</span>
                  <p className="text-xl font-bold text-rose-400 mt-1">{commitResult.failedRows}</p>
                </div>
              </div>

              {/* Error Remediation & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  {commitResult.failedRows > 0 && (
                    <button
                      type="button"
                      onClick={() => handleDownloadErrors()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-900/70 hover:bg-rose-900 text-rose-100 text-xs font-semibold rounded-lg border border-rose-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download Error Report (CSV)
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEntityChange(selectedEntity)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    New Import
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('audit')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    View Audit Logs
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Tab 2: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Data Import Audit Trail</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Immutable ledger of bulk imports with row counts, user tracking, and downloadable error diagnostics.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAuditLogs}
              disabled={isLoadingAudit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="border border-slate-800 rounded-lg overflow-x-auto bg-slate-950">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Entity</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">File / URL</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Created</th>
                  <th className="py-2.5 px-3 text-right">Updated</th>
                  <th className="py-2.5 px-3 text-right">Failed</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {isLoadingAudit ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                      Loading import audit logs...
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500">
                      No import history recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/30">
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{log.entityType}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                          {log.sourceType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px] max-w-xs truncate" title={log.fileName || log.sourceUrl}>
                        {log.fileName || log.sourceUrl || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-[10px] font-mono text-slate-400">{log.importMode}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-300">{log.totalRows}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-400">{log.createdCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-purple-400">{log.updatedCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-rose-400">{log.failedCount}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 'COMPLETED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : log.status === 'PARTIAL'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {log.failedCount > 0 && (
                          <button
                            type="button"
                            onClick={() => handleDownloadErrors(log.id)}
                            title="Download Error Report CSV"
                            className="text-rose-400 hover:text-rose-300 p-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
