import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../utils/api';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Building,
  Calendar,
  Send,
  Clock,
  XCircle,
  FileText,
  Download,
  Eye,
  Plus,
  UploadCloud,
  Check,
  X,
  Loader2,
  FileCheck,
} from 'lucide-react';
import { UserAvatar } from '../components/UserAvatar';

export type NdaStatusType = 'not_sent' | 'pending' | 'signed' | 'not_signed';

export type DocumentType =
  | 'NDA'
  | 'STUDENT_CERTIFICATE'
  | 'TRANSCRIPT'
  | 'INTERNSHIP_CONTRACT'
  | 'SGK_ENTRY'
  | 'ID_COPY'
  | 'OTHER';

export interface CubeDocumentItem {
  id: string;
  type: DocumentType;
  title: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  file_name: string;
  file_size: number;
  mime_type?: string;
  created_at: string;
}

interface CubeNdaRecord {
  id: string;
  user_id: string;
  cube_number: string;
  cohort: string;
  university: string;
  department: string;
  current_level: string;
  internship_status?: string | null;
  is_founding_cube?: boolean;
  avatar_url?: string | null;
  nda_signed: boolean;
  nda_signed_at?: string | null;
  nda_status?: NdaStatusType;
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string | null;
  };
  assigned_mentor?: {
    id: string;
    name: string;
  } | null;
  documents?: CubeDocumentItem[];
}

const DOC_TYPE_META: Record<DocumentType, { label: string; short: string; color: string }> = {
  NDA: {
    label: 'Non-Disclosure Agreement (NDA)',
    short: 'NDA',
    color: 'bg-magenta/10 text-magenta border-magenta/20',
  },
  STUDENT_CERTIFICATE: {
    label: 'Student Certificate',
    short: 'Student',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  SGK_ENTRY: {
    label: 'Social Security (SGK)',
    short: 'SGK',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  INTERNSHIP_CONTRACT: {
    label: 'Internship Contract',
    short: 'Contract',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  TRANSCRIPT: {
    label: 'Academic Transcript',
    short: 'Transcript',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  ID_COPY: {
    label: 'National ID / Passport',
    short: 'ID',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  OTHER: {
    label: 'Other Document',
    short: 'Other',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

export const AdminNda: React.FC = () => {
  const [cubes, setCubes] = useState<CubeNdaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [docFilter, setDocFilter] = useState<string>('all');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  // Document Upload Modal state
  const [uploadTargetCube, setUploadTargetCube] = useState<CubeNdaRecord | null>(null);
  const [uploadDocType, setUploadDocType] = useState<DocumentType>('NDA');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  const fetchCubes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/cubes?includeAlumni=true');
      setCubes(res || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Cubes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCubes();
  }, []);

  const getEffectiveStatus = (cube: CubeNdaRecord): NdaStatusType => {
    if (cube.nda_status) return cube.nda_status;
    return cube.nda_signed ? 'signed' : 'not_sent';
  };

  const handleSetStatus = async (cube: CubeNdaRecord, newStatus: NdaStatusType) => {
    setActionLoadingId(cube.id);
    try {
      const res = await api.patch(`/cubes/${cube.id}/nda`, { nda_status: newStatus });
      const updatedNdaStatus = res.cube?.nda_status ?? newStatus;
      const isSigned = updatedNdaStatus === 'signed';

      setCubes((prev) =>
        prev.map((c) =>
          c.id === cube.id
            ? {
                ...c,
                nda_status: updatedNdaStatus,
                nda_signed: isSigned,
                nda_signed_at: isSigned ? res.cube?.nda_signed_at || new Date().toISOString() : null,
              }
            : c
        )
      );

      const statusLabels: Record<NdaStatusType, string> = {
        not_sent: 'Not Sent',
        pending: 'Pending Signature',
        signed: 'Signed',
        not_signed: 'Not Signed',
      };

      setToastMessage(`Cube #${cube.cube_number} (${cube.user?.name}) marked as "${statusLabels[newStatus]}".`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update NDA status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleViewDoc = async (docId: string, isDownload = false) => {
    try {
      const { blob, filename } = await api.downloadBlob(`/documents/${docId}/file${isDownload ? '?download=true' : ''}`);
      const url = window.URL.createObjectURL(blob);
      if (isDownload) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        window.open(url, '_blank');
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      alert(err.message || 'Failed to open or download document.');
    }
  };

  const handleOpenUpload = (cube: CubeNdaRecord, defaultType: DocumentType = 'NDA') => {
    setUploadTargetCube(cube);
    setUploadDocType(defaultType);
    setUploadTitle(DOC_TYPE_META[defaultType].label);
    setUploadNotes('');
    setUploadFile(null);
    setUploadError(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTargetCube || !uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('type', uploadDocType);
      formData.append('title', uploadTitle || DOC_TYPE_META[uploadDocType].label);
      if (uploadNotes) formData.append('notes', uploadNotes);
      formData.append('status', 'APPROVED');

      const res = await api.upload(`/cubes/${uploadTargetCube.id}/documents`, formData);
      const newDoc: CubeDocumentItem = res.document;

      // Update local state
      setCubes((prev) =>
        prev.map((c) => {
          if (c.id !== uploadTargetCube.id) return c;
          const updatedDocs = [newDoc, ...(c.documents || []).filter((d) => d.id !== newDoc.id)];
          const isNda = uploadDocType === 'NDA';
          return {
            ...c,
            nda_signed: isNda ? true : c.nda_signed,
            nda_status: isNda ? 'signed' : c.nda_status,
            nda_signed_at: isNda ? new Date().toISOString() : c.nda_signed_at,
            documents: updatedDocs,
          };
        })
      );

      setToastMessage(`Document "${newDoc.title}" uploaded successfully for Cube #${uploadTargetCube.cube_number}.`);
      setTimeout(() => setToastMessage(null), 4000);
      setUploadTargetCube(null);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setUploadLoading(false);
    }
  };

  // Distinct values for filter dropdowns
  const cohorts = useMemo(() => {
    const set = new Set<string>();
    cubes.forEach((c) => {
      if (c.cohort) set.add(c.cohort);
    });
    return Array.from(set).sort();
  }, [cubes]);

  const levels = useMemo(() => {
    const set = new Set<string>();
    cubes.forEach((c) => {
      if (c.current_level) set.add(c.current_level);
    });
    return Array.from(set).sort();
  }, [cubes]);

  // Filtered Cubes
  const filteredCubes = useMemo(() => {
    return cubes.filter((c) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        c.cube_number.toLowerCase().includes(query) ||
        (c.user?.name || '').toLowerCase().includes(query) ||
        (c.user?.email || '').toLowerCase().includes(query) ||
        (c.university || '').toLowerCase().includes(query) ||
        (c.department || '').toLowerCase().includes(query);

      const effectiveStatus = getEffectiveStatus(c);
      const matchesStatus = statusFilter === 'all' || effectiveStatus === statusFilter;
      const matchesCohort = cohortFilter === 'all' || c.cohort === cohortFilter;
      const matchesLevel = levelFilter === 'all' || c.current_level === levelFilter;

      // Document presence filter
      let matchesDoc = true;
      const docs = c.documents || [];
      const hasNdaDoc = docs.some((d) => d.type === 'NDA');
      const hasStudentCert = docs.some((d) => d.type === 'STUDENT_CERTIFICATE');
      const hasSgk = docs.some((d) => d.type === 'SGK_ENTRY');
      const hasPending = docs.some((d) => d.status === 'PENDING_REVIEW');

      if (docFilter === 'has_nda_doc') matchesDoc = hasNdaDoc;
      else if (docFilter === 'missing_nda_doc') matchesDoc = !hasNdaDoc;
      else if (docFilter === 'has_student_cert') matchesDoc = hasStudentCert;
      else if (docFilter === 'has_sgk') matchesDoc = hasSgk;
      else if (docFilter === 'has_pending') matchesDoc = hasPending;
      else if (docFilter === 'no_docs') matchesDoc = docs.length === 0;

      return matchesSearch && matchesStatus && matchesCohort && matchesLevel && matchesDoc;
    });
  }, [cubes, searchQuery, statusFilter, cohortFilter, levelFilter, docFilter]);

  // KPI Calculations
  const totalCubes = cubes.length;
  const notSentCount = cubes.filter((c) => getEffectiveStatus(c) === 'not_sent').length;
  const pendingCount = cubes.filter((c) => getEffectiveStatus(c) === 'pending').length;
  const signedCount = cubes.filter((c) => getEffectiveStatus(c) === 'signed').length;
  const notSignedCount = cubes.filter((c) => getEffectiveStatus(c) === 'not_signed').length;
  const signedPercentage = totalCubes > 0 ? Math.round((signedCount / totalCubes) * 100) : 0;

  // Documents KPI calculations
  const totalDocumentsCount = cubes.reduce((acc, c) => acc + (c.documents?.length || 0), 0);
  const pendingReviewDocsCount = cubes.reduce(
    (acc, c) => acc + (c.documents?.filter((d) => d.status === 'PENDING_REVIEW').length || 0),
    0
  );

  return (
    <div className="flex flex-col gap-6 max-w-[1500px] mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-gray-700 animate-fadeIn text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="workspace-header">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-black tracking-tight text-gray-900">
              Document &amp; NDA Tracking
            </h1>
            <span className="bg-magenta/10 text-magenta text-xs font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Fellowship Administration
            </span>
          </div>
          <p className="text-gray-500 mt-1 text-sm">
            Track, upload, and review confidentiality agreements (NDA) and official Cube documents (student certificate, SGK, etc.).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchCubes}
            disabled={loading}
            className="workspace-secondary-action"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards (NDA is the Spotlight Hero) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* NDA Signed Hero KPI */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'signed' ? 'all' : 'signed')}
          className={`p-5 rounded-2xl shadow-subtle border transition-all cursor-pointer relative overflow-hidden ${
            statusFilter === 'signed'
              ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/20'
              : 'bg-white border-gray-100 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-wider text-emerald-600 uppercase flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>NDA Signed</span>
            </span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              {signedPercentage}%
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-700 mt-2">
            {signedCount} <span className="text-sm font-semibold text-gray-400">/ {totalCubes}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${signedPercentage}%` }}
            ></div>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Cubes with completed agreement</p>
        </div>

        {/* NDA Pending */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          className={`p-5 rounded-2xl shadow-subtle border transition-all cursor-pointer ${
            statusFilter === 'pending'
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
              : 'bg-white border-gray-100 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-wider text-amber-600 uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Signature</span>
            </span>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Pending
            </span>
          </div>
          <div className="text-3xl font-black text-amber-700 mt-2">{pendingCount}</div>
          <p className="text-xs text-gray-500 mt-0.5">Sent, awaiting Cube signature</p>
        </div>

        {/* Total Documents Uploaded */}
        <div
          onClick={() => setDocFilter(docFilter === 'has_nda_doc' ? 'all' : 'has_nda_doc')}
          className={`p-5 rounded-2xl shadow-subtle border transition-all cursor-pointer ${
            docFilter === 'has_nda_doc'
              ? 'bg-magenta/5 border-magenta/30 ring-2 ring-magenta/20'
              : 'bg-white border-gray-100 hover:border-magenta/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-wider text-magenta uppercase flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5" />
              <span>Uploaded Documents</span>
            </span>
            <span className="text-[10px] font-bold text-magenta bg-magenta/10 px-2 py-0.5 rounded-full">
              Persistent Volume
            </span>
          </div>
          <div className="text-3xl font-black text-gray-900 mt-2">{totalDocumentsCount}</div>
          <p className="text-xs text-gray-500 mt-0.5">Total archived official files</p>
        </div>

        {/* Pending Review Documents */}
        <div
          onClick={() => setDocFilter(docFilter === 'has_pending' ? 'all' : 'has_pending')}
          className={`p-5 rounded-2xl shadow-subtle border transition-all cursor-pointer ${
            docFilter === 'has_pending'
              ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-400/20'
              : 'bg-white border-gray-100 hover:border-purple-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-wider text-purple-600 uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Review</span>
            </span>
            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
              Review
            </span>
          </div>
          <div className="text-3xl font-black text-purple-700 mt-2">{pendingReviewDocsCount}</div>
          <p className="text-xs text-gray-500 mt-0.5">Files awaiting mentor/admin review</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-subtle flex flex-col md:flex-row gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Cube name, number, email, university, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 hover:bg-gray-100/50 border border-gray-100 rounded-xl outline-none font-semibold text-xs transition-all focus:bg-white focus:border-magenta/30"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          {/* NDA Status Filter */}
          <div className="relative min-w-[150px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold text-xs appearance-none cursor-pointer pr-8"
            >
              <option value="all">All NDA Statuses</option>
              <option value="signed">✓ Signed ({signedCount})</option>
              <option value="pending">⏳ Pending Signature ({pendingCount})</option>
              <option value="not_sent">✉ Not Sent ({notSentCount})</option>
              <option value="not_signed">✕ Not Signed ({notSignedCount})</option>
            </select>
            <Filter className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-3 pointer-events-none" />
          </div>

          {/* Document Presence Filter */}
          <div className="relative min-w-[170px]">
            <select
              value={docFilter}
              onChange={(e) => setDocFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold text-xs appearance-none cursor-pointer pr-8 text-magenta"
            >
              <option value="all">All Document Statuses</option>
              <option value="has_nda_doc">Signed NDA File Uploaded</option>
              <option value="missing_nda_doc">Signed NDA File Missing</option>
              <option value="has_student_cert">With Student Certificate</option>
              <option value="has_sgk">With SGK Entry</option>
              <option value="has_pending">With Pending Review Docs</option>
              <option value="no_docs">No Documents Uploaded</option>
            </select>
            <FileText className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-3 pointer-events-none" />
          </div>

          {/* Filter by Cohort */}
          <div className="relative min-w-[130px]">
            <select
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold text-xs appearance-none cursor-pointer pr-8"
            >
              <option value="all">All Cohorts</option>
              {cohorts.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
            <Calendar className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-3 pointer-events-none" />
          </div>

          {/* Filter by Level */}
          <div className="relative min-w-[120px]">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold text-xs appearance-none cursor-pointer pr-8"
            >
              <option value="all">All Levels</option>
              {levels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-subtle overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-magenta border-t-transparent animate-spin"></div>
            <p className="text-xs font-bold text-gray-400">Loading documents and agreements...</p>
          </div>
        ) : error ? (
          <div className="py-16 px-4 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
            <h3 className="font-extrabold text-sm text-gray-900">Failed to load data</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">{error}</p>
          </div>
        ) : filteredCubes.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <h3 className="font-extrabold text-sm text-gray-900">No Cubes found matching selected filters</h3>
            <p className="text-xs text-gray-400 mt-1">
              Try adjusting your search query or clearing filter options.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-100 text-[10px] font-extrabold tracking-wider uppercase text-gray-400">
                  <th className="py-3.5 px-4">Cube</th>
                  <th className="py-3.5 px-4">Cohort &amp; Level</th>
                  <th className="py-3.5 px-4">
                    <span className="text-magenta flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Non-Disclosure Agreement (NDA)</span>
                    </span>
                  </th>
                  <th className="py-3.5 px-4">Uploaded Documents</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredCubes.map((cube) => {
                  const isActionLoading = actionLoadingId === cube.id;
                  const isFounding = cube.is_founding_cube;
                  const status = getEffectiveStatus(cube);
                  const docs = cube.documents || [];
                  const ndaDoc = docs.find((d) => d.type === 'NDA');
                  const otherDocs = docs.filter((d) => d.type !== 'NDA');

                  return (
                    <tr key={cube.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Cube Identifier */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-mono font-extrabold text-[11px] px-2 py-0.5 rounded border shrink-0 ${
                              isFounding
                                ? 'bg-amber-400/10 border-amber-400/20 text-amber-700'
                                : 'bg-magenta/5 border-magenta/15 text-magenta'
                            }`}
                          >
                            #{cube.cube_number}
                          </span>
                          <UserAvatar
                            name={cube.user?.name || 'Cube'}
                            avatarUrl={cube.avatar_url || cube.user?.avatar_url}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <Link
                              to={`/cubes/${cube.id}`}
                              className="font-extrabold text-gray-900 hover:text-magenta transition-colors flex items-center gap-1.5 truncate"
                            >
                              <span>{cube.user?.name || 'Unknown Cube'}</span>
                              {isFounding && <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />}
                            </Link>
                            <p className="text-[11px] text-gray-400 truncate">{cube.user?.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Cohort & Level */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="font-semibold text-gray-700">{cube.cohort || 'N/A'}</span>
                          <span className="text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200/60">
                            {cube.current_level.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>

                      {/* NDA Priority Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-start gap-1">
                          {status === 'signed' ? (
                            <div className="inline-flex flex-col items-start gap-0.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Signed</span>
                              </span>
                              {cube.nda_signed_at && (
                                <span className="text-[10px] font-mono text-gray-400 pl-1">
                                  {new Date(cube.nda_signed_at).toLocaleDateString('en-GB')}
                                </span>
                              )}
                            </div>
                          ) : status === 'pending' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200">
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Pending Signature</span>
                            </span>
                          ) : status === 'not_signed' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200">
                              <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>Not Signed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200">
                              <Send className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>Not Sent</span>
                            </span>
                          )}

                          {/* NDA Document File Actions */}
                          {ndaDoc ? (
                            <div className="flex items-center gap-1 mt-1">
                              <button
                                type="button"
                                onClick={() => handleViewDoc(ndaDoc.id, false)}
                                title={`View NDA document: ${ndaDoc.file_name}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-magenta/20 bg-magenta/5 hover:bg-magenta/10 text-magenta transition"
                              >
                                <Eye className="w-3 h-3" />
                                <span>View Agreement</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleViewDoc(ndaDoc.id, true)}
                                title={`Download NDA document: ${ndaDoc.file_name}`}
                                className="p-1 rounded-lg text-gray-500 hover:text-magenta hover:bg-magenta/5 border border-gray-200 transition"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenUpload(cube, 'NDA')}
                              className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-magenta hover:underline"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Upload Signed NDA</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* All Other Uploaded Documents Column */}
                      <td className="py-3.5 px-4">
                        {otherDocs.length === 0 ? (
                          <span className="text-gray-400 text-xs italic">No other documents</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {otherDocs.map((doc) => {
                              const meta = DOC_TYPE_META[doc.type] || DOC_TYPE_META.OTHER;
                              const isApproved = doc.status === 'APPROVED';
                              const isPending = doc.status === 'PENDING_REVIEW';

                              return (
                                <button
                                  key={doc.id}
                                  type="button"
                                  onClick={() => handleViewDoc(doc.id, false)}
                                  title={`${doc.title} (${doc.file_name}) - Click to preview`}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition hover:opacity-85 shadow-2xs ${meta.color}`}
                                >
                                  {isApproved && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />}
                                  {isPending && <Clock className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
                                  <span>{meta.short}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Actions Column */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {/* Upload document button for this cube */}
                          <button
                            type="button"
                            onClick={() => handleOpenUpload(cube)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-200 hover:border-magenta hover:text-magenta bg-white hover:bg-magenta/5 text-gray-700 font-bold text-xs shadow-2xs transition"
                            title="Upload document for this Cube"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Upload Doc</span>
                          </button>

                          {/* Quick NDA Status Selector */}
                          <div className="relative">
                            <select
                              value={status}
                              onChange={(e) => handleSetStatus(cube, e.target.value as NdaStatusType)}
                              disabled={isActionLoading}
                              className={`text-[11px] font-bold py-1.5 pl-2.5 pr-6 rounded-xl border appearance-none outline-none cursor-pointer transition disabled:opacity-50 ${
                                status === 'signed'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : status === 'pending'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : status === 'not_signed'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-gray-50 text-gray-700 border-gray-200'
                              }`}
                            >
                              <option value="not_sent">✉ Not Sent</option>
                              <option value="pending">⏳ Pending</option>
                              <option value="signed">✓ Signed</option>
                              <option value="not_signed">✕ Not Signed</option>
                            </select>
                            {isActionLoading ? (
                              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin absolute right-2 top-2.5 pointer-events-none"></div>
                            ) : (
                              <Filter className="w-2.5 h-2.5 text-current absolute right-2 top-2.5 pointer-events-none opacity-60" />
                            )}
                          </div>

                          {/* View Profile Shortcut */}
                          <Link
                            to={`/cubes/${cube.id}`}
                            className="p-1.5 rounded-lg border border-gray-100 hover:border-gray-200 text-gray-400 hover:text-gray-700 transition"
                            title="Go to Cube Profile"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Document Modal (for selected Cube) */}
      {uploadTargetCube && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-gray-100 shadow-2xl relative">
            <button
              onClick={() => setUploadTargetCube(null)}
              className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-xl bg-magenta/10 text-magenta">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">
                  Upload Document
                </h3>
                <p className="text-xs text-magenta font-bold">
                  Cube #{uploadTargetCube.cube_number} · {uploadTargetCube.user?.name}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 mb-5">
              Upload an official document (NDA, Student Certificate, SGK document, etc.) on behalf of this Cube.
            </p>

            {uploadError && (
              <div className="mb-4 bg-red-50 text-red-600 border border-red-100 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Document Type *
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => {
                    const newType = e.target.value as DocumentType;
                    setUploadDocType(newType);
                    setUploadTitle(DOC_TYPE_META[newType].label);
                  }}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:border-magenta transition"
                >
                  {(Object.keys(DOC_TYPE_META) as DocumentType[]).map((tKey) => (
                    <option key={tKey} value={tKey}>
                      {DOC_TYPE_META[tKey].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. 2026 Signed Non-Disclosure Agreement"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 outline-none focus:border-magenta transition"
                />
              </div>

              {/* File picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  File (PDF, Image, or Word) *
                </label>
                <div
                  onClick={() => modalFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
                    uploadFile
                      ? 'border-magenta bg-magenta/5'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                  }`}
                >
                  <input
                    ref={modalFileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setUploadFile(f);
                    }}
                  />
                  {uploadFile ? (
                    <div className="flex flex-col items-center gap-1">
                      <FileCheck className="w-8 h-8 text-magenta mb-1" />
                      <p className="text-xs font-extrabold text-gray-900 truncate max-w-xs">
                        {uploadFile.name}
                      </p>
                      <p className="text-[11px] text-gray-400">Click to replace</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <UploadCloud className="w-8 h-8 text-gray-400 mb-1" />
                      <p className="text-xs font-bold text-gray-700">Click or drag and drop file to upload</p>
                      <p className="text-[11px] text-gray-400">PDF, PNG, JPG, DOCX (Max. 15MB)</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Description / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Any additional notes regarding this document..."
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:border-magenta transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setUploadTargetCube(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || uploadLoading}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-magenta text-white hover:bg-magenta/90 shadow-md shadow-magenta/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
                >
                  {uploadLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Upload Document</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
