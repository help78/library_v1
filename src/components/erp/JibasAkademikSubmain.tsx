import React from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export type JibasAkademikTabKey =
  | 'home'
  | 'referensi'
  | 'psb'
  | 'guru-pelajaran'
  | 'jadwal-kalender'
  | 'siswa'
  | 'reposisi'
  | 'presensi'
  | 'penilaian'
  | 'pengaturan';

export interface JibasSubmainLink {
  label: string;
  viewId?: string; // Target view in ModuleWorkspace / jbsakad
  path?: string; // Route path if external module
  badge?: string;
  isAction?: boolean;
}

export interface JibasSubmainItem {
  title: string;
  iconType: string;
  links: (JibasSubmainLink | 'divider')[];
}

export interface JibasSubmainSection {
  sectionTitle?: string;
  items: JibasSubmainItem[];
}

export interface JibasSubmainConfig {
  key: JibasAkademikTabKey;
  headerTitle: string;
  layout: 'grid-icons' | 'vertical-groups';
  sections: JibasSubmainSection[];
}

// Custom authentic SVG icons matching the JIBAS screenshots
export function JibasSubmainIcon({ type }: { type: string }) {
  switch (type) {
    case 'gear':
      return (
        <svg className="w-10 h-10 text-slate-700 shrink-0" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="7" stroke="currentColor" strokeWidth="3" />
          <path
            d="M24 4V10M24 38V44M4 24H10M38 24H44M9.86 9.86L14.1 14.1M33.9 33.9L38.14 38.14M9.86 38.14L14.1 33.9M33.9 14.1L38.14 9.86"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'pegawai':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <circle cx="18" cy="16" r="6" stroke="#0288d1" strokeWidth="2.5" fill="#e1f5fe" />
          <path d="M8 36c0-5.5 4.5-9 10-9s10 3.5 10 9" stroke="#0288d1" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="31" cy="18" r="5" stroke="#03a9f4" strokeWidth="2" fill="#e1f5fe" />
          <path d="M25 36c0-4.2 3.3-7 7.5-7s7.5 2.8 7.5 7" stroke="#03a9f4" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'departemen':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          {/* Top cube */}
          <polygon points="24,6 32,11 24,16 16,11" fill="#4fc3f7" stroke="#0288d1" strokeWidth="1.5" />
          <polygon points="16,11 24,16 24,24 16,19" fill="#0288d1" stroke="#0277bd" strokeWidth="1.5" />
          <polygon points="24,16 32,11 32,19 24,24" fill="#81d4fa" stroke="#0288d1" strokeWidth="1.5" />
          {/* Bottom left cube */}
          <polygon points="16,21 24,26 16,31 8,26" fill="#ffd54f" stroke="#f57f17" strokeWidth="1.5" />
          <polygon points="8,26 16,31 16,39 8,34" fill="#ffb300" stroke="#f57f17" strokeWidth="1.5" />
          <polygon points="16,31 24,26 24,34 16,39" fill="#ffe082" stroke="#f57f17" strokeWidth="1.5" />
          {/* Bottom right cube */}
          <polygon points="32,21 40,26 32,31 24,26" fill="#e57373" stroke="#c62828" strokeWidth="1.5" />
          <polygon points="24,26 32,31 32,39 24,34" fill="#d32f2f" stroke="#c62828" strokeWidth="1.5" />
          <polygon points="32,31 40,26 40,34 32,39" fill="#ef9a9a" stroke="#c62828" strokeWidth="1.5" />
        </svg>
      );
    case 'angkatan':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="10" width="32" height="30" rx="3" fill="#ffffff" stroke="#c2185b" strokeWidth="2.5" />
          <rect x="8" y="10" width="32" height="10" rx="2" fill="#e91e63" />
          <line x1="16" y1="6" x2="16" y2="12" stroke="#ad1457" strokeWidth="3" strokeLinecap="round" />
          <line x1="32" y1="6" x2="32" y2="12" stroke="#ad1457" strokeWidth="3" strokeLinecap="round" />
          <text x="24" y="34" fontSize="16" fontWeight="bold" fill="#37474f" textAnchor="middle" fontFamily="sans-serif">
            31
          </text>
        </svg>
      );
    case 'tingkat':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="28" width="6" height="12" fill="#42a5f5" rx="1" />
          <rect x="18" y="22" width="6" height="18" fill="#1e88e5" rx="1" />
          <rect x="28" y="14" width="6" height="26" fill="#1565c0" rx="1" />
          <path d="M10 24L21 17L28 20L38 8" stroke="#0d47a1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <polygon points="38,8 32,8 38,14" fill="#0d47a1" />
        </svg>
      );
    case 'tahunajaran':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="10" width="32" height="30" rx="3" fill="#ffffff" stroke="#37474f" strokeWidth="2.5" />
          <rect x="8" y="10" width="32" height="8" rx="2" fill="#546e7a" />
          <text x="24" y="25" fontSize="8" fontWeight="bold" fill="#78909c" textAnchor="middle" fontFamily="sans-serif">
            0 0 0 0
          </text>
          <text x="24" y="34" fontSize="10" fontWeight="bold" fill="#263238" textAnchor="middle" fontFamily="sans-serif">
            YEAR
          </text>
        </svg>
      );
    case 'semester':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="10" y="10" width="12" height="12" rx="2" fill="#29b6f6" />
          <rect x="26" y="10" width="12" height="12" rx="2" fill="#ab47bc" />
          <rect x="10" y="26" width="12" height="12" rx="2" fill="#26a69a" />
          <rect x="26" y="26" width="12" height="12" rx="2" fill="#ff7043" />
        </svg>
      );
    case 'kelas':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="10" width="32" height="28" rx="3" fill="#00897b" stroke="#004d40" strokeWidth="2" />
          <path d="M14 28L22 18L28 24L34 16" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'kop':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="10" y="10" width="28" height="28" rx="3" fill="#ffffff" stroke="#37474f" strokeWidth="2.5" />
          <rect x="10" y="10" width="28" height="8" rx="1" fill="#f4511e" />
          <line x1="16" y1="24" x2="32" y2="24" stroke="#78909c" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="30" x2="26" y2="30" stroke="#78909c" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'audit':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="12" y="8" width="24" height="32" rx="2" fill="#ffffff" stroke="#546e7a" strokeWidth="2" />
          <line x1="18" y1="16" x2="30" y2="16" stroke="#90a4ae" strokeWidth="2" strokeLinecap="round" />
          <line x1="18" y1="22" x2="26" y2="22" stroke="#90a4ae" strokeWidth="2" strokeLinecap="round" />
          <circle cx="28" cy="28" r="6" stroke="#263238" strokeWidth="2" fill="#e0f7fa" />
          <line x1="33" y1="33" x2="38" y2="38" stroke="#263238" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'rekap':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="10" y="8" width="28" height="32" rx="2" fill="#ffffff" stroke="#37474f" strokeWidth="2" />
          <line x1="16" y1="16" x2="32" y2="16" stroke="#78909c" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="22" x2="32" y2="22" stroke="#78909c" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="28" x2="26" y2="28" stroke="#78909c" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'books':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <path d="M10 32C10 32 16 30 24 33C32 30 38 32 38 32V14C38 14 32 12 24 15C16 12 10 14 10 14V32Z" fill="#ffb74d" stroke="#f57c00" strokeWidth="2" />
          <path d="M10 24C10 24 16 22 24 25C32 22 38 24 38 24" stroke="#e65100" strokeWidth="1.5" />
          <path d="M10 16C10 16 16 14 24 17C32 14 38 16 38 16" stroke="#e65100" strokeWidth="1.5" />
        </svg>
      );
    case 'students':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <circle cx="16" cy="18" r="5" fill="#bbdefb" stroke="#1976d2" strokeWidth="2" />
          <circle cx="32" cy="18" r="5" fill="#bbdefb" stroke="#1976d2" strokeWidth="2" />
          <circle cx="24" cy="14" r="5.5" fill="#90caf9" stroke="#1565c0" strokeWidth="2" />
          <path d="M16 36c0-4 3.5-7 8-7s8 3 8 7" stroke="#1565c0" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M8 36c0-3.5 3-6 7-6" stroke="#1976d2" strokeWidth="2" strokeLinecap="round" />
          <path d="M40 36c0-3.5-3-6-7-6" stroke="#1976d2" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'tree':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="20" y="8" width="8" height="8" rx="1.5" fill="#ff7043" stroke="#d84315" strokeWidth="2" />
          <line x1="24" y1="16" x2="24" y2="24" stroke="#546e7a" strokeWidth="2" />
          <line x1="12" y1="24" x2="36" y2="24" stroke="#546e7a" strokeWidth="2" />
          <line x1="12" y1="24" x2="12" y2="30" stroke="#546e7a" strokeWidth="2" />
          <line x1="24" y1="24" x2="24" y2="30" stroke="#546e7a" strokeWidth="2" />
          <line x1="36" y1="24" x2="36" y2="30" stroke="#546e7a" strokeWidth="2" />
          <rect x="8" y="30" width="8" height="8" rx="1.5" fill="#42a5f5" stroke="#1565c0" strokeWidth="2" />
          <rect x="20" y="30" width="8" height="8" rx="1.5" fill="#42a5f5" stroke="#1565c0" strokeWidth="2" />
          <rect x="32" y="30" width="8" height="8" rx="1.5" fill="#42a5f5" stroke="#1565c0" strokeWidth="2" />
        </svg>
      );
    case 'pie':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="16" fill="#e57373" stroke="#c62828" strokeWidth="2" />
          <path d="M24 24L38 16A16 16 0 0 0 24 8Z" fill="#4fc3f7" stroke="#0288d1" strokeWidth="2" />
          <path d="M24 24L40 24A16 16 0 0 0 38 16Z" fill="#81c784" stroke="#2e7d32" strokeWidth="2" />
        </svg>
      );
    case 'swap':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <path d="M10 18H36M36 18L28 10M36 18L28 26" stroke="#0288d1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M38 30H12M12 30L20 22M12 30L20 38" stroke="#43a047" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'updown':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <path d="M16 38V12M16 12L8 20M16 12L24 20" stroke="#1e88e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M32 10V36M32 36L24 28M32 36L40 28" stroke="#e53935" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'gradcap':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <path d="M24 10L6 19L24 28L42 19L24 10Z" fill="#78909c" stroke="#37474f" strokeWidth="2" />
          <path d="M12 22.5V32C12 32 17 36 24 36C31 36 36 32 36 32V22.5" fill="#b0bec5" stroke="#37474f" strokeWidth="2" />
          <line x1="38" y1="20" x2="38" y2="34" stroke="#d84315" strokeWidth="2" strokeLinecap="round" />
          <circle cx="38" cy="35" r="2" fill="#d84315" />
        </svg>
      );
    case 'exit':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <path d="M14 10H32V38H14" stroke="#0288d1" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M26 24H8M8 24L14 18M8 24L14 30" stroke="#e53935" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'clock-calendar':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="10" width="26" height="24" rx="2" fill="#ffffff" stroke="#e53935" strokeWidth="2" />
          <rect x="8" y="10" width="26" height="7" rx="1" fill="#e53935" />
          <circle cx="32" cy="30" r="10" fill="#ffffff" stroke="#37474f" strokeWidth="2" />
          <line x1="32" y1="30" x2="32" y2="24" stroke="#37474f" strokeWidth="2" strokeLinecap="round" />
          <line x1="32" y1="30" x2="37" y2="30" stroke="#37474f" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'clock-notepad':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="10" width="26" height="26" rx="2" fill="#ffffff" stroke="#fb8c00" strokeWidth="2" />
          <rect x="8" y="10" width="26" height="7" rx="1" fill="#fb8c00" />
          <circle cx="32" cy="30" r="9" fill="#ffffff" stroke="#0288d1" strokeWidth="2" />
          <line x1="32" y1="30" x2="32" y2="25" stroke="#0288d1" strokeWidth="2" strokeLinecap="round" />
          <line x1="32" y1="30" x2="36" y2="30" stroke="#0288d1" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'facescan':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <path d="M8 16V10H14M34 10H40V16M40 32V38H34M14 38H8V32" stroke="#0288d1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="24" cy="22" r="6" stroke="#0288d1" strokeWidth="2" fill="#e1f5fe" />
          <path d="M16 34c0-3.5 3.5-6 8-6s8 2.5 8 6" stroke="#0288d1" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'grading':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="8" width="28" height="32" rx="2" fill="#ffffff" stroke="#37474f" strokeWidth="2" />
          <line x1="8" y1="18" x2="36" y2="18" stroke="#37474f" strokeWidth="1.5" />
          <line x1="8" y1="28" x2="36" y2="28" stroke="#37474f" strokeWidth="1.5" />
          <line x1="22" y1="8" x2="22" y2="40" stroke="#37474f" strokeWidth="1.5" />
          <text x="15" y="16" fontSize="8" fontWeight="bold" fill="#37474f" textAnchor="middle">1</text>
          <text x="29" y="16" fontSize="8" fontWeight="bold" fill="#37474f" textAnchor="middle">2</text>
          <text x="15" y="25" fontSize="8" fontWeight="bold" fill="#37474f" textAnchor="middle">6</text>
          <text x="29" y="25" fontSize="8" fontWeight="bold" fill="#37474f" textAnchor="middle">5</text>
          <path d="M30 38L38 30L42 34L34 42Z" fill="#ffb74d" stroke="#f57c00" strokeWidth="1.5" />
        </svg>
      );
    case 'excel':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="10" width="32" height="28" rx="2" fill="#2e7d32" stroke="#1b5e20" strokeWidth="1.5" />
          <text x="24" y="28" fontSize="16" fontWeight="bold" fill="#ffffff" textAnchor="middle" fontFamily="sans-serif">
            X
          </text>
        </svg>
      );
    case 'reportcard':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="10" y="8" width="28" height="32" rx="2" fill="#ffffff" stroke="#1976d2" strokeWidth="2" />
          <line x1="16" y1="14" x2="26" y2="14" stroke="#90caf9" strokeWidth="2" strokeLinecap="round" />
          <text x="24" y="28" fontSize="14" fontWeight="bold" fill="#d32f2f" textAnchor="middle" fontFamily="sans-serif">
            A+
          </text>
          <line x1="16" y1="34" x2="32" y2="34" stroke="#90caf9" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'cbe':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="10" width="32" height="22" rx="2" fill="#ffffff" stroke="#00838f" strokeWidth="2" />
          <line x1="14" y1="16" x2="24" y2="16" stroke="#80deea" strokeWidth="2" strokeLinecap="round" />
          <line x1="14" y1="22" x2="30" y2="22" stroke="#80deea" strokeWidth="2" strokeLinecap="round" />
          <path d="M20 32L18 38H30L28 32" stroke="#00838f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'document-gear':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="10" y="8" width="24" height="32" rx="2" fill="#ffffff" stroke="#37474f" strokeWidth="2" />
          <line x1="16" y1="14" x2="28" y2="14" stroke="#90a4ae" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="20" x2="24" y2="20" stroke="#90a4ae" strokeWidth="2" strokeLinecap="round" />
          <circle cx="34" cy="34" r="6" fill="#e53935" stroke="#b71c1c" strokeWidth="1.5" />
          <circle cx="34" cy="34" r="2.5" fill="#ffffff" />
        </svg>
      );
    case 'card-id':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="10" width="32" height="26" rx="2" fill="#ffffff" stroke="#546e7a" strokeWidth="2" />
          <rect x="12" y="14" width="8" height="8" rx="1" fill="#90caf9" />
          <line x1="24" y1="16" x2="34" y2="16" stroke="#90a4ae" strokeWidth="2" strokeLinecap="round" />
          <line x1="24" y1="22" x2="32" y2="22" stroke="#90a4ae" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="28" x2="34" y2="28" stroke="#90a4ae" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'calendar-grid':
      return (
        <svg className="w-10 h-10 shrink-0" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="10" width="32" height="28" rx="3" fill="#ffffff" stroke="#e53935" strokeWidth="2" />
          <rect x="8" y="10" width="32" height="8" rx="1" fill="#e53935" />
          <circle cx="16" cy="24" r="2" fill="#b0bec5" />
          <circle cx="24" cy="24" r="2" fill="#b0bec5" />
          <circle cx="32" cy="24" r="2" fill="#b0bec5" />
          <circle cx="16" cy="32" r="2" fill="#b0bec5" />
          <circle cx="24" cy="32" r="2" fill="#b0bec5" />
          <circle cx="32" cy="32" r="2" fill="#b0bec5" />
        </svg>
      );
    default:
      return (
        <svg className="w-10 h-10 shrink-0 text-slate-700" viewBox="0 0 48 48" fill="none">
          <rect x="10" y="10" width="28" height="28" rx="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
  }
}

export const JIBAS_SUBMAIN_CONFIGS: Record<string, JibasSubmainConfig> = {
  referensi: {
    key: 'referensi',
    headerTitle: 'REFERENSI',
    layout: 'grid-icons',
    sections: [
      {
        sectionTitle: 'PENGATURAN',
        items: [
          {
            title: 'Pegawai',
            iconType: 'pegawai',
            links: [{ label: 'Pegawai', viewId: 'guru' }],
          },
          {
            title: 'Departemen',
            iconType: 'departemen',
            links: [{ label: 'Departemen', viewId: 'kelas' }],
          },
          {
            title: 'Angkatan',
            iconType: 'angkatan',
            links: [{ label: 'Angkatan', viewId: 'alumni' }],
          },
          {
            title: 'Tingkat',
            iconType: 'tingkat',
            links: [{ label: 'Tingkat', viewId: 'kelas' }],
          },
          {
            title: 'Tahun Ajaran',
            iconType: 'tahunajaran',
            links: [{ label: 'Tahun Ajaran', viewId: 'tahunajaran' }],
          },
          {
            title: 'Semester',
            iconType: 'semester',
            links: [{ label: 'Semester', viewId: 'semester' }],
          },
          {
            title: 'Kelas',
            iconType: 'kelas',
            links: [{ label: 'Kelas', viewId: 'kelas' }],
          },
        ],
      },
      {
        sectionTitle: 'INFORMASI',
        items: [
          {
            title: 'Kop Identitas Sekolah',
            iconType: 'kop',
            links: [{ label: 'Kop Identitas Sekolah', path: '/umum' }],
          },
          {
            title: 'Audit Perubahan Nilai',
            iconType: 'audit',
            links: [{ label: 'Audit Perubahan Nilai', viewId: 'rapor' }],
          },
          {
            title: 'Rekapitulasi Input Data',
            iconType: 'rekap',
            links: [{ label: 'Rekapitulasi Input Data', viewId: 'siswa-aktif' }],
          },
        ],
      },
    ],
  },

  psb: {
    key: 'psb',
    headerTitle: 'PENERIMAAN SISWA BARU',
    layout: 'vertical-groups',
    sections: [
      {
        items: [
          {
            title: 'Referensi',
            iconType: 'gear',
            links: [
              { label: 'Proses Penerimaan Calon Siswa', viewId: 'calonsiswa-search' },
              { label: 'Kelompok Calon Siswa', viewId: 'calonsiswa-search' },
              'divider',
              { label: 'Kolom Data Tambahan Calon Siswa', viewId: 'calonsiswa-search' },
              { label: 'Informasi Sumbangan dan Nilai', viewId: 'calonsiswa-search' },
            ],
          },
          {
            title: 'Pendataan',
            iconType: 'card-id',
            links: [{ label: 'Pendataan Calon Siswa', viewId: 'calonsiswa-search' }],
          },
          {
            title: 'Pengelolaan',
            iconType: 'swap',
            links: [
              { label: 'PIN Calon Siswa', viewId: 'calonsiswa-search' },
              { label: 'Pencarian Calon Siswa', viewId: 'calonsiswa-search' },
              { label: 'Pindah Kelompok Calon Siswa', viewId: 'calonsiswa-search' },
              { label: 'Penempatan Calon Siswa', viewId: 'calonsiswa-search' },
            ],
          },
          {
            title: 'Laporan',
            iconType: 'pie',
            links: [{ label: 'Statistik Calon Siswa', viewId: 'calonsiswa-search' }],
          },
        ],
      },
    ],
  },

  'guru-pelajaran': {
    key: 'guru-pelajaran',
    headerTitle: 'GURU & PELAJARAN',
    layout: 'vertical-groups',
    sections: [
      {
        items: [
          {
            title: 'Referensi',
            iconType: 'gear',
            links: [
              { label: 'Aspek Penilaian', viewId: 'rapor' },
              { label: 'Kelompok Pelajaran', viewId: 'pelajaran' },
            ],
          },
          {
            title: 'Pendataan',
            iconType: 'books',
            links: [
              { label: 'Pelajaran', viewId: 'pelajaran' },
              { label: 'Guru', viewId: 'guru' },
              { label: 'Rencana Program Pembelajaran', viewId: 'pelajaran' },
            ],
          },
          {
            title: 'Perhitungan Nilai Rapor',
            iconType: 'document-gear',
            links: [
              { label: 'Jenis Pengujian', viewId: 'rapor-nilaiujian' },
              { label: 'Aturan Perhitungan Nilai Rapor', viewId: 'rapor' },
              { label: 'Aturan Grading Nilai Rapor', viewId: 'rapor' },
            ],
          },
        ],
      },
    ],
  },

  'jadwal-kalender': {
    key: 'jadwal-kalender',
    headerTitle: 'JADWAL & KALENDER AKADEMIK',
    layout: 'vertical-groups',
    sections: [
      {
        items: [
          {
            title: 'Referensi',
            iconType: 'gear',
            links: [
              { label: 'Jam Pembelajaran', viewId: 'jadwal-kelas' },
              { label: 'Kategori Jadwal', viewId: 'jadwal-kelas' },
            ],
          },
          {
            title: 'Penyusunan Jadwal',
            iconType: 'semester',
            links: [
              { label: 'Penyusunan Jadwal per Kelas', viewId: 'jadwal-kelas' },
              { label: 'Penyusunan Jadwal per Guru', viewId: 'guru' },
              { label: 'Rekapitulasi Jadwal', viewId: 'jadwal-kelas' },
            ],
          },
          {
            title: 'Kalender Akademik',
            iconType: 'calendar-grid',
            links: [
              { label: 'Kalender Akademik', viewId: 'kalender-akademik' },
              { label: 'Penyusunan Kalender Akademik', viewId: 'kalender-akademik' },
            ],
          },
        ],
      },
    ],
  },

  siswa: {
    key: 'siswa',
    headerTitle: 'KESISWAAN',
    layout: 'vertical-groups',
    sections: [
      {
        items: [
          {
            title: 'Referensi',
            iconType: 'gear',
            links: [{ label: 'Kolom Data Tambahan Siswa', viewId: 'siswa-aktif' }],
          },
          {
            title: 'Pendataan',
            iconType: 'students',
            links: [{ label: 'Pendataan Siswa', viewId: 'siswa-aktif' }],
          },
          {
            title: 'Pengelolaan',
            iconType: 'tree',
            links: [
              { label: 'PIN Siswa', viewId: 'siswa-aktif' },
              { label: 'Pencarian Siswa', viewId: 'siswa-search-hp' },
            ],
          },
          {
            title: 'Pelaporan',
            iconType: 'pie',
            links: [
              { label: 'Statistik Siswa', viewId: 'siswa-aktif' },
              { label: 'Ulang Tahun Siswa', viewId: 'siswa-aktif' },
            ],
          },
        ],
      },
    ],
  },

  reposisi: {
    key: 'reposisi',
    headerTitle: 'REPOSISI SISWA',
    layout: 'vertical-groups',
    sections: [
      {
        items: [
          {
            title: 'Pindah Kelas',
            iconType: 'swap',
            links: [{ label: 'Pindah Kelas', viewId: 'siswa-per-kelas' }],
          },
          {
            title: 'Kenaikan Kelas',
            iconType: 'updown',
            links: [
              { label: 'Naik Kelas', viewId: 'siswa-per-kelas' },
              { label: 'Tinggal Kelas', viewId: 'siswa-per-kelas' },
            ],
          },
          {
            title: 'Kelulusan & Alumni',
            iconType: 'gradcap',
            links: [
              { label: 'Kelulusan Siswa (pindah departemen)', viewId: 'alumni' },
              'divider',
              { label: 'Pendataan Alumni', viewId: 'alumni' },
              { label: 'Daftar Alumni', viewId: 'alumni' },
              { label: 'Pencarian Alumni', viewId: 'alumni' },
            ],
          },
          {
            title: 'Mutasi & Siswa',
            iconType: 'exit',
            links: [
              { label: 'Jenis Mutasi', viewId: 'siswa-aktif' },
              { label: 'Mutasi Siswa', viewId: 'siswa-aktif' },
              'divider',
              { label: 'Daftar Mutasi', viewId: 'siswa-aktif' },
              { label: 'Statistik Mutasi', viewId: 'siswa-aktif' },
            ],
          },
        ],
      },
    ],
  },

  presensi: {
    key: 'presensi',
    headerTitle: 'PRESENSI',
    layout: 'vertical-groups',
    sections: [
      {
        items: [
          {
            title: 'Presensi Harian',
            iconType: 'clock-calendar',
            links: [
              { label: 'Pendataan Presensi Harian', viewId: 'presensiharian' },
              'divider',
              { label: 'Laporan Presensi Harian Siswa', viewId: 'presensiharian-nis' },
              { label: 'Laporan Presensi Harian per Kelas', viewId: 'presensiharian' },
            ],
          },
          {
            title: 'Presensi Pelajaran',
            iconType: 'clock-notepad',
            links: [
              { label: 'Pendataan Presensi Pelajaran', viewId: 'presensi-pelajaran' },
              'divider',
              { label: 'Laporan Presensi Pelajaran Siswa', viewId: 'presensi-pelajaran-nis' },
              { label: 'Laporan Presensi Pelajaran per Kelas', viewId: 'presensi-pelajaran' },
              { label: 'Laporan Refleksi Mengajar Guru', viewId: 'presensi-pelajaran' },
            ],
          },
          {
            title: 'Presensi Wajah & Fingerprint',
            iconType: 'facescan',
            links: [{ label: 'tampilkan', viewId: 'presensiharian' }],
          },
        ],
      },
    ],
  },

  penilaian: {
    key: 'penilaian',
    headerTitle: 'PENILAIAN',
    layout: 'vertical-groups',
    sections: [
      {
        items: [
          {
            title: 'Penilaian',
            iconType: 'grading',
            links: [{ label: 'Pendataan Nilai', viewId: 'rapor-nilaiujian' }],
          },
          {
            title: 'Ekspor-Impor Nilai',
            iconType: 'excel',
            links: [{ label: 'tampilkan', viewId: 'rapor' }],
          },
          {
            title: 'Penyusunan Rapor',
            iconType: 'reportcard',
            links: [
              { label: 'Penentuan Nilai Rapor', viewId: 'rapor' },
              { label: 'Penentuan Komentar Rapor', viewId: 'rapor' },
              'divider',
              { label: 'Rapor Siswa', viewId: 'rapor' },
            ],
          },
          {
            title: 'Pelaporan',
            iconType: 'rekap',
            links: [
              { label: 'Rerata RPP per Kelas', viewId: 'rapor' },
              { label: 'Rerata RPP per Siswa', viewId: 'rapor' },
              { label: 'Riwayat Nilai Siswa', viewId: 'rapor-nilaiujian' },
              { label: 'Riwayat Nilai Rapor Siswa', viewId: 'rapor-detail' },
              'divider',
              { label: 'Legger Nilai', viewId: 'rapor' },
              { label: 'Legger Nilai Rapor per Pelajaran', viewId: 'rapor' },
              { label: 'Legger Nilai Rapor per Kelas', viewId: 'rapor' },
            ],
          },
          {
            title: 'Computer Based Exam',
            iconType: 'cbe',
            links: [{ label: 'tampilkan', viewId: 'rapor' }],
          },
        ],
      },
    ],
  },

  pengaturan: {
    key: 'pengaturan',
    headerTitle: 'PENGATURAN',
    layout: 'vertical-groups',
    sections: [
      {
        items: [
          {
            title: 'Akses & Pengguna',
            iconType: 'pegawai',
            links: [
              { label: 'Kelola Hak Akses Pegawai', path: '/pengguna' },
              { label: 'Manajemen Akun Login', path: '/pengguna' },
            ],
          },
          {
            title: 'Sistem Informasi',
            iconType: 'gear',
            links: [
              { label: 'Identitas Sekolah & Kop Surat', path: '/umum' },
              { label: 'Basis Data & Koneksi API', viewId: 'siswa-aktif' },
            ],
          },
        ],
      },
    ],
  },
};

interface JibasAkademikSubmainProps {
  activeTab: JibasAkademikTabKey;
  onSelectView: (viewId: string, submainKey: JibasAkademikTabKey, label: string) => void;
  onNavigatePath?: (path: string) => void;
}

export function JibasAkademikSubmain({
  activeTab,
  onSelectView,
  onNavigatePath,
}: JibasAkademikSubmainProps) {
  const config = JIBAS_SUBMAIN_CONFIGS[activeTab];

  if (!config) {
    return (
      <div className="py-16 text-center text-slate-500 text-sm">
        Menu tidak ditemukan
      </div>
    );
  }

  // Tampilan Layout Grid Ikon (khusus REFERENSI, persis seperti Screenshot 3)
  if (config.layout === 'grid-icons') {
    return (
      <div className="w-full max-w-4xl mx-auto py-8 px-4 flex flex-col items-center">
        {/* Judul Utama Tengah */}
        <h1 className="text-xl sm:text-2xl font-normal text-slate-700 tracking-wider mb-8 text-center uppercase">
          {config.headerTitle}
        </h1>

        <div className="w-full space-y-10">
          {config.sections.map((sec, secIdx) => (
            <div key={secIdx} className="space-y-4 flex flex-col items-center">
              {sec.sectionTitle && (
                <div className="text-center">
                  <span className="text-[11px] font-bold tracking-widest text-slate-700 uppercase">
                    {sec.sectionTitle}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 justify-items-center">
                {sec.items.map((item, itemIdx) => {
                  const firstLink = item.links.find(
                    (l): l is JibasSubmainLink => l !== 'divider'
                  );
                  return (
                    <button
                      key={itemIdx}
                      type="button"
                      onClick={() => {
                        if (firstLink?.path && onNavigatePath) {
                          onNavigatePath(firstLink.path);
                        } else if (firstLink?.viewId) {
                          onSelectView(firstLink.viewId, config.key, item.title);
                        }
                      }}
                      className="group flex flex-col items-center gap-2 p-2 rounded-xl transition-all duration-150 hover:scale-105 cursor-pointer text-center max-w-[110px]"
                      title={`Buka ${item.title}`}
                    >
                      <div className="w-14 h-14 flex items-center justify-center transition-transform group-hover:drop-shadow-md">
                        <JibasSubmainIcon type={item.iconType} />
                      </div>
                      <span className="text-xs font-semibold text-slate-800 leading-tight group-hover:text-blue-700">
                        {item.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Tampilan Layout Vertikal Grup Kolom Ikon + Bullet Link Biru (Persis Screenshots 2, 4, 5, 6, 8, 9, 10)
  return (
    <div className="w-full max-w-3xl mx-auto py-8 px-4 flex flex-col items-center">
      {/* Judul Utama Tengah */}
      <h1 className="text-xl sm:text-2xl font-normal text-slate-700 tracking-wider mb-8 text-center uppercase">
        {config.headerTitle}
      </h1>

      <div className="w-full space-y-7">
        {config.sections.map((sec, secIdx) => (
          <div key={secIdx} className="space-y-6">
            {sec.items.map((item, itemIdx) => (
              <div key={itemIdx} className="flex items-start gap-4 sm:gap-6">
                {/* Ikon Grup */}
                <div className="w-12 h-12 flex items-center justify-center shrink-0 pt-0.5">
                  <JibasSubmainIcon type={item.iconType} />
                </div>

                {/* Konten Judul Grup & Daftar Link Bullet */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    {item.title}
                  </h3>

                  <ul className="space-y-1">
                    {item.links.map((link, lIdx) => {
                      if (link === 'divider') {
                        return (
                          <li key={lIdx} className="py-1">
                            <hr className="border-t border-dashed border-slate-300 w-48 sm:w-64" />
                          </li>
                        );
                      }

                      return (
                        <li key={lIdx} className="flex items-center gap-1.5 text-xs">
                          {link.label === 'tampilkan' ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (link.path && onNavigatePath) {
                                  onNavigatePath(link.path);
                                } else if (link.viewId) {
                                  onSelectView(link.viewId, config.key, item.title);
                                }
                              }}
                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              tampilkan
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (link.path && onNavigatePath) {
                                  onNavigatePath(link.path);
                                } else if (link.viewId) {
                                  onSelectView(link.viewId, config.key, link.label);
                                }
                              }}
                              className="text-left text-slate-900 hover:text-blue-700 hover:underline cursor-pointer transition-colors"
                            >
                              <span className="text-blue-600 font-bold mr-1.5">•</span>
                              <span className="hover:text-blue-700">{link.label}</span>
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
