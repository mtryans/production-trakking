import React, { useState, useEffect, useMemo, useRef } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import {
  Plus, Edit2, Trash2, X, Clock, Activity, Upload,
  Printer, History, LogOut, User, Lock, Users,
  Factory, Download, RefreshCw, FileText, Star, Award, Camera,
  Trash, RotateCcw, Scissors, Layers, ShoppingCart, Save, Send, AlertTriangle,
  FileSpreadsheet, BarChart2, CornerDownRight
} from 'lucide-react';

// Setup Laravel Echo + Reverb
declare global {
  interface Window {
    Pusher: any;
    Echo: any;
    XLSX: any;
  }
}

window.Pusher = Pusher;
window.Echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST ?? window.location.hostname,
  wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
  wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
  forceTLS: false,
  enabledTransports: ['ws'],
});

// DEBUG - tambahkan ini
console.log('REVERB CONFIG:', {
  key: import.meta.env.VITE_REVERB_APP_KEY,
  host: import.meta.env.VITE_REVERB_HOST,
  port: import.meta.env.VITE_REVERB_PORT,
});

window.Echo.connector.pusher.connection.bind('connected', () => {
  console.log('✅ Reverb CONNECTED!');
});

window.Echo.connector.pusher.connection.bind('disconnected', () => {
  console.log('❌ Reverb DISCONNECTED!');
});

window.Echo.connector.pusher.connection.bind('error', (err: any) => {
  console.log('❌ Reverb ERROR:', err);
});

// --- CONSTANTS ---
const TIME_SLOTS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const PREP_STAGES = ['bonding', 'skiving', 'lining', 'painting', 'gluing'];

const LINES = [
  ...Array.from({ length: 12 }, (_, i) => `HB1-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 12 }, (_, i) => `HB2-${String(i + 1).padStart(2, '0')}`)
];

// --- HELPER: CSRF TOKEN ---
function getCSRF(): string {
  return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '';
}

// --- API HELPER DENGAN PENANGANAN ERROR ---
const handleResponse = async (res: Response) => {
    if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = 'Terjadi kesalahan';
        try {
            const parsed = JSON.parse(errorText);
            errorMessage = parsed.error ?? parsed.message ?? errorText;
        } catch {}
        console.error(`API Error (${res.status}):`, errorText);
        const err: any = new Error(errorMessage);
        err.status = res.status;
        throw err;
    }
    return res.json();
};

const api = {
  get: async (url: string) => {
    const res = await fetch(url);
    return handleResponse(res);
  },
  post: async (url: string, data: any) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCSRF() },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  put: async (url: string, data: any) => {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCSRF() },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  delete: async (url: string) => {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'X-CSRF-TOKEN': getCSRF() },
    });
    return handleResponse(res);
  },
};

const renderSafe = (val: any) => {
  if (val === null || val === undefined) return "";
  if (typeof val === 'object') return "";
  return val;
};

// --- CUSTOM HOOK FOR AUTO SCROLL ---
const useAutoScroll = (ref: React.RefObject<HTMLDivElement | null>) => {
  const [isPaused, setIsPaused] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const scrollInterval = setInterval(() => {
      if (!isPaused) {
        if (element.scrollTop + element.clientHeight >= element.scrollHeight - 1) {
          element.scrollTop = 0;
        } else {
          element.scrollTop += 1;
        }
      }
    }, 50);
    return () => clearInterval(scrollInterval);
  }, [ref, isPaused]);
  return {
    handlers: {
      onMouseEnter: () => setIsPaused(true),
      onMouseLeave: () => setIsPaused(false),
      onTouchStart: () => setIsPaused(true),
      onTouchEnd: () => setIsPaused(false)
    }
  };
};

export default function App() {
  const [appUser, setAppUser] = useState<any | null>(null);

  // Login State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState('SEWING');

  // Data States
  const [targets, setTargets] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [trashList, setTrashList] = useState<any[]>([]);
  const [bestEmployees, setBestEmployees] = useState<any[]>([]);
  const [bestEmpImageDocs, setBestEmpImageDocs] = useState<any[]>([]);
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isBestEmpModalOpen, setIsBestEmpModalOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  // Filters & Time
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLine, setFilterLine] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Report State
  const [reportType, setReportType] = useState('month');
  const [reportDate, setReportDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const handleReportTypeChange = (type: string) => {
    setReportType(type);
    const d = new Date();
    if (type === 'month') {
      setReportDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    } else {
      setReportDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  };

  const isBusy = useRef(false);
  const table1Ref = useRef<HTMLDivElement>(null);
  const table3Ref = useRef<HTMLDivElement>(null);
  const scrollProps1 = useAutoScroll(table1Ref);

  // Forms
  const [formData, setFormData] = useState({
    lineId: LINES[0], customer: '', sitoyPo: '', workOrder: '', style: '', color: '',
    orderQty: 0, finishQty: 0, targetDay: 0, startDate: '', endDate: '',
    exFlyDate: '', sampleApproval: '',
    statusCutting: 0, statusPrep: 0, statusSupermarket: 0,
    image: '', targetPerHour: 0, lineWorkers: 0, headName: '', remarks: '',
    hourlyDataLine: {} as any, hourlyDataPac: {} as any,
    hourlyUpdatesLine: {} as any, hourlyUpdatesPac: {} as any,
    materialData: {
      cuttingHistory: [] as any[],
      prep: { bonding: 0, skiving: 0, lining: 0, painting: 0, gluing: 0 } as any,
      supermarket: 0,
      recutRequests: [] as any[],
      lineRejects: [] as any[],
      scrapTotal: 0
    },
    sewingMaterialSchedule: {
      takenFromSPM: 0,
      takenFromPrep: 0,
      remarks: ''
    }
  });

  const [bestEmpForm, setBestEmpForm] = useState({
    empId: '', name: '', dept: '', position: '', positionCn: '',
    attendance: 9, performance: 0, photo: '', month: '',
    building: 'HB1'
  });
  const [editingBestEmpId, setEditingBestEmpId] = useState<number | null>(null);
  const [bestEmpBuildingFilter, setBestEmpBuildingFilter] = useState('ALL');
  const [bestEmpDisplayMode, setBestEmpDisplayMode] = useState('image');

  const [bulkUploadMode, setBulkUploadMode] = useState(false);
  const [bulkMonth, setBulkMonth] = useState('');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const [userFormData, setUserFormData] = useState({ username: '', pass: '', role: 'USER', name: '' });
  const [editingId, setEditingId] = useState<number | null>(null);

  // --- WO STATUS STATE ---
  const [woStatusList, setWoStatusList] = useState<any[]>([]);
  const [woStatusSearch, setWoStatusSearch] = useState('');
  const [isWoDetailOpen, setIsWoDetailOpen] = useState(false);
  const [selectedWoDetail, setSelectedWoDetail] = useState<any>(null);
  const [woDetailLoading, setWoDetailLoading] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isSplitOpen, setIsSplitOpen] = useState(false);
  const [selectedWoForAction, setSelectedWoForAction] = useState<any>(null);
  const [transferForm, setTransferForm] = useState({ newLineId: LINES[0], remarks: '' });
  const [splitForm, setSplitForm] = useState({ newLineId: LINES[0], targetQty: 0, remarks: '' });

  // --- WO STATUS FUNCTIONS ---
  const loadWoStatus = async () => {
      try {
          const data = await api.get(`/api/wo-status?search=${woStatusSearch}`);
          setWoStatusList(data);
      } catch (e) { console.error(e); }
  };

  const openWoDetail = async (workOrder: string) => {
      setWoDetailLoading(true);
      setIsWoDetailOpen(true);
      try {
          const data = await api.get(`/api/wo-status/${workOrder}/detail`);
          setSelectedWoDetail(data);
      } catch (e) { console.error(e); }
      setWoDetailLoading(false);
  };

  const handleChangeStatus = async (workOrder: string, newStatus: string, remarks: string = '') => {
      try {
          await api.post(`/api/wo-status/${workOrder}/change-status`, {
              status: newStatus,
              user: `${appUser?.username} (${appUser?.role})`,
              userRole: appUser?.role,
              remarks,
          });
          await loadWoStatus();
          if (selectedWoDetail?.workOrder === workOrder) {
              await openWoDetail(workOrder);
          }
      } catch (e: any) {
          alert(e?.error ?? 'Gagal ubah status');
      }
  };

  const handleTransfer = async () => {
      if (!selectedWoForAction) return;
      if (!transferForm.remarks) { alert('Remarks wajib diisi!'); return; }
      try {
          await api.post(`/api/wo-status/${selectedWoForAction.workOrder}/transfer`, {
              newLineId: transferForm.newLineId,
              remarks: transferForm.remarks,
              user: `${appUser?.username} (${appUser?.role})`,
          });
          setIsTransferOpen(false);
          await loadWoStatus();
      } catch (e) { alert('Gagal transfer line'); }
  };

  const handleSplit = async () => {
      if (!selectedWoForAction) return;
      if (!splitForm.remarks) { alert('Remarks wajib diisi!'); return; }
      try {
          await api.post(`/api/wo-status/${selectedWoForAction.workOrder}/split`, {
              newLineId: splitForm.newLineId,
              targetQty: splitForm.targetQty,
              remarks: splitForm.remarks,
              user: `${appUser?.username} (${appUser?.role})`,
          });
          setIsSplitOpen(false);
          await loadWoStatus();
      } catch (e) { alert('Gagal split line'); }
  };

  // --- CLOCK ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- PERMISSIONS ---
  const isReadOnly = ['VIEWER', 'FINANCE'].includes(appUser?.role);
  const canEditMaster = !['VIEWER', 'USER', 'FINANCE'].includes(appUser?.role);
  const canDelete = ['ADMINISTRATOR', 'ADMIN'].includes(appUser?.role);
  const canViewLogs = ['ADMINISTRATOR', 'FINANCE', 'PLANNER', 'ADMIN'].includes(appUser?.role);
  const canViewHistory = ['ADMINISTRATOR', 'ADMIN', 'FINANCE', 'PLANNER'].includes(appUser?.role);
  const canManageUsers = appUser?.role === 'ADMINISTRATOR';

  // --- LOAD DATA ---
  const loadTargets = async () => {
    try {
      const data = await api.get('/api/tracker');
      setTargets(data);
      setLoading(false);
    } catch (e) {
      console.error('Gagal load data tracker:', e);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTargets();

    // Real-time via Reverb
    window.Echo.channel('production')
      .listen('.ProductionUpdated', () => {
        loadTargets();
      })
      .listen('.HourlyUpdated', (e: any) => {
        setTargets(prev => prev.map(item => {
          if (item.id !== e.id) return item;
          const newHourlyLine = { ...item.hourlyDataLine };
          const newHourlyPac = { ...item.hourlyDataPac };
          if (e.type === 'line') newHourlyLine[e.slot] = e.value;
          if (e.type === 'pac') newHourlyPac[e.slot] = e.value;
          const calcTotalLine = Object.values(newHourlyLine).reduce((a: any, b: any) => a + b, 0);
          const calcTotalPac = Object.values(newHourlyPac).reduce((a: any, b: any) => a + b, 0);
          return { ...item, hourlyDataLine: newHourlyLine, hourlyDataPac: newHourlyPac, calcTotalLine, calcTotalPac };
        }));
      });

    return () => {
      window.Echo.leaveChannel('production');
    };
  }, []);

  useEffect(() => {
      if (activeTab === 'WO_STATUS') {
          loadWoStatus();
      }
  }, [activeTab, woStatusSearch]);

  // --- LOAD HISTORY & TRASH ---
  useEffect(() => {
    if (!appUser || !canViewHistory) return;
    api.get('/api/history').then(setHistoryList).catch(console.error);
    api.get('/api/trash').then(setTrashList).catch(console.error);
  }, [appUser, canViewHistory]);

  // --- LOAD LOGS ---
  useEffect(() => {
    if (!appUser || !isLogOpen || !canViewLogs) return;
    api.get('/api/logs').then(setLogs).catch(console.error);
  }, [isLogOpen, appUser, canViewLogs]);

  // --- LOAD USERS ---
  useEffect(() => {
    if (!appUser || !isUserMgmtOpen || !canManageUsers) return;
    api.get('/api/users').then(setUsersList).catch(console.error);
  }, [isUserMgmtOpen, appUser, canManageUsers]);

  // --- LOAD BEST EMPLOYEES ---
  useEffect(() => {
    api.get('/api/best-employees').then(data => {
      data.sort((a: any, b: any) => (b.performance || 0) - (a.performance || 0));
      setBestEmployees(data);
    }).catch(console.error);
  }, []);

  // --- LOAD BEST EMP IMAGES ---
  useEffect(() => {
    api.get('/api/best-employee-images').then(setBestEmpImageDocs).catch(console.error);
  }, []);

  const filteredBestEmployees = useMemo(() => {
    let buildingToShow = bestEmpBuildingFilter;
    if (filterLine !== 'ALL') {
      if (filterLine.startsWith('HB1')) buildingToShow = 'HB1';
      else if (filterLine.startsWith('HB2')) buildingToShow = 'HB2';
    }
    if (buildingToShow === 'ALL') return bestEmployees;
    return bestEmployees.filter((emp: any) => (emp.building || 'HB1') === buildingToShow);
  }, [bestEmployees, bestEmpBuildingFilter, filterLine]);

  // --- LOGIN ---
  const handleAppLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCSRF() },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        setLoginError(err.error ?? 'Login gagal');
      } else {
        const user = await res.json();
        setAppUser(user);
      }
    } catch (err) {
      setLoginError('Terjadi kesalahan koneksi.');
    }
    setLoginLoading(false);
  };

  const handleLogout = () => {
    setAppUser(null);
    setLoginUsername('');
    setLoginPassword('');
  };

  // --- UTILS ---
  const formatDateIndo = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleDateString('id-ID') : "-";

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMINISTRATOR': return 'bg-purple-600';
      case 'ADMIN': return 'bg-blue-600';
      case 'CUTTING': return 'bg-orange-500';
      case 'PREPARATION': return 'bg-indigo-600';
      case 'SUPERMARKET': return 'bg-teal-600';
      default: return 'bg-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
      const map: any = {
          'WAITING_CUTTING':  { label: 'Waiting Cutting',   color: 'bg-gray-500' },
          'IN_CUTTING':       { label: 'In Cutting',         color: 'bg-red-500' },
          'IN_PREP':          { label: 'In Preparation',     color: 'bg-indigo-500' },
          'IN_SEWING':        { label: 'In Sewing',          color: 'bg-blue-500' },
          'ONGOING_FG':       { label: 'Ongoing FG',         color: 'bg-yellow-500' },
          'DONE_TO_STOCK':    { label: 'Done to Stock',      color: 'bg-teal-500' },
          'DONE_TO_SHIPPING': { label: 'Done to Shipping',   color: 'bg-green-600' },
          'DONE':             { label: 'DONE',               color: 'bg-emerald-700' },
      };
      const s = map[status] || { label: status, color: 'bg-gray-400' };
      return <span className={`px-2 py-0.5 rounded text-[10px] font-black text-white ${s.color}`}>{s.label}</span>;
  };

  // --- EXPORT HISTORY ---
  const handleExportHistory = () => {
    if (historyList.length === 0) { alert("Tidak ada data history."); return; }
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "TANGGAL,LINE,WO,STYLE,COLOR,TOTAL LINE,TOTAL PAC,RESET OLEH";
    TIME_SLOTS.forEach(slot => csvContent += `,LINE_H${slot}`);
    TIME_SLOTS.forEach(slot => csvContent += `,PAC_H${slot}`);
    csvContent += "\n";
    historyList.forEach((row: any) => {
      const dateStr = row.timestamp ? new Date(row.timestamp.seconds * 1000).toLocaleDateString('id-ID') : row.date;
      let rowStr = `${dateStr},${row.lineId},${row.workOrder},${row.style},${row.color},${row.totalLineProduced},${row.totalPacProduced},${row.closedBy}`;
      TIME_SLOTS.forEach(slot => { rowStr += `,${row.hourlyDataLine?.[slot] || 0}`; });
      TIME_SLOTS.forEach(slot => { rowStr += `,${row.hourlyDataPac?.[slot] || 0}`; });
      csvContent += rowStr + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Produksi_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    const dateStr = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');
    const filename = `Material_Report_${dateStr}.xls`;
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"></head><body><table border="1" style="border-collapse: collapse; width: 100%;"><thead><tr style="background-color: #4f46e5; color: white;"><th colspan="5" style="padding: 10px;">WO INFORMATION</th><th colspan="2" style="padding: 10px; background-color: #ef4444;">CUTTING DEPARTMENT</th><th colspan="5" style="padding: 10px; background-color: #6366f1;">PREPARATION DEPARTMENT (Actual)</th><th colspan="2" style="padding: 10px; background-color: #14b8a6;">SUPERMARKET & LINE</th></tr><tr style="background-color: #e0e7ff; font-weight: bold; text-align: center;"><th>Line</th><th>WO No</th><th>Style</th><th>Color</th><th>Order Qty</th><th>Actual Cut</th><th>Total Scrap</th>${PREP_STAGES.map(p => `<th>${p.toUpperCase()} Act</th>`).join('')}<th>SPM Stock</th><th>Sent to Line</th></tr></thead><tbody style="text-align: center;">`;
    filteredData.forEach((item: any) => {
      const mData = item.materialData || {};
      const prep = mData.prep || {};
      const cutAct = mData.cuttingHistory ? mData.cuttingHistory.reduce((a: number, b: any) => a + (Number(b.qty) || 0), 0) : 0;
      html += `<tr><td>${item.lineId}</td><td style="mso-number-format:'@'">${item.workOrder}</td><td>${item.style}</td><td>${item.color}</td><td>${item.orderQty}</td><td>${cutAct}</td><td style="color:red; font-weight:bold;">${mData.scrapTotal || 0}</td>${PREP_STAGES.map(p => `<td style="font-weight: bold;">${prep[p] || 0}</td>`).join('')}<td style="font-weight: bold;">${mData.supermarket || 0}</td><td style="font-weight: bold; color: #0f766e;">${item.sewingMaterialSchedule?.takenFromSPM || 0}</td></tr>`;
    });
    html += `</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // --- MATERIAL LOGIC ---
  const updateMaterialData = async (id: number, type: string, subtype: string | null, value: string | number, workOrder: string, lineId: string) => {
    if (!appUser || isReadOnly) return;
    isBusy.current = true;
    try {
      if (type === 'cutting') {
        await api.post('/api/material/cutting', { id, qty: Number(value), user: `${appUser.username} (${appUser.role})` });
      } else if (type === 'prep' && subtype) {
        await api.post('/api/material/prep', { id, process: subtype, qty: Number(value), user: `${appUser.username} (${appUser.role})` });
      }
      await loadTargets();
    } catch (err) {
      alert(err?.message ?? "Melebihin kuota Cutting.");
    } finally {
      setTimeout(() => { isBusy.current = false; }, 500);
    }
  };

  const processLineReject = async (item: any) => {
    if (!appUser || isReadOnly) return;
    const qtyInput = document.getElementById(`rej-qty-${item.id}`) as HTMLInputElement;
    const destInput = document.getElementById(`rej-dest-${item.id}`) as HTMLSelectElement;
    const rmkInput = document.getElementById(`rej-rmk-${item.id}`) as HTMLInputElement;
    const qty = Number(qtyInput?.value);
    const dest = destInput?.value;
    const rmk = rmkInput?.value;
    if (!qty || qty <= 0) { alert('Masukkan Qty Reject yang valid!'); return; }
    if (!rmk) { alert('Mohon isi alasan/remarks reject!'); return; }
    isBusy.current = true;
    try {
      await api.post('/api/material/line-reject', { id: item.id, qty, destPrep: dest, remarks: rmk });
      if (qtyInput) qtyInput.value = '';
      if (rmkInput) rmkInput.value = '';
      await loadTargets();
    } catch (err) {
      alert("Gagal memproses reject line.");
    } finally {
      setTimeout(() => { isBusy.current = false; }, 500);
    }
  };

  const forwardRejectToCutting = async (item: any, rejectId: number) => {
    if (!appUser || isReadOnly) return;
    isBusy.current = true;
    try {
      await api.post('/api/material/forward-reject', { id: item.id, rejectId });
      await loadTargets();
    } catch (err) {
      alert("Gagal forward reject ke cutting.");
    } finally {
      setTimeout(() => { isBusy.current = false; }, 500);
    }
  };

  const handlePrepTransfer = async (item: any, fromProc: string, dest: string, qtyStr: string | number, remarks: string) => {
    if (!appUser || isReadOnly) return;
    const qty = Number(qtyStr);
    if (qty <= 0) return;
    isBusy.current = true;
    try {
      await api.post('/api/material/prep-transfer', {
        id: item.id, fromProcess: fromProc, dest, qty, remarks
      });
      await loadTargets();
    } catch (err: any) {
    alert(err.message ?? 'Gagal simpan ke server');
    } finally {
        setTimeout(() => { isBusy.current = false; }, 500);
    }
  };

  const handleProcessRecut = async (item: any, reqId: number, recutQtyStr: string | number, scrapQtyStr: string | number) => {
    if (!appUser || isReadOnly) return;
    isBusy.current = true;
    try {
      await api.post('/api/material/process-recut', {
        id: item.id, recutId: reqId,
        recutQty: Number(recutQtyStr) || 0,
        scrapQty: Number(scrapQtyStr) || 0,
        user: `${appUser.username} (${appUser.role})`
      });
      await loadTargets();
    } catch (err) {
      alert("Gagal memproses recut.");
    } finally {
      setTimeout(() => { isBusy.current = false; }, 500);
    }
  };

  const sendSPMToLine = async (item: any, value: string | number) => {
    if (!appUser || isReadOnly) return;
    isBusy.current = true;
    try {
      await api.post('/api/material/spm-send', { id: item.id, qty: Number(value) });
      await loadTargets();
    } catch (err: any) {
      alert(err.message ?? "Gagal kirim SPM");
    } finally {
      setTimeout(() => { isBusy.current = false; }, 500);
    }
  };

  const updateSewingSchedule = async (id: number, field: string, value: string | number, currentSchedule: any) => {
    if (isReadOnly) return;
    try {
      await api.post('/api/material/sewing-schedule', {
        id,
        takenFromPrep: field === 'takenFromPrep' ? value : currentSchedule.takenFromPrep,
        remarks: field === 'remarks' ? value : currentSchedule.remarks,
      });
      await loadTargets();
    } catch (e) { console.error(e); }
  };

  // --- TUTUP HARI ---
  const handleCloseDay = async (item: any) => {
    if (!canEditMaster) return;
    if (!confirm(`TUTUP HARI untuk WO ${item.workOrder}?\n\nOutput hari ini: LINE=${item.calcTotalLine} | PAC=${item.calcTotalPac}\nData jam-jaman akan DIRESET dan ditambahkan ke Finish Qty.`)) return;
    try {
      const res = await api.post(`/api/tracker/${item.id}/close-day`, { user: appUser?.username });
      alert(`✅ Berhasil tutup hari!\nFinish Qty sekarang: ${res.newFinishQty} pcs\nSisa order: ${(Number(item.orderQty) || 0) - res.newFinishQty} pcs`);
      await loadTargets();
      const history = await api.get('/api/history');
      setHistoryList(history);
    } catch (error) { alert("Gagal melakukan tutup hari."); }
  };

  // --- SUBMIT FORM ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    try {
      const payload = { ...formData, user: `${appUser?.username} (${appUser?.role})` };
      if (editingId) {
        await api.put(`/api/tracker/${editingId}`, payload);
      } else {
        await api.post('/api/tracker', payload);
      }
      await loadTargets();
      resetForm();
    } catch (error) { alert("Gagal menyimpan data master."); }
  };

  // --- HOURLY UPDATE ---
  const handleDirectUpdate = async (docId: number, fieldType: string, slot: string | null, value: number) => {
    if (isReadOnly || !docId) return;
    try {
      if (fieldType === 'hourlyDataLine' && slot) {
        await api.post('/api/hourly', { id: docId, type: 'line', slot, value });
      } else if (fieldType === 'hourlyDataPac' && slot) {
        await api.post('/api/hourly', { id: docId, type: 'pac', slot, value });
      } else if (fieldType === 'targetPerHour') {
        await api.put(`/api/tracker/${docId}`, { targetPerHour: value, user: appUser?.username });
        await loadTargets();
      }
    } catch (error) { console.error("Update hourly failed", error); }
  };

  // --- DELETE / RESTORE / TRASH ---
  const handleDelete = async (item: any) => {
    if (!canDelete || !confirm(`Pindahkan Order ${item.workOrder} ke Tempat Sampah?`)) return;
    try {
      await api.delete(`/api/tracker/${item.id}`);
      await loadTargets();
      const trash = await api.get('/api/trash');
      setTrashList(trash);
    } catch (error) { alert("Gagal memindahkan data ke tempat sampah."); }
  };

  const handleRestore = async (trashDoc: any) => {
    if (!confirm(`Kembalikan Order ${trashDoc.workOrder} ke Produksi?`)) return;
    try {
      await api.post(`/api/tracker/${trashDoc.id}/restore`, { user: appUser?.username });
      await loadTargets();
      const trash = await api.get('/api/trash');
      setTrashList(trash);
    } catch (e) { alert("Gagal mengembalikan (restore) data."); }
  };

  const handlePermanentDelete = async (trashId: number, workOrder: string) => {
    if (!confirm(`HAPUS PERMANEN Order ${workOrder}? Data tidak bisa dikembalikan lagi!`)) return;
    try {
      await api.delete(`/api/trash/${trashId}`);
      const trash = await api.get('/api/trash');
      setTrashList(trash);
    } catch (e) { alert("Gagal hapus permanen."); }
  };

  const handleEmptyTrash = async () => {
    if (!canDelete || trashList.length === 0) return;
    if (!confirm(`HAPUS PERMANEN SEMUA (${trashList.length}) data di tempat sampah?\n\nTindakan ini sama sekali tidak dapat dibatalkan!`)) return;
    try {
      await api.delete('/api/trash');
      setTrashList([]);
    } catch (error) { alert("Gagal mengosongkan tempat sampah."); }
  };

  const handleEdit = (item: any) => {
    setFormData({
      ...item,
      lineId: item.lineId || LINES[0],
      hourlyDataLine: item.hourlyDataLine || {},
      hourlyDataPac: item.hourlyDataPac || {},
      hourlyUpdatesLine: item.hourlyUpdatesLine || {},
      hourlyUpdatesPac: item.hourlyUpdatesPac || {},
      materialData: item.materialData || { cuttingHistory: [], prep: {}, supermarket: 0, recutRequests: [], lineRejects: [], scrapTotal: 0 },
      sewingMaterialSchedule: item.sewingMaterialSchedule || { takenFromSPM: 0, takenFromPrep: 0, remarks: '' }
    });
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      lineId: filterLine !== 'ALL' ? filterLine : LINES[0],
      customer: '', sitoyPo: '', workOrder: '', style: '', color: '',
      orderQty: 0, finishQty: 0, targetDay: 0, startDate: '', endDate: '', exFlyDate: '', sampleApproval: '',
      statusCutting: 0, statusPrep: 0, statusSupermarket: 0, image: '', targetPerHour: 0, lineWorkers: 0, headName: '', remarks: '',
      hourlyDataLine: {}, hourlyDataPac: {}, hourlyUpdatesLine: {}, hourlyUpdatesPac: {},
      materialData: { cuttingHistory: [], prep: { bonding: 0, skiving: 0, lining: 0, painting: 0, gluing: 0 }, supermarket: 0, recutRequests: [], lineRejects: [], scrapTotal: 0 },
      sewingMaterialSchedule: { takenFromSPM: 0, takenFromPrep: 0, remarks: '' }
    });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = 150 / img.width;
        canvas.width = 150; canvas.height = img.height * scale;
        if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setFormData(prev => ({ ...prev, image: canvas.toDataURL('image/jpeg', 0.7) }));
      };
      if (ev.target?.result) img.src = ev.target.result as string;
    };
    reader.readAsDataURL(file);
  };

  // --- BEST EMPLOYEE HANDLERS ---
  const handleBestEmpImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = 200 / img.width;
        canvas.width = 200; canvas.height = img.height * scale;
        if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setBestEmpForm(prev => ({ ...prev, photo: canvas.toDataURL('image/jpeg', 0.75) }));
      };
      if (ev.target?.result) img.src = ev.target.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBestEmp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBestEmpId) {
        await api.put(`/api/best-employees/${editingBestEmpId}`, bestEmpForm);
      } else {
        await api.post('/api/best-employees', bestEmpForm);
      }
      const data = await api.get('/api/best-employees');
      data.sort((a: any, b: any) => (b.performance || 0) - (a.performance || 0));
      setBestEmployees(data);
      resetBestEmpForm();
    } catch (e) { alert('Gagal menyimpan employee.'); }
  };

  const handleEditBestEmp = (emp: any) => {
    setBestEmpForm({ ...emp, building: emp.building || 'HB1' });
    setEditingBestEmpId(emp.id);
    setIsBestEmpModalOpen(true);
  };

  const handleDeleteBestEmp = async (id: number) => {
    if (confirm('Hapus karyawan ini dari daftar Best Employee?')) {
      await api.delete(`/api/best-employees/${id}`);
      const data = await api.get('/api/best-employees');
      data.sort((a: any, b: any) => (b.performance || 0) - (a.performance || 0));
      setBestEmployees(data);
    }
  };

  const resetBestEmpForm = () => {
    setBestEmpForm({ empId: '', name: '', dept: '', position: '', positionCn: '', attendance: 9, performance: 0, photo: '', month: '', building: 'HB1' });
    setEditingBestEmpId(null);
    setIsBestEmpModalOpen(false);
    setBulkUploadMode(false);
    setBulkPreview([]);
    setBulkError('');
    setBulkMonth('');
  };

  const parseBulkRow = (row: any, idx: number) => {
    const dept2 = String(row['Dept2'] || row['DeptName'] || row['building'] || row['Building'] || '').trim();
    const building = dept2.includes('02') || dept2.toUpperCase().includes('HB-02') || dept2.toUpperCase().includes('HB2') ? 'HB2' : 'HB1';
    return {
      _idx: idx,
      empId: String(row['EmpID'] || row['empId'] || row['emp_id'] || '').replace(/^'/, '').trim(),
      name: String(row['EmpName'] || row['name'] || row['nama'] || '').trim(),
      dept: String(row['DeptName'] || row['dept'] || row['departemen'] || dept2 || '').trim(),
      position: String(row['Title'] || row['position'] || row['posisi'] || '').trim(),
      positionCn: String(row['positionCn'] || row['posisi_cn'] || '').trim(),
      attendance: Number(row['CardTime'] || row['attendance'] || row['kehadiran'] || 0),
      performance: Number(row['Hours'] || row['performance'] || row['performa'] || 0),
      building, photo: '', month: bulkMonth, selected: true,
    };
  };

  const parseCSVText = (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const delim = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const vals = line.split(delim).map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
  };

  const loadSheetJS = () => new Promise<any>((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('Gagal load SheetJS'));
    document.head.appendChild(s);
  });

  const handleBulkFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkError(''); setBulkPreview([]);
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      let rows: any[] = [];
      if (ext === 'csv' || ext === 'tsv') {
        const text = await file.text(); rows = parseCSVText(text);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const XLSXLib = await loadSheetJS();
        const buf = await file.arrayBuffer();
        const wb = XLSXLib.read(buf, { type: 'array' });
        rows = XLSXLib.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      } else { setBulkError('Format tidak didukung. Gunakan .xlsx atau .csv'); return; }
      if (rows.length === 0) { setBulkError('File kosong atau format tidak dikenali.'); return; }
      const parsed = rows.slice(0, 24).map((r, i) => parseBulkRow(r, i)).filter(r => r.empId || r.name);
      if (parsed.length === 0) { setBulkError('Tidak ada data valid.'); return; }
      setBulkPreview(parsed);
    } catch (err: any) { setBulkError('Gagal membaca file: ' + err.message); }
    e.target.value = '';
  };

  const toggleBulkRow = (idx: number) => {
    setBulkPreview(prev => prev.map(r => r._idx === idx ? { ...r, selected: !r.selected } : r));
  };

  const handleBulkSave = async () => {
    const selected = bulkPreview.filter(r => r.selected);
    if (selected.length === 0) { setBulkError('Pilih minimal 1 karyawan.'); return; }
    if (!bulkMonth.trim()) { setBulkError('Isi Bulan/Periode terlebih dahulu.'); return; }
    setBulkUploading(true); setBulkError('');
    try {
      await api.post('/api/best-employees/bulk', {
        employees: selected.map(e => ({ ...e, month: bulkMonth }))
      });
      alert(`✅ Berhasil upload ${selected.length} karyawan!`);
      const data = await api.get('/api/best-employees');
      data.sort((a: any, b: any) => (b.performance || 0) - (a.performance || 0));
      setBestEmployees(data);
      setBulkPreview([]); setBulkUploadMode(false); setBulkMonth(''); setIsBestEmpModalOpen(false);
    } catch (err: any) { setBulkError('Gagal menyimpan: ' + err.message); }
    setBulkUploading(false);
  };

  const handleBestEmpImageDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isPdf = ext === 'pdf';
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await api.post('/api/best-employee-images', {
          imageData: ev.target?.result,
          type: isPdf ? 'pdf' : 'image',
          building: bestEmpBuildingFilter === 'HB2' ? 'HB2' : 'HB1',
          month: '',
        });
        const images = await api.get('/api/best-employee-images');
        setBestEmpImageDocs(images);
        setBestEmpDisplayMode('image');
      } catch (err: any) { alert('Gagal upload: ' + err.message); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteBestEmpImageDoc = async (id: number) => {
    if (confirm('Hapus gambar ini?')) {
      await api.delete(`/api/best-employee-images/${id}`);
      const images = await api.get('/api/best-employee-images');
      setBestEmpImageDocs(images);
    }
  };

  const filteredBestEmpImages = useMemo(() => {
    let buildingToShow = bestEmpBuildingFilter;
    if (filterLine !== 'ALL') buildingToShow = filterLine.startsWith('HB2') ? 'HB2' : 'HB1';
    if (buildingToShow === 'ALL') return bestEmpImageDocs;
    return bestEmpImageDocs.filter(d => (d.building || 'HB1') === buildingToShow);
  }, [bestEmpImageDocs, bestEmpBuildingFilter, filterLine]);

  const filteredData = useMemo(() => {
    return targets.filter(item => {
      const matchesLine = filterLine === 'ALL' || item.lineId === filterLine;
      const matchesSearch = (item.workOrder || '').toLowerCase().includes(searchTerm.toLowerCase()) || (item.style || '').toLowerCase().includes(searchTerm.toLowerCase());
      let matchesDate = true;
      if (startDate || endDate) {
        const itemTime = new Date(item.createdAt?.seconds * 1000).getTime();
        if (startDate && itemTime < new Date(startDate).getTime()) matchesDate = false;
        if (endDate && itemTime > new Date(endDate).getTime()) matchesDate = false;
      }
      return matchesLine && matchesSearch && matchesDate;
    });
  }, [targets, filterLine, searchTerm, startDate, endDate]);

  // --- REPORT/RESUME LOGIC ---
  const generateReportStats = () => {
    const isMonth = reportType === 'month';
    const compareStr = reportDate;
    const stats: any = {};
    const buildingStats: any = {
      HB1: { output: 0, target: 0, wosDone: 0, wosProgress: 0, activeDays: 0, lineOutputs: Array(12).fill(0) },
      HB2: { output: 0, target: 0, wosDone: 0, wosProgress: 0, activeDays: 0, lineOutputs: Array(12).fill(0) }
    };

    LINES.forEach(l => {
      stats[l] = { output: 0, target: 0, styles: new Set(), activeDays: 0, hourlyTotals: Array(10).fill(0), wosDone: 0, wosProgress: 0, uniqueWOs: new Map(), missedMandatory: 0, missedDetails: new Set() };
    });

    const registerWO = (line: string, wo: string, qty: number) => {
      if (stats[line] && wo && qty > 0) stats[line].uniqueWOs.set(wo, qty);
    };

    const checkAudit = (line: string, hourlyDataLine: any, isHistory: boolean, dateLabel: string) => {
      let missed = 0;
      if (isHistory) {
        for (let i = 1; i <= 7; i++) {
          const val = hourlyDataLine[String(i)];
          if (val === undefined || val === null || val === '') { missed++; stats[line].missedDetails.add(isMonth ? dateLabel : `J${i}`); }
        }
      } else {
        let maxFilledSlot = 0;
        for (let i = 10; i >= 1; i--) {
          const val = hourlyDataLine[String(i)];
          if (val !== undefined && val !== null && val !== '') { maxFilledSlot = i; break; }
        }
        const checkLimit = Math.min(maxFilledSlot, 7);
        for (let i = 1; i <= checkLimit; i++) {
          const val = hourlyDataLine[String(i)];
          if (val === undefined || val === null || val === '') { missed++; stats[line].missedDetails.add(`J${i}`); }
        }
      }
      stats[line].missedMandatory += missed;
    };

    historyList.forEach(h => {
      const d = h.timestamp?.seconds ? new Date(h.timestamp.seconds * 1000) : new Date(h.date?.split('/').reverse().join('-'));
      const yearStr = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const dStr = isMonth ? `${yearStr}-${monthStr}` : `${yearStr}-${monthStr}-${dayStr}`;
      if (dStr === compareStr) {
        const line = h.lineId;
        if (stats[line]) {
          stats[line].output += Number(h.totalLineProduced) || 0;
          stats[line].styles.add(h.style || 'Unknown');
          stats[line].activeDays += 1;
          const activeWO = targets.find(t => t.workOrder === h.workOrder);
          registerWO(line, h.workOrder, Number(h.orderQty) || Number(activeWO?.orderQty) || 0);
          TIME_SLOTS.forEach((slot, idx) => { stats[line].hourlyTotals[idx] += Number(h.hourlyDataLine?.[slot]) || 0; });
          checkAudit(line, h.hourlyDataLine || {}, true, `${dayStr}/${monthStr}`);
        }
      }
    });

    const currDate = new Date();
    const currMonthStr = `${currDate.getFullYear()}-${String(currDate.getMonth() + 1).padStart(2, '0')}`;
    const currDayStr = `${currMonthStr}-${String(currDate.getDate()).padStart(2, '0')}`;
    const isCurrentActive = isMonth ? (compareStr === currMonthStr) : (compareStr === currDayStr);

    targets.forEach(t => {
      const line = t.lineId;
      if (stats[line]) {
        const accFinishLine = (Number(t.finishQty) || 0) + (Number(t.calcTotalLine) || 0);
        const balLine = (Number(t.orderQty) || 0) - accFinishLine;
        if (balLine <= 0) stats[line].wosDone += 1;
        else stats[line].wosProgress += 1;
        registerWO(line, t.workOrder, Number(t.orderQty) || 0);
        if (isCurrentActive) {
          if (t.calcTotalLine > 0 || (t.hourlyDataLine && Object.keys(t.hourlyDataLine).length > 0)) {
            stats[line].output += Number(t.calcTotalLine) || 0;
            stats[line].activeDays += 1;
            stats[line].styles.add(t.style || 'Unknown');
            TIME_SLOTS.forEach((slot, idx) => { stats[line].hourlyTotals[idx] += Number(t.hourlyDataLine?.[slot]) || 0; });
            checkAudit(line, t.hourlyDataLine || {}, false, 'Hari Ini');
          }
        }
      }
    });

    Object.entries(stats).forEach(([line, data]: [string, any]) => {
      data.target = Array.from(data.uniqueWOs.values()).reduce((sum: any, qty: any) => sum + qty, 0);
      const bldg = line.startsWith('HB1') ? 'HB1' : (line.startsWith('HB2') ? 'HB2' : null);
      if (bldg && (data.output > 0 || data.wosDone > 0 || data.wosProgress > 0)) {
        buildingStats[bldg].output += data.output;
        buildingStats[bldg].target += data.target;
        buildingStats[bldg].wosDone += data.wosDone;
        buildingStats[bldg].wosProgress += data.wosProgress;
        buildingStats[bldg].activeDays = Math.max(buildingStats[bldg].activeDays, data.activeDays);
        const lineNumStr = line.split('-')[1];
        if (lineNumStr) {
          const idx = parseInt(lineNumStr, 10) - 1;
          if (idx >= 0 && idx < 12) buildingStats[bldg].lineOutputs[idx] += data.output;
        }
      }
    });

    return { lineStats: stats, buildingStats };
  };

  const { lineStats, buildingStats } = useMemo(() => generateReportStats(), [historyList, targets, reportType, reportDate]);

  const getVideoSource = (line: string) => {
    if (line === 'ALL') return 'compro.mp4';
    if (line === 'HB2-01') return 'LINE 1,2,3 LT 2.mp4';
    if (line === 'HB2-02') return 'LINE 1,2,3 LT 2.mp4';
    if (line === 'HB2-03') return 'LINE 1,2,3 LT 2.mp4';
    if (line === 'HB2-04') return 'LINE 4,5,6 LT 2.mp4';
    if (line === 'HB2-05') return 'LINE 4,5,6 LT 2.mp4';
    if (line === 'HB2-06') return 'LINE 4,5,6 LT 2.mp4';
    if (line === 'HB1-02') return 'TB HB-02 L73049.mp4';
    if (line === 'HB1-04') return 'LA S50422.mp4';
    if (line === 'HB1-05') return 'TM L73561 LT 1 hb 05.mov';
    if (line === 'HB1-06') return 'LA S49662.mp4';
    if (line === 'HB1-07') return 'TU M118 hb -7.mp4';
    if (line === 'HB1-08') return 'TUMI M1795B.mp4';
    if (line === 'HB1-10') return 'TUMI M1804B.mp4';
    if (line.startsWith('HB2-')) return 'Line2LT2.mp4';
    if (line.includes('09')) return 'TUMI M1957.mp4';
    return 'line1lt1.mp4';
  };

  // ─── LOGIN SCREEN ───────────────────────────────────────────────────────────
  if (!appUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#D7CCC8] to-[#A1887F] flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-[#D7CCC8]">
          <div className="bg-[#5D4037] p-8 text-center">
            <Factory className="mx-auto h-16 w-16 text-[#D7CCC8] mb-4 opacity-90" />
            <h1 className="text-2xl font-bold text-[#FFF8E1] tracking-wider">PRODUCTION TRACKER</h1>
            <p className="text-[#D7CCC8] text-sm mt-1">PT Sitoy Leather Products Indonesia</p>
          </div>
          <form onSubmit={handleAppLogin} className="p-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#5D4037] mb-1">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-5 w-5 text-[#8D6E63]" />
                <input type="text" className="pl-10 w-full p-2 border border-[#D7CCC8] rounded focus:ring-2 focus:ring-[#8D6E63] outline-none" placeholder="Masukkan username" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5D4037] mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-5 w-5 text-[#8D6E63]" />
                <input type="password" className="pl-10 w-full p-2 border border-[#D7CCC8] rounded focus:ring-2 focus:ring-[#8D6E63] outline-none" placeholder="Masukkan password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
              </div>
            </div>
            {loginError && <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded border border-red-100 font-medium">{loginError}</div>}
            <button type="submit" disabled={loginLoading} className="w-full bg-[#8D6E63] hover:bg-[#6D4C41] text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:bg-gray-400">
              {loginLoading ? 'Memeriksa...' : 'MASUK (LOGIN)'}
            </button>
          </form>
          <div className="bg-[#EFEBE9] p-4 text-center border-t border-[#D7CCC8]"><p className="text-xs text-[#8D6E63]">© 2026 IT Team</p></div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-slate-600">Loading Database...</div>;

  // ─── MAIN APP ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 font-sans text-sm text-slate-900 pb-20 print:bg-white print:pb-0">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: sans-serif; }
          .print-hidden { display: none !important; }
          select, input { display: none !important; }
          .print-value { display: block !important; }
          .print-scroll-none { overflow: visible !important; max-height: none !important; height: auto !important; }
          table { font-size: 9px; width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid black !important; padding: 2px !important; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
          .print-container { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* ── PRINT HEADER ── */}
      <div className="hidden print:block p-4 mb-2 border-b-2 border-black">
        <div className="flex justify-between items-end">
          <div className="text-left">
            <h1 className="text-2xl font-bold uppercase">LAPORAN PRODUKSI HARIAN <span className="text-xl font-normal normal-case ml-2">(生产日报表)</span></h1>
            <p>PERIOD: {startDate ? formatDateIndo(startDate) : 'SEMUA'} s/d {endDate ? formatDateIndo(endDate) : 'HARI INI'}</p>
          </div>
          <div className="text-right font-mono">
            <p>LINE: {renderSafe(filterLine)}</p><p>DICETAK OLEH: {renderSafe(appUser.username.toUpperCase())}</p><p>{currentTime.toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>

      {/* ── NAVBAR ── */}
      <div className="bg-white border-b sticky top-0 z-20 shadow-sm p-3 flex flex-col md:flex-row gap-3 justify-between items-start print-hidden">
        <div className="flex flex-col gap-2 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-blue-100 px-3 py-1 rounded text-blue-900 font-bold border border-blue-200"><Activity size={16} /><span>MONITORING PRODUKSI</span></div>
            <div className={`px-2 py-1 rounded text-[10px] font-bold text-white uppercase ${getRoleBadgeColor(appUser.role)}`}>{renderSafe(appUser.role)} : {renderSafe(appUser.name)}</div>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded border border-gray-200">
            <span className="text-[10px] font-bold text-gray-500 uppercase">Period:</span>
            <input type="date" className="border rounded px-2 py-1 text-xs" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span className="text-gray-400 text-xs">-</span>
            <input type="date" className="border rounded px-2 py-1 text-xs" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            {(startDate || endDate) && <button onClick={() => { setStartDate(''); setEndDate(''); }} className="ml-1 text-red-500"><X size={14} /></button>}
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2 items-end w-full md:w-auto">
          <div className="flex items-center gap-2">
            <select value={filterLine} onChange={e => setFilterLine(e.target.value)} className="border rounded py-1 px-2 text-xs h-8">
              <option value="ALL">ALL LINE</option>
              {LINES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <input type="text" placeholder="Cari..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-2 pr-2 py-1 border rounded w-32 text-xs h-8" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {canDelete && <button onClick={() => setIsTrashOpen(true)} className="bg-red-700 hover:bg-red-800 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 shadow h-8"><Trash size={14} /> TRASH</button>}
            {canManageUsers && <button onClick={() => setIsBestEmpModalOpen(true)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 shadow h-8"><Star size={14} /> BEST EMP</button>}
            {canManageUsers && <button onClick={() => setIsUserMgmtOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 shadow h-8"><Users size={14} /> USERS</button>}
            {canViewHistory && <button onClick={() => setIsReportOpen(true)} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 shadow h-8"><BarChart2 size={14} /> RESUME</button>}
            {canViewHistory && <button onClick={() => setIsHistoryOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 shadow h-8"><FileText size={14} /> HISTORY</button>}
            {canViewLogs && <button onClick={() => setIsLogOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 shadow h-8"><History size={14} /> LOG</button>}
            <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 shadow h-8"><Printer size={14} /> PRINT</button>
            {canEditMaster && <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 shadow h-8"><Plus size={14} /> NEW</button>}
            <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 shadow h-8"><LogOut size={14} /></button>
          </div>
        </div>
      </div>

      {/* --- TAB NAVIGATION --- */}
      <div className="px-2 mt-2 print:hidden">
        <div className="flex space-x-1 bg-gray-200 p-1 rounded-t-lg w-fit">
          <button onClick={() => setActiveTab('SEWING')} className={`px-4 py-2 text-sm font-bold rounded-t-lg flex items-center gap-2 ${activeTab === 'SEWING' ? 'bg-white text-blue-900 border-t-2 border-blue-900 shadow-sm' : 'text-gray-500 hover:bg-gray-300'}`}>
            <Factory size={16} /> SEWING / ASSEMBLY
          </button>
          <button onClick={() => setActiveTab('MATERIAL')} className={`px-4 py-2 text-sm font-bold rounded-t-lg flex items-center gap-2 ${activeTab === 'MATERIAL' ? 'bg-white text-orange-900 border-t-2 border-orange-900 shadow-sm' : 'text-gray-500 hover:bg-gray-300'}`}>
            <Layers size={16} /> MATERIAL CONTROL
          </button>
          <button onClick={() => setActiveTab('WO_STATUS')} className={`px-4 py-2 text-sm font-bold rounded-t-lg flex items-center gap-2 ${activeTab === 'WO_STATUS' ? 'bg-white text-purple-900 border-t-2 border-purple-900 shadow-sm' : 'text-gray-500 hover:bg-gray-300'}`}>
            <FileText size={16} /> WO STATUS
          </button>
        </div>
      </div>

      <div className="p-2 w-full mx-auto space-y-4 print:p-0 print:space-y-4">

        {/* === SEWING TAB === */}
        {activeTab === 'SEWING' && (
          <>
            {/* TABLE 1: PRODUCTION SCHEDULE */}
            <div className="bg-white shadow rounded-sm overflow-hidden border border-gray-400 print:shadow-none print:border-black print-container">
              <div className="bg-gray-700 text-white px-3 py-1.5 font-bold text-sm flex justify-between items-center print:bg-gray-300 print:text-black print:border-b print:border-black">
                <span>PRODUCTION SCHEDULE - INFO (生产计划表)</span>
                <span className="bg-gray-600 px-2 py-0.5 rounded text-xs print-hidden">Line: {renderSafe(filterLine)}</span>
              </div>
              <div ref={table1Ref} className="overflow-auto max-h-[350px] print-scroll-none" {...scrollProps1.handlers}>
                <table className="w-full border-collapse border border-gray-400 text-center print:border-black">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-100 text-gray-800 print:bg-gray-100 shadow-sm">
                      <th className="border p-1 w-12 print:border-black">LINE<br /><span className="text-xs">行號</span></th>
                      <th className="border p-1 w-20 print:border-black">CUSTOMER<br /><span className="text-xs">客户</span></th>
                      <th className="border p-1 w-16 print:border-black">SITOY PO<br /><span className="text-xs">合同号</span></th>
                      <th className="border p-1 w-20 print:border-black">ORDER NO<br /><span className="text-xs">订单号</span></th>
                      <th className="border p-1 w-20 print:border-black">STYLE<br /><span className="text-xs">款号</span></th>
                      <th className="border p-1 w-16 bg-yellow-50 print:bg-yellow-50 print:border-black">ORDER QTY<br /><span className="text-xs">订单数量</span></th>
                      <th className="border p-1 w-16 print:border-black">FINISH QTY<br /><span className="text-xs">完成数量</span></th>
                      <th className="border p-1 w-10 print:border-black">TARGET DAY<br /><span className="text-xs">目标日</span></th>
                      <th className="border p-1 w-20 print:border-black">Start<br /><span className="text-xs">开始</span></th>
                      <th className="border p-1 w-20 print:border-black">End<br /><span className="text-xs">结束</span></th>
                      <th className="border p-1 w-20 print:border-black text-red-600">Ex-Fty<br /><span className="text-xs">出货期</span></th>
                      <th className="border p-1 w-16 print:border-black">SAMPLE APPROVAL<br /><span className="text-xs">样品审批状态</span></th>
                      <th className="border p-1 w-24 bg-gray-50 print:border-black">STATUS MATERIAL</th>
                      {canEditMaster && <th className="border p-1 w-10 print:hidden">ACTION</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item: any) => {
                      const mData = item.materialData || {};
                      const sch = item.sewingMaterialSchedule || {};
                      const totalCut = mData.cuttingHistory ? mData.cuttingHistory.reduce((a: number, b: any) => a + (Number(b.qty) || 0), 0) : 0;
                      const prepToLine = Number(sch.takenFromPrep) || 0;
                      const spmToLine = Number(sch.takenFromSPM) || 0;
                      const totalMaterialReceivedInLine = spmToLine + prepToLine;
                      const isLineActive = totalMaterialReceivedInLine > 0 || totalCut > 0;
                      const accFinishLine = (Number(item.finishQty) || 0) + (Number(item.calcTotalLine) || 0);
                      const isDone = (Number(item.orderQty) || 0) > 0 && accFinishLine >= (Number(item.orderQty) || 0);

                      return (
                        <tr key={item.id} className="hover:bg-blue-50 h-12 text-sm break-inside-avoid">
                          <td className="border p-1 font-bold print:border-black">{renderSafe(item.lineId)}</td>
                          <td className="border p-1 print:border-black">{renderSafe(item.customer)}</td>
                          <td className="border p-1 print:border-black">{renderSafe(item.sitoyPo)}</td>
                          <td className="border p-1 font-mono font-bold text-blue-900 print:text-black print:border-black">{renderSafe(item.workOrder)}</td>
                          <td className="border p-1 print:border-black">{renderSafe(item.style)}</td>
                          <td className="border p-1 font-bold bg-yellow-50 print:bg-yellow-50 print:border-black">{renderSafe(item.orderQty)}</td>
                          <td className="border p-1 print:border-black">{renderSafe(item.finishQty)}</td>
                          <td className="border p-1 print:border-black">{renderSafe(item.targetDay)}</td>
                          <td className="border p-1 print:border-black text-[10px]">{formatDateIndo(item.startDate)}</td>
                          <td className="border p-1 print:border-black text-[10px]">{formatDateIndo(item.endDate)}</td>
                          <td className="border p-1 font-bold text-red-600 print:border-black text-[10px]">{formatDateIndo(item.exFlyDate)}</td>
                          <td className="border p-1 print:border-black">{renderSafe(item.sampleApproval)}</td>
                          <td className="border p-1 print:border-black bg-white align-middle text-center">
                            {isDone ? (
                              <div className="bg-emerald-100 border border-emerald-300 rounded p-1 flex flex-col items-center justify-center w-full shadow-sm">
                                <span className="text-[9px] font-black text-emerald-800 mb-0.5 leading-none">✅ ALL DONE</span>
                                <div className="flex items-center gap-1 text-[8px] font-bold text-emerald-900 bg-white/50 px-1 rounded border border-emerald-200">
                                  <span>C:{totalCut}</span><span className="text-emerald-400">|</span>
                                  <span>P:{prepToLine}</span><span className="text-emerald-400">|</span>
                                  <span>S:{spmToLine}</span>
                                </div>
                              </div>
                            ) : isLineActive ? (
                              <div className="bg-blue-50 text-blue-700 font-bold px-2 py-1.5 rounded text-[10px] flex items-center justify-center gap-1 border border-blue-200">
                                <Activity size={12} /> ACTIVE
                              </div>
                            ) : (
                              <div className="bg-gray-100 text-gray-500 font-bold px-2 py-1.5 rounded text-[10px] flex items-center justify-center gap-1 border border-gray-300">
                                WAITING MAT
                              </div>
                            )}
                          </td>
                          {canEditMaster && (
                            <td className="border p-1 print:hidden">
                              <button onClick={() => handleEdit(item)} className="text-blue-600 bg-blue-100 p-1 rounded hover:bg-blue-200 mr-1"><Edit2 size={14} /></button>
                              <button onClick={() => handleDelete(item)} className="text-red-600 bg-red-100 p-1 rounded hover:bg-red-200"><Trash2 size={14} /></button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TABLE 2 & 3: OUTPUT PRODUKSI */}
            <div className="bg-white shadow rounded-sm overflow-hidden border border-gray-400 print:shadow-none print:border-black print-container">
              <div className="bg-blue-900 text-white px-3 py-1.5 font-bold text-sm flex items-center gap-2 print:bg-gray-300 print:text-black print:border-b print:border-black">
                <Clock size={16} /><span>OUTPUT PRODUKSI & PACKING PERHARI (每日产量)</span>
              </div>
              <div ref={table3Ref} className="overflow-auto max-h-[350px] pb-4 print:pb-0 print-scroll-none">
                <table className="w-full border-collapse border border-gray-400 text-center print:border-black">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-100 text-gray-800 h-10 print:bg-gray-100 shadow-sm">
                      <th className="border p-1 w-12 text-sm font-bold bg-gray-200 print:border-black">LINE<br /><span className="text-xs">行號</span></th>
                      <th className="border p-1 w-20 text-sm font-bold bg-white print:border-black">ORDER NO<br /><span className="text-xs">订单号</span></th>
                      <th className="border p-1 w-20 text-sm font-bold bg-white print:border-black">STYLE<br /><span className="text-xs">款号</span></th>
                      <th className="border p-1 w-14 text-sm font-bold bg-white print:border-black">TOTAL ORDER<br /><span className="text-xs">总订单</span></th>
                      <th className="border p-1 w-14 text-sm font-bold bg-white print:border-black">COLOR<br /><span className="text-xs">颜色</span></th>
                      <th className="border p-1 w-14 text-sm font-bold bg-white print:border-black">PICTURE<br /><span className="text-xs">图片</span></th>
                      <th className="border p-1 w-14 text-sm font-bold bg-yellow-100 print:border-black">HOURLY TARGET<br /><span className="text-xs">每小时目标</span></th>
                      <th className="border p-1 w-14 text-sm font-bold bg-gray-50 print:border-black">OUTPUT<br /><span className="text-xs">输出</span></th>
                      {TIME_SLOTS.map(h => <th key={h} className="border p-1 w-10 text-sm font-bold bg-white print:border-black">{h}</th>)}
                      <th className="border p-1 w-14 bg-green-200 text-sm font-bold print:bg-green-200 print:border-black">TOTAL<br /><span className="text-xs">总完成</span></th>
                      <th className="border p-1 w-14 bg-red-100 text-sm font-bold print:bg-red-100 print:border-black">SISA<br /><span className="text-xs">剩余</span></th>
                      <th className="border p-1 w-14 text-sm font-bold bg-white print:border-black">WORKER<br /><span className="text-xs">工人</span></th>
                      <th className="border p-1 w-20 text-sm font-bold bg-white print:border-black">HEAD<br /><span className="text-xs">组长</span></th>
                      {canEditMaster && <th className="border p-1 w-10 print:hidden">RESET</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item: any) => {
                      const accFinishLine = (Number(item.finishQty) || 0) + (Number(item.calcTotalLine) || 0);
                      const accFinishPac = (Number(item.finishQty) || 0) + (Number(item.calcTotalPac) || 0);
                      const balLine = (Number(item.orderQty) || 0) - accFinishLine;
                      const balPac = (Number(item.orderQty) || 0) - accFinishPac;
                      const totalCut = item.materialData?.cuttingHistory ? item.materialData.cuttingHistory.reduce((a: number, b: any) => a + (Number(b.qty) || 0), 0) : 0;
                      const totalMaterialReceivedInLine = (Number(item.sewingMaterialSchedule?.takenFromSPM) || 0) + (Number(item.sewingMaterialSchedule?.takenFromPrep) || 0);
                      const isLocked = !(totalMaterialReceivedInLine > 0 || totalCut > 0);

                      return (
                        <React.Fragment key={item.id}>
                          <tr className="h-10 bg-white border-b border-gray-300 print:break-inside-avoid">
                            <td rowSpan={2} className="border p-1 font-bold text-blue-900 bg-gray-50 align-middle print:border-black">{renderSafe(item.lineId)}</td>
                            <td rowSpan={2} className="border p-1 font-mono text-[10px] align-middle print:border-black">{renderSafe(item.workOrder)}</td>
                            <td rowSpan={2} className="border p-1 text-[10px] align-middle print:border-black">{renderSafe(item.style)}</td>
                            <td rowSpan={2} className="border p-1 font-bold align-middle print:border-black">{renderSafe(item.orderQty)}</td>
                            <td rowSpan={2} className="border p-1 text-[10px] align-middle print:border-black">{renderSafe(item.color)}</td>
                            <td rowSpan={2} className="border p-1 align-middle print:border-black">
                              {item.image && <img src={item.image} className="h-8 w-8 object-cover mx-auto rounded" />}
                            </td>
                            <td rowSpan={2} className="border p-0 relative w-14 bg-yellow-50 align-middle print:border-black">
                              <input type="number" className="w-full h-full text-center border-none bg-transparent font-bold text-base print:hidden" value={typeof item.targetPerHour === 'object' ? '' : (item.targetPerHour || '')} placeholder="0" disabled={!canEditMaster} onChange={(e) => handleDirectUpdate(item.id, 'targetPerHour', null, Number(e.target.value))} />
                              <span className="print-value hidden text-center font-bold text-xs w-full px-1">{renderSafe(item.targetPerHour || 0)}</span>
                            </td>
                            <td className="border p-1 font-bold bg-blue-100 text-[10px] print:border-black">LINE<br /><span className="text-xs">行號</span></td>
                            {TIME_SLOTS.map(t => (
                              <td key={`L-${t}`} className={`border p-0 relative h-9 w-10 print:border-black ${isLocked ? 'bg-gray-200' : ''}`}>
                                <div className="relative w-full h-full flex items-center justify-center">
                                  <input type="number" disabled={isReadOnly || isLocked} className="w-full h-full text-center border-none bg-transparent font-bold text-base focus:bg-blue-100 disabled:cursor-not-allowed pb-2 print:hidden" value={(item.hourlyDataLine && item.hourlyDataLine[t]) || ''} placeholder={isLocked ? "Wait" : "-"} onChange={(e) => handleDirectUpdate(item.id, 'hourlyDataLine', t, Number(e.target.value))} />
                                  <span className="print-value hidden font-bold text-xs">{renderSafe((item.hourlyDataLine && item.hourlyDataLine[t]) || '')}</span>
                                  <div className="absolute bottom-0.5 right-0.5 text-[7px] text-gray-400 font-mono leading-none bg-white/80 px-0.5 rounded print:hidden pointer-events-none">{renderSafe(item.hourlyUpdatesLine?.[t] || '')}</div>
                                </div>
                              </td>
                            ))}
                            <td className="border p-1 font-bold bg-green-50 text-base print:border-black">{renderSafe(item.calcTotalLine)}</td>
                            <td className={`border p-1 font-bold print:border-black ${balLine <= 0 ? 'text-green-600 bg-green-50' : 'text-red-600'}`}>{balLine <= 0 ? '✓ DONE' : renderSafe(balLine)}</td>
                            <td rowSpan={2} className="border p-1 align-middle print:border-black">{renderSafe(item.lineWorkers)}</td>
                            <td rowSpan={2} className="border p-1 text-[10px] align-middle print:border-black">{renderSafe(item.headName)}</td>
                            {canEditMaster && (
                              <td rowSpan={2} className="border p-1 align-middle print:hidden">
                                <button onClick={() => handleCloseDay(item)} className="text-teal-600 bg-teal-100 p-1 rounded hover:bg-teal-200" title="Tutup Hari & Reset"><RefreshCw size={14} /></button>
                              </td>
                            )}
                          </tr>
                          <tr className="h-10 bg-gray-50 border-b-2 border-black hover:bg-gray-100 print:break-inside-avoid">
                            <td className="border p-1 font-bold bg-gray-200 text-[10px] print:border-black">PAC<br /><span className="text-xs">打包</span></td>
                            {TIME_SLOTS.map(t => (
                              <td key={`P-${t}`} className={`border p-0 relative h-9 w-10 print:border-black ${isLocked ? 'bg-gray-200' : ''}`}>
                                <div className="relative w-full h-full flex items-center justify-center">
                                  <input type="number" disabled={isReadOnly || isLocked} className="w-full h-full text-center border-none bg-transparent font-bold text-base focus:bg-gray-300 disabled:cursor-not-allowed pb-2 print:hidden" value={(item.hourlyDataPac && item.hourlyDataPac[t]) || ''} placeholder={isLocked ? "Wait" : "-"} onChange={(e) => handleDirectUpdate(item.id, 'hourlyDataPac', t, Number(e.target.value))} />
                                  <span className="print-value hidden font-bold text-xs">{renderSafe((item.hourlyDataPac && item.hourlyDataPac[t]) || '')}</span>
                                  <div className="absolute bottom-0.5 right-0.5 text-[7px] text-gray-500 font-mono leading-none bg-white/80 px-0.5 rounded print:hidden pointer-events-none">{renderSafe(item.hourlyUpdatesPac?.[t] || '')}</div>
                                </div>
                              </td>
                            ))}
                            <td className="border p-1 font-bold bg-green-100 text-base print:border-black">{renderSafe(item.calcTotalPac)}</td>
                            <td className={`border p-1 font-bold print:border-black ${balPac <= 0 ? 'text-green-600 bg-green-50' : 'text-red-600'}`}>{balPac <= 0 ? '✓ DONE' : renderSafe(balPac)}</td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* FOOTER / VIDEO / BEST EMPLOYEE */}
            <div className="bg-slate-800 text-white p-8 mt-8 print:hidden">
              <div className="max-w-4xl mx-auto text-center">
                <h2 className="text-2xl font-bold mb-6 flex items-center justify-center gap-2">
                  <img src="/logo-removebg-preview.png" alt="logo" className="h-13 w-auto object-contain bg-white rounded p-1" />
                </h2>
                <div className="relative w-full pb-[56.25%] bg-black rounded-xl overflow-hidden shadow-2xl border-4 border-slate-700">
                  <video className="absolute top-0 left-0 w-full h-full object-cover" src={getVideoSource(filterLine)} autoPlay loop muted playsInline key={filterLine}>Browser Anda tidak mendukung tag video.</video>
                </div>
                <p className="mt-4 text-slate-400 text-sm">PT Sitoy Leather Products Indonesia - Committed to Quality & Excellence</p>
              </div>

              {(filteredBestEmployees.length > 0 || filteredBestEmpImages.length > 0 || canManageUsers) && (
                <div className="max-w-5xl mx-auto mt-10">
                  <div className="rounded-2xl overflow-hidden border-2 border-yellow-500 shadow-2xl bg-slate-900">
                    <div className="bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 px-6 py-4 flex items-center justify-between">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-slate-900 font-black text-lg tracking-widest">
                          {bestEmpDisplayMode === 'image' ? (filteredBestEmpImages[0]?.month || '') : (filteredBestEmployees[0]?.month || new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))}
                        </span>
                        {filterLine === 'ALL' && (
                          <div className="flex gap-1">
                            {['ALL', 'HB1', 'HB2'].map(b => (
                              <button key={b} onClick={() => setBestEmpBuildingFilter(b)} className={`text-[10px] px-2 py-0.5 rounded font-black transition-all border ${bestEmpBuildingFilter === b ? 'bg-slate-900 text-yellow-400 border-slate-900' : 'bg-yellow-200 text-slate-700 border-yellow-300 hover:bg-yellow-100'}`}>
                                {b === 'ALL' ? 'SEMUA' : b}
                              </button>
                            ))}
                          </div>
                        )}
                        {canManageUsers && (
                          <div className="flex rounded overflow-hidden border border-slate-900/30 w-fit mt-0.5">
                            <button onClick={() => setBestEmpDisplayMode('card')} className={`px-2 py-0.5 text-[10px] font-black transition-all ${bestEmpDisplayMode === 'card' ? 'bg-slate-900 text-yellow-400' : 'bg-yellow-200 text-slate-700 hover:bg-yellow-300'}`}>🃏 KARTU</button>
                            <button onClick={() => setBestEmpDisplayMode('image')} className={`px-2 py-0.5 text-[10px] font-black transition-all ${bestEmpDisplayMode === 'image' ? 'bg-slate-900 text-yellow-400' : 'bg-yellow-200 text-slate-700 hover:bg-yellow-300'}`}>🖼️ GAMBAR</button>
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <div className="text-slate-900 text-3xl font-black tracking-[0.35em]">優 秀 員 工</div>
                        <div className="text-slate-800 text-xs font-bold tracking-widest mt-0.5">BEST EMPLOYEE OF THE MONTH</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Award className="text-slate-900 h-10 w-10 opacity-70" />
                        {canManageUsers && bestEmpDisplayMode === 'image' && (
                          <label className="cursor-pointer bg-slate-900 text-yellow-400 text-[10px] font-black px-2 py-1 rounded flex items-center gap-1 hover:bg-slate-700 transition-all">
                            <Upload size={12} /> UPLOAD GAMBAR/PDF
                            <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleBestEmpImageDocUpload} />
                          </label>
                        )}
                      </div>
                    </div>

                    {bestEmpDisplayMode === 'card' && (
                      <div className="p-5 grid grid-cols-6 gap-3">
                        {filteredBestEmployees.slice(0, 12).map((emp: any, idx: number) => {
                          const medalColors = ['border-yellow-400 shadow-yellow-400/40', 'border-gray-300 shadow-gray-400/40', 'border-amber-600 shadow-amber-600/40'];
                          const rankBg = ['bg-yellow-400', 'bg-gray-300', 'bg-amber-600'];
                          const rankText = ['text-slate-900', 'text-slate-700', 'text-white'];
                          return (
                            <div key={emp.id} className={`rounded-xl overflow-hidden border-2 shadow-lg ${idx < 3 ? medalColors[idx] : 'border-slate-600'} bg-slate-800 flex flex-col group`}>
                              <div className="relative h-28 bg-slate-700 overflow-hidden">
                                {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover object-top" alt={emp.name} /> : <div className="w-full h-full flex items-center justify-center text-3xl font-black text-slate-500">{(emp.name || '?')[0]}</div>}
                                {idx < 3 && <div className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-lg ${rankBg[idx]} ${rankText[idx]}`}>{idx + 1}</div>}
                                <div className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-black ${(emp.building || 'HB1') === 'HB1' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'}`}>{emp.building || 'HB1'}</div>
                                {canManageUsers && (
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 items-center justify-center">
                                    <button onClick={() => handleEditBestEmp(emp)} className="bg-blue-500 text-white p-1.5 rounded text-xs"><Edit2 size={12} /></button>
                                    <button onClick={() => handleDeleteBestEmp(emp.id)} className="bg-red-500 text-white p-1.5 rounded text-xs"><Trash2 size={12} /></button>
                                  </div>
                                )}
                              </div>
                              <div className="p-2 flex-1">
                                <p className="text-yellow-400 text-[8px] font-mono">{renderSafe(emp.emp_id)}</p>
                                <p className="text-white text-[10px] font-bold leading-tight truncate">{renderSafe(emp.name)}</p>
                                <p className="text-blue-300 text-[8px] truncate">{renderSafe(emp.dept)}</p>
                                <p className="text-slate-400 text-[8px] truncate">{renderSafe(emp.position_cn || emp.position)}</p>
                                <div className="flex justify-between mt-1.5 border-t border-slate-600 pt-1">
                                  <span className="text-[8px] text-slate-400">考勤:<b className="text-white ml-0.5">{renderSafe(emp.attendance)}</b></span>
                                  <span className="text-[8px] text-slate-400">績效:<b className="text-yellow-400 ml-0.5">{renderSafe(emp.performance)}</b></span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {filteredBestEmployees.length === 0 && <div className="col-span-6 py-10 text-center text-slate-500 text-sm">Belum ada data karyawan.</div>}
                      </div>
                    )}

                    {bestEmpDisplayMode === 'image' && (
                      <div className="p-4">
                        {filteredBestEmpImages.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <div className="text-slate-500 text-center">
                              <p className="text-4xl mb-3">🖼️</p>
                              <p className="text-sm font-bold">Belum ada gambar/PDF diupload</p>
                            </div>
                            {canManageUsers && (
                              <label className="cursor-pointer bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-lg">
                                <Upload size={18} /> UPLOAD SEKARANG
                                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleBestEmpImageDocUpload} />
                              </label>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {filteredBestEmpImages.map((imgDoc: any) => (
                              <div key={imgDoc.id} className="relative group rounded-xl overflow-hidden border border-slate-700 shadow-xl">
                                {imgDoc.type === 'pdf' ? <iframe src={imgDoc.imageData} className="w-full rounded-xl" style={{ height: '600px' }} title="Best Employee PDF" /> : <img src={imgDoc.imageData} alt="Best Employee" className="w-full rounded-xl object-contain bg-white" />}
                                {canManageUsers && (
                                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button onClick={() => handleDeleteBestEmpImageDoc(imgDoc.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-lg flex items-center gap-1"><Trash2 size={12} /> HAPUS</button>
                                  </div>
                                )}
                                <div className={`absolute top-2 left-2 px-2 py-0.5 rounded font-black text-xs ${(imgDoc.building || 'HB1') === 'HB1' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}`}>{imgDoc.building || 'HB1'}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* === MATERIAL TAB === */}
        {activeTab === 'MATERIAL' && (
          <div className="space-y-6">
            {appUser?.role !== 'VIEWER' && (
              <div className="bg-white rounded border-2 border-indigo-200 shadow-md overflow-hidden print-hidden">
                <div className="bg-indigo-800 text-white px-3 py-2 font-bold text-sm flex justify-between items-center">
                  <span className="flex items-center gap-2"><ShoppingCart size={16} /> SEWING MATERIAL RETRIEVAL SCHEDULE</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-indigo-50 text-indigo-900 border-b border-indigo-200 text-center">
                      <tr>
                        <th className="p-2 border-r">WO INFO</th>
                        <th className="p-2 border-r" colSpan={2}>MATERIAL SOURCE (QTY)</th>
                        <th className="p-2">KETERANGAN / REMARKS</th>
                      </tr>
                      <tr className="bg-indigo-100">
                        <th className="p-2 border-r w-48">Line / WO / Style / <span className="text-red-600">Order Qty</span></th>
                        <th className="p-2 border-r w-32">Ambil dari SPM (Auto)</th>
                        <th className="p-2 border-r w-32">Ambil dari PREP (Manual)</th>
                        <th className="p-2 min-w-[300px]">Catatan / Form Reject</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredData.map((item: any) => {
                        const mData = item.materialData || {};
                        const sch = item.sewingMaterialSchedule || { takenFromSPM: 0, takenFromPrep: 0, remarks: '' };
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="p-2 align-top border-r">
                              <div className="font-bold text-blue-900">{item.lineId}</div>
                              <div className="font-mono text-xs">{item.workOrder}</div>
                              <div className="text-[10px] text-gray-500">{item.style}</div>
                              <div className="text-xs font-bold bg-yellow-100 px-1 rounded w-fit mt-1">Qty: {item.orderQty}</div>
                            </td>
                            <td className="p-2 align-top border-r text-center bg-gray-100">
                              <input type="number" disabled className="w-full border rounded p-1 text-center font-bold bg-gray-200 text-gray-600 cursor-not-allowed" value={sch.takenFromSPM || 0} />
                              <div className="text-[8px] text-gray-400 mt-1">Dikirim oleh SPM</div>
                            </td>
                            <td className="p-2 align-top border-r text-center bg-indigo-50">
                              <input type="number" disabled={isReadOnly} className="w-full border rounded p-1 text-center font-bold" value={sch.takenFromPrep || 0} onChange={(e) => updateSewingSchedule(item.id, 'takenFromPrep', Number(e.target.value), sch)} />
                              <div className="text-[8px] text-gray-400 mt-1">Kirim Langsung</div>
                            </td>
                            <td className="p-2 align-top bg-gray-50">
                              <div className="flex gap-2 mb-2">
                                <input type="text" disabled={isReadOnly} placeholder="Catatan..." className="w-full border rounded p-1 text-xs" value={sch.remarks || ''} onChange={(e) => updateSewingSchedule(item.id, 'remarks', e.target.value, sch)} />
                                <button onClick={() => updateSewingSchedule(item.id, 'remarks', sch.remarks, sch)} className="bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"><Save size={14} /></button>
                              </div>
                              {!isReadOnly && (
                                <div className="bg-red-50 p-1.5 rounded border border-red-200 mt-1 shadow-sm">
                                  <span className="text-[9px] font-bold text-red-700 flex items-center gap-1 mb-1.5"><AlertTriangle size={10} /> REJECT KEMBALI KE PREP:</span>
                                  <div className="flex gap-1.5 items-center">
                                    <input type="number" id={`rej-qty-${item.id}`} className="w-16 border rounded px-1.5 py-1 text-[10px]" placeholder="Qty Reject" />
                                    <select id={`rej-dest-${item.id}`} className="w-24 border rounded px-1 py-1 text-[10px] bg-white text-gray-700 uppercase">
                                      {PREP_STAGES.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    <input type="text" id={`rej-rmk-${item.id}`} className="flex-1 border rounded px-1.5 py-1 text-[10px]" placeholder="Alasan reject..." />
                                    <button onClick={() => processLineReject(item)} className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded text-[10px] font-bold shadow-sm">REJECT</button>
                                  </div>
                                  {(mData.lineRejects || []).length > 0 && (
                                    <div className="mt-2 space-y-1 max-h-20 overflow-y-auto pr-1">
                                      {(mData.lineRejects || []).map((r: any) => (
                                        <div key={r.id} className={`text-[9px] bg-white border p-1 flex justify-between rounded items-center ${r.status === 'PENDING' ? 'border-red-300' : 'border-green-200'}`}>
                                          <div className="flex items-center gap-2 w-3/4">
                                            <span className="text-red-600 font-bold bg-red-100 px-1 rounded">-{r.qty} ke {r.destPrep}</span>
                                            <span className="text-gray-600 truncate flex-1 italic">"{r.remarks}"</span>
                                          </div>
                                          <span className={`font-bold px-1 rounded ${r.status === 'PENDING' ? 'text-orange-600 bg-orange-100' : 'text-green-600 bg-green-100'}`}>
                                            {r.status === 'PENDING' ? 'WAITING PREP' : 'SENT TO CUT'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-white shadow rounded-sm border border-orange-200 overflow-hidden">
              <div className="bg-orange-800 text-white px-3 py-2 font-bold text-sm flex items-center justify-between">
                <span className="flex items-center gap-2"><Layers size={18} /> MATERIAL CONTROL FLOW (CUTTING - PREP - SUPERMARKET)</span>
                <button onClick={handleExportExcel} className="bg-white text-green-700 px-3 py-1 rounded text-xs font-bold flex items-center gap-1 hover:bg-green-100 shadow-sm border border-green-200"><FileSpreadsheet size={16} /> EXPORT EXCEL</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-orange-50 text-orange-900 font-bold border-b border-orange-200">
                    <tr>
                      <th className="p-1 border-r border-orange-200 w-48 text-left">WO Detail</th>
                      <th className="p-1 border-r border-orange-200 bg-red-50 w-64"><div className="flex items-center justify-center gap-1"><Scissors size={14} /> CUTTING</div></th>
                      <th className="p-1 border-r border-orange-200 bg-indigo-50 min-w-[500px]"><div className="flex items-center justify-center gap-1"><Layers size={14} /> PREPARATION & TRANSFER</div></th>
                      <th className="p-1 bg-teal-50 text-center"><div className="flex items-center justify-center gap-1"><ShoppingCart size={14} /> SUPERMARKET (SPM)</div></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredData.map((item: any) => {
                      const mData = item.materialData || { cuttingHistory: [], prep: {}, supermarket: 0, recutRequests: [], lineRejects: [], scrapTotal: 0 };
                      const sch = item.sewingMaterialSchedule || { takenFromSPM: 0 };
                      const totalCut = mData.cuttingHistory ? mData.cuttingHistory.reduce((acc: number, curr: any) => acc + (Number(curr.qty) || 0), 0) : 0;
                      const currentSent = Number(sch.takenFromSPM) || 0;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50 align-top">
                          <td className="p-1 border-r border-orange-100">
                            <div className="font-bold text-blue-900">{item.workOrder}</div>
                            <div className="text-[10px] text-gray-500">{item.style} - {item.color}</div>
                            <div className="mt-1 text-[10px] font-semibold bg-gray-100 px-1 rounded w-fit">Order: {item.orderQty}</div>
                          </td>
                          <td className="p-1 border-r border-orange-100 bg-red-50/30">
                            <div className="mb-2 flex justify-between items-center bg-white p-2 rounded border border-red-200 shadow-sm">
                              <span className="text-[10px] text-gray-500 font-bold">Total Actual Cutting:</span>
                              <span className="font-bold text-xl text-green-600">{totalCut}</span>
                            </div>
                            {!isReadOnly && (
                              <div className="flex gap-1 mb-2 bg-white p-1 rounded border border-red-200">
                                <input type="number" placeholder="Input Actual" className="w-full border rounded px-1 py-1 text-xs" id={`cut-${item.id}`} />
                                <button onClick={() => {
                                  const el = document.getElementById(`cut-${item.id}`) as HTMLInputElement;
                                  if (el && el.value) { updateMaterialData(item.id, 'cutting', null, el.value, item.workOrder, item.lineId); el.value = ''; }
                                }} className="bg-red-600 text-white px-3 rounded hover:bg-red-700 text-[10px] font-bold">ADD</button>
                              </div>
                            )}
                            <div className="max-h-32 overflow-y-auto space-y-1 mb-2 border-b border-red-200 pb-2">
                              {mData.cuttingHistory && mData.cuttingHistory.map((h: any, idx: number) => (
                                <div key={idx} className={`flex justify-between items-center text-[10px] bg-white px-1 py-0.5 rounded shadow-sm border ${h.isRecut ? 'border-yellow-300 bg-yellow-50' : 'border-red-100'}`}>
                                  <span>{h.date} <i className="text-gray-400">({h.user})</i></span>
                                  <span className={`font-bold ${h.isRecut ? 'text-yellow-600' : 'text-red-600'}`}>+{h.qty} {h.isRecut && '(R)'}</span>
                                </div>
                              ))}
                            </div>
                            {(mData.recutRequests || []).filter((r: any) => r.status === 'PENDING').map((req: any) => (
                              <div key={req.id} className={`${req.isLineReject ? 'bg-red-50 border-red-400' : 'bg-yellow-50 border-yellow-300'} border p-1.5 rounded mb-2 text-[10px] shadow-sm`}>
                                <div className={`font-bold ${req.isLineReject ? 'text-red-800' : 'text-yellow-800'} flex justify-between items-center border-b pb-1 mb-1`}>
                                  <span className="flex items-center gap-1">{req.isLineReject ? <><AlertTriangle size={10} /> REJECT LINE</> : '🚨 REQUEST RECUT'}</span>
                                  <span className="px-1 rounded uppercase">Dr: {req.from}</span>
                                </div>
                                <div className="mb-1 text-gray-700">Req Qty: <b className="text-red-600">{req.qty}</b> | Rmk: <i>{req.remarks}</i></div>
                                <div className="flex gap-1 items-center bg-white p-1 rounded border">
                                  <input type="number" id={`recut-ok-${req.id}`} placeholder="Recut OK" className="w-full border rounded p-1 text-center text-green-700 font-bold" />
                                  <input type="number" id={`recut-scrap-${req.id}`} placeholder="Scrap" className="w-full border rounded p-1 text-center text-red-700 font-bold" />
                                  <button onClick={() => {
                                    const elOk = document.getElementById(`recut-ok-${req.id}`) as HTMLInputElement;
                                    const elScrap = document.getElementById(`recut-scrap-${req.id}`) as HTMLInputElement;
                                    handleProcessRecut(item, req.id, elOk?.value || 0, elScrap?.value || 0);
                                  }} className={`${req.isLineReject ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'} text-white px-2 py-1 rounded font-bold transition`}>PROSES</button>
                                </div>
                              </div>
                            ))}
                            <div className="mt-2 bg-white p-1.5 border border-red-200 rounded flex justify-between items-center shadow-sm">
                              <span className="font-bold text-[10px] text-gray-600">Total Scrap / Reject:</span>
                              <span className="font-black text-red-600 text-sm">{mData.scrapTotal || 0}</span>
                            </div>
                          </td>
                          <td className="p-1 border-r border-orange-100 bg-indigo-50/30 align-top">
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              {PREP_STAGES.map(proc => {
                                const currentVal = Number(mData.prep[proc]) || 0;
                                const pendingRejects = (mData.lineRejects || []).filter((r: any) => r.destPrep === proc && r.status === 'PENDING');
                                return (
                                  <div key={proc} className="bg-white p-1.5 rounded border border-indigo-200 shadow-sm relative">
                                    <div className="flex justify-between items-center mb-1.5 border-b border-gray-100 pb-1">
                                      <span className="capitalize text-indigo-900 font-bold flex items-center gap-1"><Layers size={10} /> {proc}</span>
                                      <span className="font-black text-indigo-600 text-lg">{currentVal}</span>
                                    </div>
                                    {pendingRejects.length > 0 && (
                                      <div className="mb-2 bg-red-50 border-2 border-red-300 p-1 rounded shadow-inner">
                                        <span className="text-[8px] font-black text-red-800 flex items-center gap-1 mb-1"><AlertTriangle size={10} /> LINE REJECT!</span>
                                        {pendingRejects.map((rej: any) => (
                                          <div key={rej.id} className="text-[9px] bg-white border border-red-200 p-1 mb-1 rounded shadow-sm">
                                            <div className="flex justify-between items-center mb-0.5">
                                              <span className="font-black text-red-600 bg-red-100 px-1 rounded">{rej.qty} pcs</span>
                                              {!isReadOnly && <button onClick={() => forwardRejectToCutting(item, rej.id)} className="bg-red-600 hover:bg-red-700 text-white px-1.5 py-0.5 rounded text-[8px] font-bold shadow-sm">KIRIM CUTTING</button>}
                                            </div>
                                            <div className="text-gray-700 italic truncate w-[140px]">"{rej.remarks}"</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {!isReadOnly && (
                                      <div className="flex flex-col gap-1.5">
                                        <div className="flex gap-1">
                                          <input type="number" className="w-full border rounded px-1 py-1 text-[10px]" placeholder="Tambah Actual" id={`prep-${proc}-${item.id}`} />
                                          <button onClick={() => {
                                            const el = document.getElementById(`prep-${proc}-${item.id}`) as HTMLInputElement;
                                            if (el && el.value) { updateMaterialData(item.id, 'prep', proc, el.value, item.workOrder, item.lineId); el.value = ''; }
                                          }} className="bg-indigo-600 text-white px-2 rounded hover:bg-indigo-700 font-bold text-[10px]"><Plus size={12} /></button>
                                        </div>
                                        <div className="bg-indigo-50 border border-indigo-100 p-1 rounded">
                                          <span className="text-[8px] font-bold text-indigo-800 flex items-center gap-1 mb-0.5"><CornerDownRight size={10} /> TRANSFER / RECUT:</span>
                                          <select id={`dest-${proc}-${item.id}`} className="w-full border rounded px-1 py-1 mb-1 text-[9px] bg-white text-gray-700">
                                            <option value="LINE">Kirim ke LINE</option>
                                            <option value="SPM">Kirim ke SPM</option>
                                            <option value="RECUT">RECUT (Kembali ke Cutting)</option>
                                            <optgroup label="Transfer antar Prep:">
                                              {PREP_STAGES.filter(p => p !== proc).map(p => <option key={p} value={p}>Ke: {p}</option>)}
                                            </optgroup>
                                          </select>
                                          <div className="flex gap-1">
                                            <input type="number" id={`qty-${proc}-${item.id}`} className="w-10 border rounded px-1 py-0.5 text-[9px]" placeholder="Qty" />
                                            <input type="text" id={`rmk-${proc}-${item.id}`} className="flex-1 border rounded px-1 py-0.5 text-[9px]" placeholder="Remarks" />
                                            <button onClick={() => {
                                              const destEl = document.getElementById(`dest-${proc}-${item.id}`) as HTMLSelectElement;
                                              const qtyEl = document.getElementById(`qty-${proc}-${item.id}`) as HTMLInputElement;
                                              const rmkEl = document.getElementById(`rmk-${proc}-${item.id}`) as HTMLInputElement;
                                              if (qtyEl && qtyEl.value && destEl) {
                                                handlePrepTransfer(item, proc, destEl.value, qtyEl.value, rmkEl?.value || '');
                                                qtyEl.value = ''; if (rmkEl) rmkEl.value = '';
                                              }
                                            }} className="bg-orange-500 hover:bg-orange-600 text-white px-1.5 py-0.5 rounded font-bold text-[9px]">GO</button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          <td className="p-1 bg-teal-50/20 text-center align-top">
                            <div className="bg-white border border-teal-200 p-2 rounded shadow-sm mb-2">
                              <div className="text-[10px] text-gray-500 font-bold mb-1">STOK SUPERMARKET:</div>
                              <div className="text-2xl font-bold text-teal-700">{mData.supermarket || 0}</div>
                            </div>
                            <div className="bg-white border border-blue-200 p-2 rounded shadow-sm">
                              <div className="text-[10px] text-gray-500 font-bold mb-1">SUDAH DIKIRIM KE LINE:</div>
                              <div className="text-xl font-bold text-blue-700">{currentSent}</div>
                            </div>
                            {!isReadOnly && (
                              <div className="mt-2 pt-2 border-t border-teal-200 flex flex-col gap-1 items-center bg-white p-1.5 rounded shadow-sm">
                                <span className="text-[9px] text-teal-800 font-bold">KIRIM DARI SPM KE LINE:</span>
                                <div className="flex gap-1 w-full">
                                  <input type="number" id={`spm-send-${item.id}`} className="w-full border rounded text-xs p-1 text-center" placeholder="Qty" />
                                  <button onClick={() => {
                                    const el = document.getElementById(`spm-send-${item.id}`) as HTMLInputElement;
                                    if (el && el.value) { sendSPMToLine(item, el.value); el.value = ''; }
                                  }} className="bg-teal-600 text-white px-3 rounded text-[10px] font-bold"><Send size={14} /></button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* === WO STATUS TAB === */}
        {activeTab === 'WO_STATUS' && (
            <div className="space-y-4">
                {/* HEADER & SEARCH */}
                <div className="bg-white rounded shadow border border-purple-200 overflow-hidden">
                    <div className="bg-purple-800 text-white px-3 py-2 font-bold text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2"><FileText size={16} /> WORK ORDER STATUS</span>
                        <div className="flex gap-2 items-center">
                            <input
                                type="text"
                                placeholder="Cari WO / Style / Customer..."
                                value={woStatusSearch}
                                onChange={e => setWoStatusSearch(e.target.value)}
                                className="border rounded px-2 py-1 text-xs text-gray-800 w-52"
                            />
                            <button onClick={loadWoStatus} className="bg-white text-purple-800 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 hover:bg-purple-100">
                                <RefreshCw size={12} /> Refresh
                            </button>
                        </div>
                    </div>
                    {/* TABLE */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead className="bg-purple-50 text-purple-900 font-bold border-b border-purple-200">
                                <tr>
                                    <th className="p-2 border-r text-left">WO / Customer</th>
                                    <th className="p-2 border-r text-center">Style / Color</th>
                                    <th className="p-2 border-r text-center">Line</th>
                                    <th className="p-2 border-r text-center">Order Qty</th>
                                    <th className="p-2 border-r text-center">Total Cutting</th>
                                    <th className="p-2 border-r text-center">Total LINE</th>
                                    <th className="p-2 border-r text-center">Total PAC</th>
                                    <th className="p-2 border-r text-center">Audit</th>
                                    <th className="p-2 border-r text-center">STATUS</th>
                                    <th className="p-2 text-center">AKSI</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {woStatusList.map((wo: any) => (
                                    <tr key={wo.id} className="hover:bg-purple-50">
                                        <td className="p-2 border-r">
                                            <div className="font-bold text-blue-900 font-mono">{wo.workOrder}</div>
                                            <div className="text-[10px] text-gray-500">{wo.customer}</div>
                                        </td>
                                        <td className="p-2 border-r text-center">
                                            <div className="font-bold">{wo.style}</div>
                                            <div className="text-[10px] text-gray-500">{wo.color}</div>
                                        </td>
                                        <td className="p-2 border-r text-center font-bold text-blue-900">
                                            {wo.lineId}
                                            {wo.lineAssignments?.length > 1 && (
                                                <div className="text-[9px] text-orange-600 font-black">+{wo.lineAssignments.length - 1} line</div>
                                            )}
                                        </td>
                                        <td className="p-2 border-r text-center font-bold">{wo.orderQty}</td>
                                        <td className="p-2 border-r text-center font-bold text-red-600">{wo.totalCutting}</td>
                                        <td className="p-2 border-r text-center font-bold text-blue-600">{wo.totalLine}</td>
                                        <td className="p-2 border-r text-center font-bold text-green-600">{wo.totalPac}</td>
                                        <td className="p-2 border-r text-center">
                                            {wo.auditIssues?.length > 0 ? (
                                                <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 justify-center">
                                                    <AlertTriangle size={10} /> {wo.auditIssues.join(', ')}
                                                </span>
                                            ) : (
                                                <span className="text-green-600 text-[10px] font-bold">✅ OK</span>
                                            )}
                                        </td>
                                        <td className="p-2 border-r text-center">{getStatusBadge(wo.woStatus)}</td>
                                        <td className="p-2 text-center">
                                            <div className="flex gap-1 justify-center flex-wrap">
                                                <button
                                                    onClick={() => openWoDetail(wo.workOrder)}
                                                    className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-[10px] font-bold"
                                                >DETAIL</button>
                                                {canEditMaster && wo.woStatus !== 'DONE' && (
                                                    <>
                                                        <button
                                                            onClick={() => { setSelectedWoForAction(wo); setSplitForm({ newLineId: LINES[0], targetQty: 0, remarks: '' }); setIsSplitOpen(true); }}
                                                            className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-[10px] font-bold"
                                                        >SPLIT</button>
                                                        <button
                                                            onClick={() => { setSelectedWoForAction(wo); setTransferForm({ newLineId: LINES[0], remarks: '' }); setIsTransferOpen(true); }}
                                                            className="bg-teal-600 hover:bg-teal-700 text-white px-2 py-1 rounded text-[10px] font-bold"
                                                        >TRANSFER</button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {woStatusList.length === 0 && (
                                    <tr><td colSpan={10} className="p-8 text-center text-gray-400 font-bold">Tidak ada data WO.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* ── MODAL: INPUT / EDIT ── */}
      {isModalOpen && canEditMaster && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded w-full max-w-2xl border-2 border-blue-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-blue-900 text-white p-3 flex justify-between items-center shrink-0">
              <h2 className="font-bold">INPUT DATA MASTER</h2>
              <button onClick={resetForm} className="hover:text-red-300"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Line / 行號</label>
                  <select className="w-full border p-2 rounded text-base" value={formData.lineId} onChange={(e) => setFormData({ ...formData, lineId: e.target.value })}>
                    {LINES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <Input label="Customer / 客户" value={formData.customer} onChange={(e) => setFormData({ ...formData, customer: e.target.value })} />
                <Input label="Sitoy PO / 合同号" value={formData.sitoyPo} onChange={(e) => setFormData({ ...formData, sitoyPo: e.target.value })} />
                <Input label="Work Order / 工单号" value={formData.workOrder} onChange={(e) => setFormData({ ...formData, workOrder: e.target.value })} required />
                <Input label="Style / 款号" value={formData.style} onChange={(e) => setFormData({ ...formData, style: e.target.value })} />
                <Input label="Color / 颜色" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
                <div className="col-span-2 border-dashed border-2 p-3 rounded bg-gray-50 flex flex-col items-center justify-center">
                  <label className="text-xs font-bold uppercase mb-2">Gambar / 图片</label>
                  {formData.image
                    ? <div className="relative"><img src={formData.image} className="h-20 rounded border" /><button type="button" onClick={() => setFormData({ ...formData, image: '' })} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X size={14} /></button></div>
                    : <label className="cursor-pointer text-blue-600"><Upload size={24} /><input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} /></label>
                  }
                </div>
                <div className="bg-yellow-50 p-2 border rounded col-span-1">
                  <label className="block text-xs font-bold uppercase">Order Qty / 订单数</label>
                  <input type="number" className="w-full border p-2 rounded font-bold text-lg" value={formData.orderQty} onChange={(e) => setFormData({ ...formData, orderQty: Number(e.target.value) })} required />
                </div>
                <div className="bg-green-50 p-2 border rounded col-span-1">
                  <label className="block text-xs font-bold uppercase">Finish Qty / 完成数</label>
                  <input type="number" className="w-full border p-2 rounded font-bold text-lg" value={formData.finishQty} onChange={(e) => setFormData({ ...formData, finishQty: Number(e.target.value) })} />
                </div>
                <div className="col-span-2 bg-gray-50 p-2 border rounded grid grid-cols-2 gap-3">
                  <Input label="Start Date / 开始" type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
                  <Input label="End Date / 结束" type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
                  <Input label="Ex-Fly Date / 出货期" type="date" value={formData.exFlyDate} onChange={(e) => setFormData({ ...formData, exFlyDate: e.target.value })} />
                  <Input label="Target Day / 日产量" type="number" value={formData.targetDay} onChange={(e) => setFormData({ ...formData, targetDay: Number(e.target.value) })} />
                </div>
                <Input label="Sample Approval / 确认办" value={formData.sampleApproval} onChange={(e) => setFormData({ ...formData, sampleApproval: e.target.value })} />
                <div className="bg-blue-50 p-2 border rounded col-span-2">
                  <label className="block text-xs font-bold uppercase text-blue-900">Target Per Jam / 每小时目标</label>
                  <input type="number" className="w-full border p-2 rounded font-bold text-blue-900 text-lg" value={formData.targetPerHour} onChange={(e) => setFormData({ ...formData, targetPerHour: Number(e.target.value) })} />
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-bold text-xs mb-3 flex items-center gap-1"><Activity size={14} /> MANPOWER</h3>
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded border">
                  <Input label="Total Workers / 总工人数" type="number" value={formData.lineWorkers} onChange={(e) => setFormData({ ...formData, lineWorkers: Number(e.target.value) })} />
                  <Input label="Head Name / 组长" value={formData.headName} onChange={(e) => setFormData({ ...formData, headName: e.target.value })} />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={resetForm} className="px-5 py-2 bg-gray-200 rounded text-sm font-bold">Batal</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-bold shadow">SIMPAN</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: RESUME ── */}
      {isReportOpen && canViewHistory && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
            <div className="bg-fuchsia-700 text-white p-4 flex justify-between items-center shrink-0">
              <h2 className="font-bold flex items-center gap-2"><BarChart2 size={20} /> EVALUASI & RESUME PRODUKSI</h2>
              <button onClick={() => setIsReportOpen(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={20} /></button>
            </div>
            <div className="bg-fuchsia-50 p-4 border-b shrink-0 flex flex-col sm:flex-row items-center gap-4 shadow-inner">
              <div className="flex bg-white rounded-lg border-2 border-fuchsia-200 overflow-hidden shadow-sm">
                <button onClick={() => handleReportTypeChange('month')} className={`px-4 py-1.5 text-xs font-bold transition-colors ${reportType === 'month' ? 'bg-fuchsia-600 text-white' : 'text-fuchsia-800 hover:bg-fuchsia-100'}`}>BULANAN</button>
                <button onClick={() => handleReportTypeChange('day')} className={`px-4 py-1.5 text-xs font-bold transition-colors ${reportType === 'day' ? 'bg-fuchsia-600 text-white' : 'text-fuchsia-800 hover:bg-fuchsia-100'}`}>HARIAN</button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-fuchsia-900">Pilih Tanggal:</label>
                <input type={reportType === 'month' ? 'month' : 'date'} value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="border-2 border-fuchsia-300 rounded px-3 py-1 font-bold text-fuchsia-900 focus:outline-none shadow-sm" />
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {['HB1', 'HB2'].map(bldg => {
                  const bStats = buildingStats[bldg];
                  if (!bStats || (bStats.output === 0 && bStats.wosDone === 0 && bStats.wosProgress === 0)) return null;
                  const effValue = bStats.target > 0 ? ((bStats.output / bStats.target) * 100).toFixed(1) : 0;
                  const bldgMaxLineOut = Math.max(...bStats.lineOutputs, 1);
                  return (
                    <div key={bldg} className="bg-white rounded-xl shadow-md p-5 border-t-4 border-indigo-600 flex flex-col">
                      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
                        <div><h3 className="text-xl font-black tracking-widest text-indigo-900">SUMMARY {bldg}</h3></div>
                        <div className="flex gap-4 text-right">
                          <div><p className="text-[10px] text-gray-400 font-bold uppercase">Output</p><p className="text-xl font-black text-green-600">{bStats.output}</p></div>
                          <div><p className="text-[10px] text-gray-400 font-bold uppercase">Target</p><p className="text-xl font-black text-blue-600">{bStats.target}</p></div>
                          <div><p className="text-[10px] text-gray-400 font-bold uppercase">Efisiensi</p><p className={`text-xl font-black ${Number(effValue) >= 90 ? 'text-green-600' : Number(effValue) >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>{effValue}%</p></div>
                        </div>
                      </div>
                      <div className="mt-auto pt-2 flex flex-col relative h-32">
                        <div className="relative flex-1 w-full mt-2">
                          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
                            <defs><linearGradient id={`grad-bldg-${bldg}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4f46e5" stopOpacity="0.3" /><stop offset="100%" stopColor="#4f46e5" stopOpacity="0" /></linearGradient></defs>
                            <path d={`M 0,40 L ${bStats.lineOutputs.map((val: number, i: number) => `${(i / 11) * 100},${40 - (bldgMaxLineOut > 0 ? (val / bldgMaxLineOut) * 40 : 0)}`).join(' L ')} L 100,40 Z`} fill={`url(#grad-bldg-${bldg})`} />
                            <path d={`M ${bStats.lineOutputs.map((val: number, i: number) => `${(i / 11) * 100},${40 - (bldgMaxLineOut > 0 ? (val / bldgMaxLineOut) * 40 : 0)}`).join(' L ')}`} fill="none" stroke="#4f46e5" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                          </svg>
                        </div>
                        <div className="flex justify-between w-full mt-3 px-1 text-[8px] text-gray-500 font-mono font-bold">
                          {Array.from({ length: 12 }).map((_, i) => <span key={i} className="w-full text-center">L{i + 1}</span>)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {LINES.map(line => {
                  const data = lineStats[line] as any;
                  if (!data || (data.output === 0 && data.wosDone === 0 && data.wosProgress === 0)) return null;
                  const efficiency = data.target > 0 ? ((data.output / data.target) * 100).toFixed(1) : 0;
                  const effValue = Number(efficiency);
                  const effColor = effValue >= 90 ? 'bg-green-500' : effValue >= 70 ? 'bg-yellow-500' : 'bg-red-500';
                  const maxHourly = Math.max(...data.hourlyTotals, 1);
                  return (
                    <div key={line} className="bg-white rounded-xl shadow p-4 border-t-4 border-fuchsia-500 flex flex-col">
                      <div className="flex justify-between items-center mb-3 border-b pb-2">
                        <h3 className="font-black text-lg text-gray-800">{line}</h3>
                        {reportType === 'month' && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-bold">{data.activeDays} Hari Aktif</span>}
                      </div>
                      <div className="flex justify-between mb-4">
                        <div className="text-center"><p className="text-[10px] text-gray-400 font-bold uppercase">Total Selesai</p><p className="text-xl font-black text-green-600">{data.output}</p></div>
                        <div className="text-center"><p className="text-[10px] text-gray-400 font-bold uppercase">Target</p><p className="text-xl font-black text-blue-600">{data.target}</p></div>
                        <div className="text-center flex flex-col items-center">
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Status WO</p>
                          <div className="flex gap-2 mt-1">
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">{data.wosDone} Done</span>
                            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold">{data.wosProgress} Prog</span>
                          </div>
                        </div>
                      </div>
                      <div className="mb-4">
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="text-gray-600">Efisiensi</span>
                          <span className={`${effValue >= 90 ? 'text-green-600' : effValue >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>{efficiency}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden flex"><div className={`h-2 ${effColor}`} style={{ width: `${Math.min(effValue, 100)}%` }}></div></div>
                      </div>
                      {data.missedMandatory > 0 && (
                        <div className="mb-3 bg-red-50 border border-red-200 rounded p-2 flex gap-2 items-start">
                          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-bold text-red-700">Audit Jam Wajib (J1-J7): Ada {data.missedMandatory} Data Kosong!</p>
                            <p className="text-[9px] text-red-500 mt-0.5">Detail: {Array.from(data.missedDetails as Set<string>).join(', ')}</p>
                          </div>
                        </div>
                      )}
                      <div className="mt-auto pt-3 border-t flex flex-col relative h-32">
                        <div className="relative flex-1 w-full mt-2">
                          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
                            <defs><linearGradient id={`grad-${line}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#d946ef" stopOpacity="0.4" /><stop offset="100%" stopColor="#d946ef" stopOpacity="0" /></linearGradient></defs>
                            <path d={`M 0,40 L ${data.hourlyTotals.map((val: number, i: number) => `${(i / 9) * 100},${40 - (maxHourly > 0 ? (val / maxHourly) * 40 : 0)}`).join(' L ')} L 100,40 Z`} fill={`url(#grad-${line})`} />
                            <path d={`M ${data.hourlyTotals.map((val: number, i: number) => `${(i / 9) * 100},${40 - (maxHourly > 0 ? (val / maxHourly) * 40 : 0)}`).join(' L ')}`} fill="none" stroke="#d946ef" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                          </svg>
                        </div>
                        <div className="flex justify-between w-full mt-2 px-1 text-[8px] text-gray-500 font-mono">
                          {TIME_SLOTS.map((_, i) => <span key={i}>J{i + 1}</span>)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BEST EMPLOYEE ── */}
      {isBestEmpModalOpen && canManageUsers && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`bg-white rounded-xl overflow-hidden shadow-2xl border-2 border-yellow-400 flex flex-col max-h-[92vh] ${bulkUploadMode ? 'w-full max-w-4xl' : 'w-full max-w-lg'}`}>
            <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 p-4 flex justify-between items-center shrink-0">
              <h2 className="font-black text-slate-900 flex items-center gap-2 text-lg"><Award size={20} /> BEST EMPLOYEE OF THE MONTH</h2>
              <div className="flex items-center gap-2">
                <div className="flex rounded overflow-hidden border-2 border-slate-900/30">
                  <button onClick={() => { setBulkUploadMode(false); setBulkPreview([]); setBulkError(''); }} className={`px-3 py-1 text-xs font-black transition-all ${!bulkUploadMode ? 'bg-slate-900 text-yellow-400' : 'bg-yellow-200 text-slate-700'}`}>✏️ MANUAL</button>
                  <button onClick={() => { setBulkUploadMode(true); setBulkPreview([]); setBulkError(''); }} className={`px-3 py-1 text-xs font-black transition-all ${bulkUploadMode ? 'bg-slate-900 text-yellow-400' : 'bg-yellow-200 text-slate-700'}`}>📤 BULK UPLOAD</button>
                </div>
                <button onClick={resetBestEmpForm} className="hover:bg-black/20 p-1 rounded-full"><X size={20} className="text-slate-900" /></button>
              </div>
            </div>
            {!bulkUploadMode && (
              <>
                <form onSubmit={handleSaveBestEmp} className="p-5 space-y-3 overflow-y-auto">
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-28 rounded-lg border-2 border-dashed border-gray-300 overflow-hidden bg-gray-100 flex items-center justify-center relative shrink-0">
                      {bestEmpForm.photo
                        ? <><img src={bestEmpForm.photo} className="w-full h-full object-cover object-top" /><button type="button" onClick={() => setBestEmpForm(p => ({ ...p, photo: '' }))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5"><X size={12} /></button></>
                        : <label className="cursor-pointer flex flex-col items-center text-gray-400 gap-1"><Camera size={24} /><span className="text-[10px] text-center">Upload Foto</span><input type="file" accept="image/*" className="hidden" onChange={handleBestEmpImageUpload} /></label>
                      }
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input label="Bulan / Periode" value={bestEmpForm.month} onChange={(e) => setBestEmpForm(p => ({ ...p, month: e.target.value }))} required />
                      <Input label="ID Karyawan" value={bestEmpForm.empId} onChange={(e) => setBestEmpForm(p => ({ ...p, empId: e.target.value }))} required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Gedung / Building</label>
                    <div className="flex gap-2">
                      {['HB1', 'HB2'].map(b => (
                        <button key={b} type="button" onClick={() => setBestEmpForm(p => ({ ...p, building: b }))} className={`flex-1 py-2 rounded font-black text-sm border-2 transition-all ${bestEmpForm.building === b ? (b === 'HB1' ? 'bg-blue-600 text-white border-blue-600' : 'bg-purple-600 text-white border-purple-600') : 'bg-white text-gray-500 border-gray-300'}`}>{b}</button>
                      ))}
                    </div>
                  </div>
                  <Input label="Nama Lengkap" value={bestEmpForm.name} onChange={(e) => setBestEmpForm(p => ({ ...p, name: e.target.value }))} required />
                  <Input label="Departemen" value={bestEmpForm.dept} onChange={(e) => setBestEmpForm(p => ({ ...p, dept: e.target.value }))} required />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Posisi (Indonesia)" value={bestEmpForm.position} onChange={(e) => setBestEmpForm(p => ({ ...p, position: e.target.value }))} />
                    <Input label="Posisi 中文" value={bestEmpForm.positionCn} onChange={(e) => setBestEmpForm(p => ({ ...p, positionCn: e.target.value }))} />
                    <Input label="Kehadiran (CardTime)" type="number" value={bestEmpForm.attendance} onChange={(e) => setBestEmpForm(p => ({ ...p, attendance: Number(e.target.value) }))} />
                    <Input label="Performa (Hours)" type="number" value={bestEmpForm.performance} onChange={(e) => setBestEmpForm(p => ({ ...p, performance: Number(e.target.value) }))} required />
                  </div>
                  <div className="pt-3 flex justify-end gap-2">
                    <button type="button" onClick={resetBestEmpForm} className="px-5 py-2 bg-gray-200 rounded font-bold text-sm">Batal</button>
                    <button type="submit" className={`px-5 py-2 rounded font-bold text-sm shadow text-white ${bestEmpForm.building === 'HB2' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{editingBestEmpId ? 'UPDATE' : 'SIMPAN'} ({bestEmpForm.building})</button>
                  </div>
                </form>
                {bestEmployees.length > 0 && (
                  <div className="border-t p-4 bg-gray-50 overflow-y-auto" style={{ maxHeight: '200px' }}>
                    <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Daftar Saat Ini ({bestEmployees.length} total)</p>
                    {['HB1', 'HB2'].map(building => {
                      const grouped = bestEmployees.filter((e: any) => (e.building || 'HB1') === building);
                      if (grouped.length === 0) return null;
                      return (
                        <div key={building} className="mb-3">
                          <p className={`text-[10px] font-black mb-1 px-1 py-0.5 rounded w-fit ${building === 'HB1' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{building} ({grouped.length}/12)</p>
                          <div className="space-y-1">
                            {grouped.map((emp: any, idx: number) => (
                              <div key={emp.id} className="flex items-center gap-2 bg-white rounded p-2 border text-xs shadow-sm">
                                {emp.photo ? <img src={emp.photo} className="w-8 h-8 rounded object-cover border shrink-0" /> : <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center font-bold text-gray-500 shrink-0">{(emp.name || '?')[0]}</div>}
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold truncate">{idx + 1}. {emp.emp_id} — {emp.name}</p>
                                  <p className="text-gray-400 truncate">{emp.dept} | 績效: {emp.performance}</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => handleEditBestEmp(emp)} className="text-blue-500 p-1 hover:bg-blue-100 rounded"><Edit2 size={12} /></button>
                                  <button onClick={() => handleDeleteBestEmp(emp.id)} className="text-red-500 p-1 hover:bg-red-100 rounded"><Trash2 size={12} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {bulkUploadMode && (
              <div className="flex flex-col overflow-hidden flex-1">
                <div className="px-5 pt-4 pb-2 bg-amber-50 border-b border-amber-200 shrink-0">
                  <p className="text-xs font-black text-amber-800 mb-1">📋 FORMAT KOLOM: EmpID, EmpName, DeptName, Title, CardTime, Hours, Dept2</p>
                </div>
                <div className="px-5 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center shrink-0 border-b bg-white">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Bulan / Periode *</label>
                    <input type="text" placeholder="cth: 202605 IDHB-01" value={bulkMonth} onChange={(e) => setBulkMonth(e.target.value)} className="border rounded px-2 py-1.5 text-sm w-full focus:border-yellow-500 outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Upload File (XLSX / CSV) *</label>
                    <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-yellow-400 rounded px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 transition-all w-full">
                      <Upload size={16} className="text-yellow-700 shrink-0" />
                      <span className="text-xs font-bold text-yellow-800 truncate">{bulkPreview.length > 0 ? `${bulkPreview.length} baris terbaca ✓` : 'Pilih file .xlsx atau .csv'}</span>
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBulkFileUpload} />
                    </label>
                  </div>
                </div>
                {bulkError && <div className="mx-5 mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-bold shrink-0">{bulkError}</div>}
                {bulkPreview.length > 0 && (
                  <div className="flex-1 overflow-auto px-5 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-gray-700">PREVIEW: {bulkPreview.filter(r => r.selected).length}/{bulkPreview.length} dipilih</p>
                      <div className="flex gap-2">
                        <button onClick={() => setBulkPreview(p => p.map(r => ({ ...r, selected: true })))} className="text-[10px] text-blue-600 hover:underline font-bold">Pilih Semua</button>
                        <button onClick={() => setBulkPreview(p => p.map(r => ({ ...r, selected: false })))} className="text-[10px] text-gray-500 hover:underline">Hapus Semua</button>
                      </div>
                    </div>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-xs border-collapse">
                        <thead className="bg-gray-100 text-gray-600 font-bold">
                          <tr><th className="p-2 text-center w-8">✓</th><th className="p-2 text-left">EmpID</th><th className="p-2 text-left">Nama</th><th className="p-2 text-left">Dept</th><th className="p-2 text-center">Kehadiran</th><th className="p-2 text-center">Performa</th><th className="p-2 text-center">Gedung</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {bulkPreview.map((row: any) => (
                            <tr key={row._idx} onClick={() => toggleBulkRow(row._idx)} className={`cursor-pointer transition-colors ${row.selected ? 'bg-green-50' : 'bg-gray-50 opacity-50'}`}>
                              <td className="p-2 text-center"><div className={`w-4 h-4 rounded border-2 mx-auto flex items-center justify-center ${row.selected ? 'bg-green-500 border-green-500' : 'border-gray-400'}`}>{row.selected && <span className="text-white text-[10px] leading-none">✓</span>}</div></td>
                              <td className="p-2 font-mono text-gray-700">{row.empId}</td>
                              <td className="p-2 font-bold">{row.name}</td>
                              <td className="p-2 text-gray-500 max-w-[100px] truncate">{row.dept}</td>
                              <td className="p-2 text-center font-bold text-blue-700">{row.attendance}</td>
                              <td className="p-2 text-center font-bold text-yellow-700">{row.performance}</td>
                              <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded font-black text-white text-[9px] ${row.building === 'HB2' ? 'bg-purple-500' : 'bg-blue-500'}`}>{row.building}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="px-5 py-3 border-t bg-gray-50 flex justify-between items-center shrink-0">
                  <button onClick={() => { setBulkPreview([]); setBulkError(''); }} className="text-xs text-gray-500 hover:text-gray-700 font-bold">Reset Preview</button>
                  <div className="flex gap-2">
                    <button onClick={resetBestEmpForm} className="px-4 py-2 bg-gray-200 rounded font-bold text-sm">Batal</button>
                    <button onClick={handleBulkSave} disabled={bulkUploading || bulkPreview.filter(r => r.selected).length === 0 || !bulkMonth.trim()} className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-slate-900 rounded font-black text-sm shadow flex items-center gap-2">
                      {bulkUploading ? <><RefreshCw size={14} className="animate-spin" /> Menyimpan...</> : <><Download size={14} /> SIMPAN {bulkPreview.filter(r => r.selected).length} KARYAWAN</>}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: HISTORY ── */}
      {isHistoryOpen && canViewHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl h-[80vh] flex flex-col overflow-hidden">
            <div className="bg-teal-600 text-white p-4 flex justify-between items-center shrink-0">
              <h2 className="font-bold flex items-center gap-2"><FileText size={20} /> LAPORAN HISTORY PRODUKSI (CLOSED)</h2>
              <div className="flex gap-2">
                <button onClick={handleExportHistory} className="bg-white text-teal-700 px-3 py-1 rounded text-xs font-bold flex items-center gap-1 hover:bg-teal-50"><Download size={14} /> DOWNLOAD CSV</button>
                <button onClick={() => setIsHistoryOpen(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-200 text-gray-700 font-bold sticky top-0">
                  <tr>
                    <th className="p-2">Tanggal</th><th className="p-2">Line</th><th className="p-2">WO</th>
                    <th className="p-2">Style</th><th className="p-2 text-right">Total Line</th>
                    <th className="p-2 text-right">Total Pac</th><th className="p-2">Reset Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {historyList.map((h: any) => (
                    <tr key={h.id} className="bg-white hover:bg-teal-50">
                      <td className="p-2">{h.timestamp ? new Date(h.timestamp.seconds * 1000).toLocaleDateString('id-ID') : renderSafe(h.date)}</td>
                      <td className="p-2 font-bold">{renderSafe(h.lineId)}</td>
                      <td className="p-2 font-mono">{renderSafe(h.workOrder)}</td>
                      <td className="p-2">{renderSafe(h.style)}</td>
                      <td className="p-2 text-right font-bold text-blue-700">{renderSafe(h.totalLineProduced)}</td>
                      <td className="p-2 text-right font-bold text-green-700">{renderSafe(h.totalPacProduced)}</td>
                      <td className="p-2 text-xs text-gray-500">{renderSafe(h.closedBy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: TRASH ── */}
      {isTrashOpen && canDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden border-2 border-red-800">
            <div className="bg-red-800 text-white p-4 flex justify-between items-center shrink-0">
              <h2 className="font-bold flex items-center gap-2"><Trash size={20} /> TEMPAT SAMPAH (TERHAPUS)</h2>
              <div className="flex gap-4 items-center">
                {trashList.length > 0 && <button onClick={handleEmptyTrash} className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white border border-red-400 px-3 py-1.5 rounded text-xs font-bold transition shadow-lg"><Trash2 size={14} /> KOSONGKAN SEMUA</button>}
                <button onClick={() => setIsTrashOpen(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              <table className="w-full text-sm text-left border-collapse bg-white shadow-sm">
                <thead className="bg-gray-200 text-gray-700 font-bold sticky top-0">
                  <tr>
                    <th className="p-2 border">Waktu Hapus</th><th className="p-2 border">Line</th><th className="p-2 border">WO</th>
                    <th className="p-2 border">Style</th><th className="p-2 border">Dihapus Oleh</th><th className="p-2 border text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {trashList.map((h: any) => (
                    <tr key={h.id} className="bg-white hover:bg-red-50">
                      <td className="p-2 border text-xs text-red-600 font-medium">{h.deletedAt?.seconds ? new Date(h.deletedAt.seconds * 1000).toLocaleString('id-ID') : '-'}</td>
                      <td className="p-2 border font-bold">{renderSafe(h.lineId)}</td>
                      <td className="p-2 border font-mono">{renderSafe(h.workOrder)}</td>
                      <td className="p-2 border">{renderSafe(h.style)}</td>
                      <td className="p-2 border text-xs">{renderSafe(h.deletedBy)}</td>
                      <td className="p-2 border">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleRestore(h)} className="flex items-center gap-1 bg-green-100 hover:bg-green-200 text-green-700 border border-green-300 px-2 py-1 rounded text-xs font-bold transition"><RotateCcw size={14} /> Restore</button>
                          <button onClick={() => handlePermanentDelete(h.id, h.workOrder)} className="flex items-center gap-1 bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-400 px-2 py-1 rounded text-xs font-bold transition"><Trash2 size={14} /> Permanen</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {trashList.length === 0 && <tr><td colSpan={6} className="p-8 text-center font-bold text-gray-400">Tempat sampah kosong.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: LOG ── */}
      {isLogOpen && canViewLogs && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            <div className="bg-orange-500 text-white p-4 flex justify-between items-center shrink-0">
              <h2 className="font-bold flex items-center gap-2"><History size={20} /> LOG AKTIVITAS</h2>
              <button onClick={() => setIsLogOpen(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              <table className="w-full text-left text-sm border-collapse bg-white shadow-sm rounded-lg overflow-hidden">
                <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-bold">
                  <tr><th className="p-3 border-b">Waktu</th><th className="p-3 border-b">Aksi</th><th className="p-3 border-b">Detail</th><th className="p-3 border-b">WO</th><th className="p-3 border-b">Line</th><th className="p-3 border-b">User</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-500 text-xs font-mono">{log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleString('id-ID') : '-'}</td>
                      <td className="p-3 font-bold text-blue-600">{renderSafe(log.action)}</td>
                      <td className="p-3">{renderSafe(log.details)}</td>
                      <td className="p-3 font-mono bg-gray-50">{renderSafe(log.workOrder)}</td>
                      <td className="p-3 font-bold">{renderSafe(log.lineId)}</td>
                      <td className="p-3 text-xs text-gray-400">{renderSafe(log.userId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: USER MANAGEMENT ── */}
      {isUserMgmtOpen && canManageUsers && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            <div className="bg-indigo-600 text-white p-4 flex justify-between items-center shrink-0">
              <h2 className="font-bold flex items-center gap-2"><Users size={20} /> MANAJEMEN USER</h2>
              <button onClick={() => setIsUserMgmtOpen(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-4 rounded shadow border">
                  <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Tambah User Baru</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    await api.post('/api/users', userFormData);
                    const data = await api.get('/api/users');
                    setUsersList(data);
                    setUserFormData({ username: '', pass: '', role: 'USER', name: '' });
                    alert('User Added!');
                  }} className="space-y-3">
                    <Input label="Username" value={userFormData.username} onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })} required />
                    <Input label="Password" value={userFormData.pass} onChange={(e) => setUserFormData({ ...userFormData, pass: e.target.value })} required />
                    <Input label="Nama Lengkap" value={userFormData.name} onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })} required />
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Role</label>
                      <select className="w-full border rounded p-2 text-sm" value={userFormData.role} onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}>
                        <option value="USER">USER</option><option value="ADMIN">ADMIN</option>
                        <option value="ADMINISTRATOR">ADMINISTRATOR</option><option value="CUTTING">CUTTING</option>
                        <option value="PREPARATION">PREPARATION</option><option value="SUPERMARKET">SUPERMARKET</option>
                        <option value="VIEWER">VIEWER</option><option value="FINANCE">FINANCE</option><option value="PLANNER">PLANNER</option>
                        <option value="FINISH_GOOD">FINISH GOOD</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full bg-green-600 text-white py-2 rounded font-bold shadow mt-2">TAMBAH USER</button>
                  </form>
                </div>
                <div className="col-span-2 bg-white p-4 rounded shadow border">
                  <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Daftar User</h3>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 font-bold text-gray-600">
                      <tr><th className="p-2">Username</th><th className="p-2">Nama</th><th className="p-2">Role</th><th className="p-2">Aksi</th></tr>
                    </thead>
                    <tbody>
                      {usersList.map((u: any) => (
                        <tr key={u.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-mono">{renderSafe(u.username)}</td>
                          <td className="p-2">{renderSafe(u.name)}</td>
                          <td className="p-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${getRoleBadgeColor(u.role)}`}>{renderSafe(u.role)}</span></td>
                          <td className="p-2">
                            {u.username !== 'administrator' && (
                              <button onClick={async () => {
                                await api.delete(`/api/users/${u.id}`);
                                const data = await api.get('/api/users');
                                setUsersList(data);
                              }} className="text-red-500"><Trash2 size={16} /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: WO DETAIL ── */}
      {isWoDetailOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border-2 border-purple-700">
                  <div className="bg-purple-800 text-white p-4 flex justify-between items-center shrink-0">
                      <h2 className="font-bold flex items-center gap-2">
                          <FileText size={20} /> DETAIL WO: {selectedWoDetail?.workOrder}
                      </h2>
                      <button onClick={() => setIsWoDetailOpen(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={20} /></button>
                  </div>

                  {woDetailLoading ? (
                      <div className="flex-1 flex items-center justify-center text-gray-500 font-bold">Loading...</div>
                  ) : selectedWoDetail ? (
                      <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-4">

                          {/* INFO UTAMA */}
                          <div className="bg-white rounded border border-purple-200 p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <div>
                                      <p className="text-[10px] text-gray-400 font-bold uppercase">Customer</p>
                                      <p className="font-bold">{selectedWoDetail.customer}</p>
                                  </div>
                                  <div>
                                      <p className="text-[10px] text-gray-400 font-bold uppercase">Style</p>
                                      <p className="font-bold">{selectedWoDetail.style} - {selectedWoDetail.color}</p>
                                  </div>
                                  <div>
                                      <p className="text-[10px] text-gray-400 font-bold uppercase">Order Qty</p>
                                      <p className="font-black text-xl text-blue-700">{selectedWoDetail.orderQty}</p>
                                  </div>
                                  <div>
                                      <p className="text-[10px] text-gray-400 font-bold uppercase">Status</p>
                                      {getStatusBadge(selectedWoDetail.woStatus)}
                                  </div>
                              </div>
                          </div>

                          {/* AKUMULASI OUTPUT */}
                          <div className="grid grid-cols-3 gap-4">
                              <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
                                  <p className="text-[10px] text-gray-500 font-bold uppercase">Total Cutting</p>
                                  <p className="text-3xl font-black text-red-600">{selectedWoDetail.totalCutting}</p>
                              </div>
                              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-center">
                                  <p className="text-[10px] text-gray-500 font-bold uppercase">Total LINE (Akumulatif)</p>
                                  <p className="text-3xl font-black text-blue-600">{selectedWoDetail.totalLine}</p>
                              </div>
                              <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
                                  <p className="text-[10px] text-gray-500 font-bold uppercase">Total PAC (Akumulatif)</p>
                                  <p className="text-3xl font-black text-green-600">{selectedWoDetail.totalPac}</p>
                              </div>
                          </div>

                          {/* PER LINE DETAIL */}
                          <div className="bg-white rounded border border-gray-200 overflow-hidden">
                              <div className="bg-gray-700 text-white px-3 py-2 font-bold text-sm">OUTPUT PER LINE</div>
                              <table className="w-full text-xs border-collapse">
                                  <thead className="bg-gray-100 font-bold">
                                      <tr>
                                          <th className="p-2 border-r text-left">Line</th>
                                          <th className="p-2 border-r text-center">Output LINE</th>
                                          <th className="p-2 border-r text-center">Output PAC</th>
                                          <th className="p-2 border-r text-center">Finish Qty</th>
                                          <th className="p-2 border-r text-center">Audit J1-J7</th>
                                          <th className="p-2 text-center">Status</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                      {selectedWoDetail.lineDetails?.map((ld: any, idx: number) => (
                                          <tr key={idx} className="hover:bg-gray-50">
                                              <td className="p-2 border-r font-bold text-blue-900">{ld.lineId}</td>
                                              <td className="p-2 border-r text-center font-bold text-blue-600">{ld.totalLine}</td>
                                              <td className="p-2 border-r text-center font-bold text-green-600">{ld.totalPac}</td>
                                              <td className="p-2 border-r text-center">{ld.finishQty}</td>
                                              <td className="p-2 border-r text-center">
                                                  {ld.auditIssues?.length > 0 ? (
                                                      <span className="text-red-600 font-bold text-[9px] flex items-center gap-1 justify-center">
                                                          <AlertTriangle size={10} /> {ld.auditIssues.slice(0, 3).join(', ')}
                                                          {ld.auditIssues.length > 3 && `+${ld.auditIssues.length - 3} lagi`}
                                                      </span>
                                                  ) : <span className="text-green-600 font-bold">✅ OK</span>}
                                              </td>
                                              <td className="p-2 text-center">{getStatusBadge(ld.woStatus)}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>

                          {/* CHANGE STATUS */}
                          {selectedWoDetail.woStatus !== 'DONE' && (
                              <div className="bg-white rounded border border-gray-200 p-4">
                                  <p className="font-bold text-sm mb-3 text-gray-700">UBAH STATUS WO</p>
                                  <div className="flex gap-2 flex-wrap">
                                      {selectedWoDetail.woStatus === 'WAITING_CUTTING' && (
                                          <button onClick={() => handleChangeStatus(selectedWoDetail.workOrder, 'IN_CUTTING')} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold">→ IN CUTTING</button>
                                      )}
                                      {selectedWoDetail.woStatus === 'IN_CUTTING' && (
                                          <button onClick={() => handleChangeStatus(selectedWoDetail.workOrder, 'IN_PREP')} className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-bold">→ IN PREP</button>
                                      )}
                                      {selectedWoDetail.woStatus === 'IN_PREP' && (
                                          <button onClick={() => handleChangeStatus(selectedWoDetail.workOrder, 'IN_SEWING')} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold">→ IN SEWING</button>
                                      )}
                                      {selectedWoDetail.woStatus === 'IN_SEWING' && (
                                          <button onClick={() => handleChangeStatus(selectedWoDetail.workOrder, 'ONGOING_FG')} className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded text-xs font-bold">→ ONGOING FG</button>
                                      )}
                                      {['ONGOING_FG', 'DONE_TO_STOCK', 'DONE_TO_SHIPPING'].includes(selectedWoDetail.woStatus) &&
                                          ['ADMINISTRATOR', 'FINISH_GOOD'].includes(appUser?.role) && (
                                          <>
                                              {selectedWoDetail.woStatus !== 'DONE_TO_STOCK' && (
                                                  <button onClick={() => handleChangeStatus(selectedWoDetail.workOrder, 'DONE_TO_STOCK')} className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1.5 rounded text-xs font-bold">→ DONE TO STOCK</button>
                                              )}
                                              {selectedWoDetail.woStatus !== 'DONE_TO_SHIPPING' && (
                                                  <button onClick={() => handleChangeStatus(selectedWoDetail.workOrder, 'DONE_TO_SHIPPING')} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-bold">→ DONE TO SHIPPING</button>
                                              )}
                                              <button onClick={() => {
                                                  if (confirm(`Konfirmasi DONE untuk WO ${selectedWoDetail.workOrder}? WO akan hilang dari list Sewing Assembly.`)) {
                                                      handleChangeStatus(selectedWoDetail.workOrder, 'DONE');
                                                  }
                                              }} className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded text-xs font-bold">✅ DONE (FINAL)</button>
                                          </>
                                      )}
                                  </div>
                                  {selectedWoDetail.fgVerifiedBy && (
                                      <p className="text-[10px] text-gray-400 mt-2">Verified by: {selectedWoDetail.fgVerifiedBy} pada {selectedWoDetail.fgVerifiedAt}</p>
                                  )}
                              </div>
                          )}

                          {/* STATUS LOG */}
                          <div className="bg-white rounded border border-gray-200 overflow-hidden">
                              <div className="bg-gray-700 text-white px-3 py-2 font-bold text-sm">RIWAYAT STATUS</div>
                              <div className="divide-y max-h-48 overflow-y-auto">
                                  {selectedWoDetail.statusLogs?.map((log: any, idx: number) => (
                                      <div key={idx} className="p-2 flex justify-between items-center text-xs">
                                          <div className="flex items-center gap-2">
                                              {getStatusBadge(log.status)}
                                              {log.remarks && <span className="text-gray-500 italic">{log.remarks}</span>}
                                          </div>
                                          <div className="text-right text-gray-400">
                                              <div>{log.changedBy}</div>
                                              <div>{log.timestamp}</div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  ) : null}
              </div>
          </div>
      )}

      {/* ── MODAL: SPLIT LINE ── */}
      {isSplitOpen && selectedWoForAction && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border-2 border-orange-500">
                  <div className="bg-orange-600 text-white p-4 flex justify-between items-center">
                      <h2 className="font-bold">SPLIT LINE — {selectedWoForAction.workOrder}</h2>
                      <button onClick={() => setIsSplitOpen(false)}><X size={20} /></button>
                  </div>
                  <div className="p-5 space-y-4">
                      <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm">
                          <p className="font-bold text-orange-800">WO ini akan dikerjakan oleh 2 line sekaligus.</p>
                          <p className="text-orange-600 text-xs mt-1">Total output gabungan harus = {selectedWoForAction.orderQty} pcs</p>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Line Tambahan</label>
                          <select className="w-full border rounded p-2 text-sm" value={splitForm.newLineId} onChange={e => setSplitForm({...splitForm, newLineId: e.target.value})}>
                              {LINES.filter(l => l !== selectedWoForAction.lineId).map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target Qty Line Baru</label>
                          <input type="number" className="w-full border rounded p-2 text-sm" value={splitForm.targetQty} onChange={e => setSplitForm({...splitForm, targetQty: Number(e.target.value)})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Remarks *</label>
                          <input type="text" className="w-full border rounded p-2 text-sm" placeholder="Alasan split..." value={splitForm.remarks} onChange={e => setSplitForm({...splitForm, remarks: e.target.value})} />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                          <button onClick={() => setIsSplitOpen(false)} className="px-4 py-2 bg-gray-200 rounded font-bold text-sm">Batal</button>
                          <button onClick={handleSplit} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded font-bold text-sm">SPLIT</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* ── MODAL: TRANSFER LINE ── */}
      {isTransferOpen && selectedWoForAction && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border-2 border-teal-500">
                  <div className="bg-teal-600 text-white p-4 flex justify-between items-center">
                      <h2 className="font-bold">TRANSFER LINE — {selectedWoForAction.workOrder}</h2>
                      <button onClick={() => setIsTransferOpen(false)}><X size={20} /></button>
                  </div>
                  <div className="p-5 space-y-4">
                      <div className="bg-teal-50 border border-teal-200 rounded p-3 text-sm">
                          <p className="font-bold text-teal-800">WO akan dipindah dari <span className="text-red-600">{selectedWoForAction.lineId}</span> ke line baru.</p>
                          <p className="text-teal-600 text-xs mt-1">Output yang sudah dikerjakan tetap tercatat.</p>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Line Tujuan</label>
                          <select className="w-full border rounded p-2 text-sm" value={transferForm.newLineId} onChange={e => setTransferForm({...transferForm, newLineId: e.target.value})}>
                              {LINES.filter(l => l !== selectedWoForAction.lineId).map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Remarks *</label>
                          <input type="text" className="w-full border rounded p-2 text-sm" placeholder="Alasan transfer..." value={transferForm.remarks} onChange={e => setTransferForm({...transferForm, remarks: e.target.value})} />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                          <button onClick={() => setIsTransferOpen(false)} className="px-4 py-2 bg-gray-200 rounded font-bold text-sm">Batal</button>
                          <button onClick={handleTransfer} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold text-sm">TRANSFER</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  value?: string | number;
}

function Input({ label, value, ...props }: InputProps) {
  const displayValue = (typeof value === 'object' && value !== null) ? '' : value;
  return (
    <div className="w-full">
      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
      <input className="w-full border border-gray-300 rounded px-2 py-2 text-base focus:border-blue-500 outline-none transition-all" {...props} value={displayValue || ''} />
    </div>
  );
}
