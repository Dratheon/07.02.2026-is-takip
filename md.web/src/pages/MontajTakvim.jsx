import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Loader from '../components/Loader';
import DelayReasonModal from '../components/DelayReasonModal';
import {
  getAssemblyTasks,
  updateAssemblyTask,
  rescheduleAssemblyTask,
  startAssemblyTask,
  completeAssemblyTask,
  reportAssemblyIssue,
  getTeams,
  getJobRolesConfig,
  uploadDocument,
  getSettingsAll,
} from '../services/dataService';

// Montaj aşaması renkleri
const STAGE_COLORS = {
  'PVC Montaj': '#3b82f6',      // Mavi
  'Cam Takma': '#10b981',       // Yeşil
  'Vidalama': '#f59e0b',        // Turuncu
  'Silikon/Bitirme': '#8b5cf6', // Mor
  'Alüminyum Montaj': '#ef4444', // Kırmızı
  'Cam Balkon Montaj': '#06b6d4', // Turkuaz
  'Sineklik Montaj': '#92400e',  // Kahve
  'Plise Perde Montaj': '#6b7280', // Gri
  'Panjur Montaj': '#6b7280',    // Gri
  'Jaluzi Montaj': '#6b7280',    // Gri
};

// Varsayılan renk
const getStageColor = (stageName) => {
  // Exact match
  if (STAGE_COLORS[stageName]) return STAGE_COLORS[stageName];
  // Partial match
  const lower = stageName?.toLowerCase() || '';
  if (lower.includes('cam')) return '#10b981';
  if (lower.includes('vida')) return '#f59e0b';
  if (lower.includes('silikon') || lower.includes('bitir')) return '#8b5cf6';
  if (lower.includes('alümin')) return '#ef4444';
  if (lower.includes('balkon')) return '#06b6d4';
  if (lower.includes('pvc')) return '#3b82f6';
  return '#3b82f6'; // Default mavi
};

// Durum etiketi
const STATUS_LABELS = {
  pending: 'Bekliyor',
  planned: 'Planlandı',
  in_progress: 'Devam Ediyor',
  completed: 'Tamamlandı',
  blocked: 'Engellendi',
};

// Sorun türleri
// Statik fallback değerler (settings'den çekilemezse)
const DEFAULT_ISSUE_TYPES = [
  { id: 'broken', name: 'Kırık/Hasarlı', icon: '💔' },
  { id: 'missing', name: 'Eksik Malzeme', icon: '❓' },
  { id: 'wrong', name: 'Yanlış Ürün', icon: '⚠️' },
  { id: 'damage', name: 'Hasar (Taşıma/Montaj)', icon: '📦' },
  { id: 'other', name: 'Diğer', icon: '📝' },
];

const DEFAULT_FAULT_SOURCES = [
  { id: 'production', name: 'Üretim Hatası (Tedarikçi)' },
  { id: 'team', name: 'Ekip Hatası' },
  { id: 'accident', name: 'Kaza' },
];

const MontajTakvim = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [roleConfigs, setRoleConfigs] = useState([]);
  
  // Settings'den çekilen config listeleri
  const [issueTypes, setIssueTypes] = useState(DEFAULT_ISSUE_TYPES);
  const [faultSources, setFaultSources] = useState(DEFAULT_FAULT_SOURCES);
  
  // View
  const [viewMode, setViewMode] = useState('month'); // month | week
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Filters
  const [teamFilter, setTeamFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  // Drag & Drop
  const [draggedTask, setDraggedTask] = useState(null);
  
  // Gecikme Modal
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [pendingReschedule, setPendingReschedule] = useState(null); // { taskId, oldDate, newDate, delayDays }
  
  // Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  
  // Action Modals
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Complete Form
  const [completeForm, setCompleteForm] = useState({
    photosBefore: [],
    photosAfter: [],
    customerSignature: '',
    note: '',
  });
  
  // Issue Form
  const [issueForm, setIssueForm] = useState({
    issueType: 'broken',
    item: '',
    quantity: 1,
    faultSource: 'team',
    photoUrl: '',
    note: '',
    createReplacement: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksData, teamsData, rolesData, settingsData] = await Promise.all([
        getAssemblyTasks({}),
        getTeams(),
        getJobRolesConfig(true).catch(() => []),
        getSettingsAll().catch(() => ({})),
      ]);
      setTasks(tasksData || []);
      setTeams(teamsData || []);
      setRoleConfigs(rolesData || []);
      
      // Settings'den config listeleri al
      if (settingsData?.issueTypes?.length) {
        setIssueTypes(settingsData.issueTypes);
      }
      if (settingsData?.faultSources?.length) {
        setFaultSources(settingsData.faultSources);
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Benzersiz aşama isimleri
  const uniqueStages = useMemo(() => {
    const stages = new Set();
    tasks.forEach(t => t.stageName && stages.add(t.stageName));
    return Array.from(stages).sort();
  }, [tasks]);

  // Benzersiz iş kolları
  const uniqueRoles = useMemo(() => {
    const roles = new Set();
    tasks.forEach(t => t.roleName && roles.add(t.roleName));
    return Array.from(roles).sort();
  }, [tasks]);

  // Takvim günleri
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    if (viewMode === 'month') {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
      
      const days = [];
      
      for (let i = startDay - 1; i >= 0; i--) {
        const d = new Date(year, month, -i);
        days.push({ date: d, isCurrentMonth: false });
      }
      
      for (let i = 1; i <= lastDay.getDate(); i++) {
        days.push({ date: new Date(year, month, i), isCurrentMonth: true });
      }
      
      const remaining = 42 - days.length;
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
      }
      
      return days;
    } else {
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay() === 0 ? 6 : startOfWeek.getDay() - 1;
      startOfWeek.setDate(startOfWeek.getDate() - day);
      
      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        days.push({ date: d, isCurrentMonth: true });
      }
      return days;
    }
  }, [currentDate, viewMode]);

  // Filtrelenmiş görevler
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (teamFilter && t.teamId !== teamFilter) return false;
      if (stageFilter && t.stageName !== stageFilter) return false;
      if (roleFilter && t.roleName !== roleFilter) return false;
      return true;
    });
  }, [tasks, teamFilter, stageFilter, roleFilter]);

  // Görevleri tarihe göre grupla
  const tasksByDate = useMemo(() => {
    const map = {};
    
    for (const task of filteredTasks) {
      if (!task.plannedDate) continue;
      
      const dateKey = task.plannedDate.slice(0, 10);
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(task);
    }
    
    return map;
  }, [filteredTasks]);

  // Planlanmamış görevler
  const unplannedTasks = useMemo(() => {
    return filteredTasks.filter(t => !t.plannedDate && t.status !== 'completed');
  }, [filteredTasks]);

  const formatDateKey = (date) => {
    return date.toISOString().slice(0, 10);
  };

  // Drag handlers
  // Drag handlers - dataTransfer kullanarak task ID'yi sakla (state karışıklığını önler)
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id); // Task ID'yi dataTransfer'a kaydet
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  // Takvime bırakma
  const handleDropOnCalendar = async (e, date) => {
    e.preventDefault();
    
    // dataTransfer'dan task ID al (daha güvenilir)
    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      setDraggedTask(null);
      return;
    }
    
    const newDate = formatDateKey(date);
    const oldDate = task.plannedDate;
    
    // Tarih ileri mi alındı? (gecikme kontrolü)
    let isPostponed = false;
    let delayDays = 0;
    
    if (oldDate && newDate) {
      try {
        const oldDt = new Date(oldDate);
        const newDt = new Date(newDate);
        delayDays = Math.ceil((newDt - oldDt) / (1000 * 60 * 60 * 24));
        isPostponed = delayDays > 0;
      } catch {
        // ignore
      }
    }
    
    // Eğer tarih ileri alındıysa, gecikme nedeni modal'ı aç
    if (isPostponed) {
      setPendingReschedule({
        taskId,
        oldDate,
        newDate,
        delayDays
      });
      setShowDelayModal(true);
      setDraggedTask(null);
      return;
    }
    
    // Normal güncelleme (ilk kez planlama veya geri alma)
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, plannedDate: newDate, status: 'planned' } : t
    ));
    setDraggedTask(null);
    
    try {
      await updateAssemblyTask(taskId, {
        plannedDate: newDate,
        status: 'planned',
      });
    } catch (err) {
      alert('Takvim güncellenemedi: ' + (err.message || 'Bilinmeyen hata'));
      loadData(); // Geri al
    }
  };
  
  // Gecikme onaylandığında
  const handleDelayConfirm = async ({ reason, responsiblePersonId, note }) => {
    if (!pendingReschedule) return;
    
    const { taskId, newDate } = pendingReschedule;
    
    // Optimistic update
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, plannedDate: newDate, status: 'planned', isDelayed: true } : t
    ));
    
    try {
      await rescheduleAssemblyTask(taskId, {
        plannedDate: newDate,
        delayReason: reason,
        delayResponsiblePersonId: responsiblePersonId,
        delayNote: note
      });
      
      setShowDelayModal(false);
      setPendingReschedule(null);
    } catch (err) {
      alert('Gecikme kaydedilemedi: ' + (err.message || 'Bilinmeyen hata'));
      loadData(); // Geri al
      setShowDelayModal(false);
      setPendingReschedule(null);
    }
  };
  
  // Gecikme iptal edildiğinde
  const handleDelayCancel = () => {
    setShowDelayModal(false);
    setPendingReschedule(null);
    // Değişiklik yapılmadı, veriyi yeniden yükle
    loadData();
  };

  // Sol panele (planlanmamışa) geri bırakma
  const handleDropOnUnplanned = async (e) => {
    e.preventDefault();
    
    // dataTransfer'dan task ID al
    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === taskId);
    
    // Sadece planlanmış görevler geri bırakılabilir
    if (!task || !task.plannedDate) {
      setDraggedTask(null);
      return;
    }
    
    // Optimistic update
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, plannedDate: null, status: 'pending' } : t
    ));
    setDraggedTask(null);
    
    try {
      await updateAssemblyTask(taskId, {
        plannedDate: null,
        status: 'pending',
      });
    } catch (err) {
      alert('Plan kaldırılamadı: ' + (err.message || 'Bilinmeyen hata'));
      loadData(); // Geri al
    }
  };

  const openTaskDetail = (task) => {
    setSelectedTask(task);
    setShowDetailModal(true);
  };

  // İş kolundaki tüm görevleri bul (ilk/son aşama kontrolü için)
  const getTasksForRole = (task) => {
    return tasks.filter(t => t.jobId === task.jobId && t.roleId === task.roleId)
      .sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
  };

  const isFirstStage = (task) => {
    const roleTasks = getTasksForRole(task);
    return roleTasks.length > 0 && roleTasks[0].id === task.id;
  };

  const isLastStage = (task) => {
    const roleTasks = getTasksForRole(task);
    return roleTasks.length > 0 && roleTasks[roleTasks.length - 1].id === task.id;
  };

  // Görev Başlat
  const handleStartTask = async (task) => {
    try {
      setActionLoading(true);
      await startAssemblyTask(task.id);
      await loadData();
      setShowDetailModal(false);
    } catch (err) {
      alert('Hata: ' + (err.message || 'Görev başlatılamadı'));
    } finally {
      setActionLoading(false);
    }
  };

  // Tamamlama Modal Aç
  const openCompleteModal = (task) => {
    setSelectedTask(task);
    setCompleteForm({
      photosBefore: [],
      photosAfter: [],
      customerSignature: '',
      note: '',
    });
    setShowCompleteModal(true);
    setShowDetailModal(false);
  };

  // Sorun Bildirimi Modal Aç
  const openIssueModal = (task) => {
    setSelectedTask(task);
    setIssueForm({
      issueType: 'broken',
      item: '',
      quantity: 1,
      faultSource: 'team',
      photoUrl: '',
      note: '',
      createReplacement: true,
    });
    setShowIssueModal(true);
    setShowDetailModal(false);
  };

  // Görev Tamamla
  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    
    // Fotoğraf zorunluluğu kontrolü
    if (completeForm.photosBefore.length === 0) {
      alert('Montaj öncesi fotoğraf zorunludur!');
      return;
    }
    if (completeForm.photosAfter.length === 0) {
      alert('Montaj sonrası fotoğraf zorunludur!');
      return;
    }
    // Son aşamada imza zorunlu
    if (isLastStage(selectedTask) && !completeForm.customerSignature) {
      alert('Son aşama için müşteri imzası zorunludur!');
      return;
    }
    
    try {
      setActionLoading(true);
      await completeAssemblyTask(selectedTask.id, {
        photosBefore: completeForm.photosBefore,
        photosAfter: completeForm.photosAfter,
        customerSignature: completeForm.customerSignature,
        note: completeForm.note,
      });
      await loadData();
      setShowCompleteModal(false);
      setSelectedTask(null);
    } catch (err) {
      alert('Hata: ' + (err.message || 'Görev tamamlanamadı'));
    } finally {
      setActionLoading(false);
    }
  };

  // Sorun Bildir
  const handleReportIssue = async () => {
    if (!selectedTask || !issueForm.item) {
      alert('Sorunlu ürün/malzeme adı zorunludur!');
      return;
    }
    if (!issueForm.photoUrl) {
      alert('Sorun fotoğrafı zorunludur!');
      return;
    }
    
    try {
      setActionLoading(true);
      await reportAssemblyIssue(selectedTask.id, issueForm);
      await loadData();
      setShowIssueModal(false);
      setSelectedTask(null);
    } catch (err) {
      alert('Hata: ' + (err.message || 'Sorun bildirilemedi'));
    } finally {
      setActionLoading(false);
    }
  };

  // Dosya Yükleme
  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTask) return;
    
    try {
      setUploading(true);
      
      let docType = 'montaj';
      let description = 'Montaj fotoğrafı';
      
      if (type === 'before') {
        docType = 'montaj_oncesi';
        description = 'Montaj öncesi fotoğraf';
      } else if (type === 'after') {
        docType = 'montaj_sonrasi';
        description = 'Montaj sonrası fotoğraf';
      } else if (type === 'signature') {
        docType = 'musteri_imza';
        description = 'Müşteri imzası';
      } else if (type === 'issue') {
        docType = 'montaj_sorun';
        description = 'Montaj sorunu fotoğrafı';
      }
      
      const result = await uploadDocument(file, selectedTask.jobId, docType, description);
      const url = result?.url || result?.path || URL.createObjectURL(file);
      
      if (type === 'before') {
        setCompleteForm(prev => ({ ...prev, photosBefore: [...prev.photosBefore, url] }));
      } else if (type === 'after') {
        setCompleteForm(prev => ({ ...prev, photosAfter: [...prev.photosAfter, url] }));
      } else if (type === 'signature') {
        setCompleteForm(prev => ({ ...prev, customerSignature: url }));
      } else if (type === 'issue') {
        setIssueForm(prev => ({ ...prev, photoUrl: url }));
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Dosya yüklenirken hata: ' + (err.message || err));
    } finally {
      setUploading(false);
    }
    
    e.target.value = '';
  };

  // Navigation
  const prevPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const nextPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const goToday = () => {
    setCurrentDate(new Date());
  };

  // Format
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('tr-TR');
  };

  const today = new Date().toISOString().slice(0, 10);
  const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const weekDaysFull = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  if (loading) {
    return <Loader text="Montaj takvimi yükleniyor..." />;
  }

  const DAILY_LIMIT = 5;

  return (
    <div>
      <PageHeader
        title="Montaj Takvimi"
        subtitle="Montaj görevlerini takvime sürükle-bırak ile planlayın"
      />

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Sol Panel - Planlanmamış Görevler */}
        <div style={{ width: 320, flexShrink: 0 }}>
          <div 
            className="card" 
            style={{ 
              padding: 20,
              border: draggedTask?.plannedDate ? '2px dashed var(--color-primary)' : undefined,
              transition: 'border 0.2s',
              height: viewMode === 'week' ? 'auto' : 'calc(100vh - 280px)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onDragOver={handleDragOver}
            onDrop={handleDropOnUnplanned}
          >
            <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              ⏳ Planlanmamış Görevler
              <span className="badge badge-warning" style={{ fontSize: 12 }}>{unplannedTasks.length}</span>
            </h4>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
              Takvime sürükleyin veya takvimden buraya geri bırakın
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
              {unplannedTasks.length === 0 ? (
                <div 
                  style={{ 
                    textAlign: 'center', 
                    padding: 40, 
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 12,
                    border: '2px dashed var(--color-border)',
                    color: 'var(--color-text-muted)'
                  }}
                >
                  {draggedTask?.plannedDate ? (
                    <span style={{ color: 'var(--color-primary)', fontSize: 14 }}>📥 Buraya bırakın (planı kaldırır)</span>
                  ) : (
                    <>✅ Tüm görevler planlandı</>
                  )}
                </div>
              ) : (
                unplannedTasks.map(task => {
                  const stageColor = getStageColor(task.stageName);
                  const isOverdue = task.estimatedDate && new Date(task.estimatedDate) < new Date();
                  
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      onClick={() => openTaskDetail(task)}
                      style={{
                        padding: '14px 16px',
                        background: 'var(--color-bg-secondary)',
                        borderRadius: 10,
                        cursor: 'grab',
                        borderLeft: `5px solid ${stageColor}`,
                        transition: 'transform 0.1s, box-shadow 0.1s',
                        border: isOverdue ? '1px solid var(--color-danger)' : undefined,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      title="Detay için tıklayın, takvime sürükleyip bırakın"
                    >
                      {/* Müşteri Adı */}
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-primary)', marginBottom: 4 }}>
                        {task.customerName || 'Müşteri Yok'}
                      </div>
                      {/* İş Başlığı */}
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                        {task.jobTitle || task.jobId}
                      </div>
                      {/* Aşama Badge */}
                      <div style={{ 
                        display: 'inline-block',
                        background: stageColor, 
                        color: '#fff', 
                        padding: '3px 10px', 
                        borderRadius: 12, 
                        fontSize: 11,
                        fontWeight: 600,
                        marginBottom: 4
                      }}>
                        {task.stageName || 'Montaj'}
                      </div>
                      {/* İş Kolu */}
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        {task.roleName}
                      </div>
                      {/* Termin uyarı */}
                      {task.estimatedDate && (
                        <div style={{ 
                          fontSize: 11, 
                          color: isOverdue ? 'var(--color-danger)' : 'var(--color-info)',
                          marginTop: 6
                        }}>
                          📅 Termin: {formatDate(task.estimatedDate)}
                          {isOverdue && ' ⚠️ GECİKMİŞ'}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Sağ - Takvim */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card" style={{ padding: 20 }}>
            {/* Üst Bar - Navigasyon & Filtreler */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={prevPeriod}>
                  ← {viewMode === 'month' ? 'Önceki Ay' : 'Önceki Hafta'}
                </button>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <h2 style={{ margin: 0, fontSize: 22 }}>
                  {viewMode === 'month' 
                    ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                    : `${calendarDays[0]?.date.getDate()} - ${calendarDays[6]?.date.getDate()} ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                  }
                </h2>
                <button className="btn btn-sm btn-outline" onClick={goToday} style={{ fontSize: 12, padding: '6px 14px' }}>
                  Bugün
                </button>
                
                {/* Görünüm Toggle */}
                <div style={{ display: 'flex', background: 'var(--color-bg-secondary)', borderRadius: 8, padding: 3 }}>
                  <button
                    onClick={() => setViewMode('month')}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      background: viewMode === 'month' ? 'var(--color-primary)' : 'transparent',
                      color: viewMode === 'month' ? '#fff' : 'var(--color-text-secondary)',
                      transition: 'all 0.2s'
                    }}
                  >
                    📅 Aylık
                  </button>
                  <button
                    onClick={() => setViewMode('week')}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      background: viewMode === 'week' ? 'var(--color-primary)' : 'transparent',
                      color: viewMode === 'week' ? '#fff' : 'var(--color-text-secondary)',
                      transition: 'all 0.2s'
                    }}
                  >
                    📆 Haftalık
                  </button>
                </div>
              </div>
              
              <button className="btn btn-secondary" onClick={nextPeriod}>
                {viewMode === 'month' ? 'Sonraki Ay' : 'Sonraki Hafta'} →
              </button>
            </div>

            {/* Filtreler */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <select
                className="form-input"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                style={{ width: 180, fontSize: 13 }}
              >
                <option value="">Tüm Aşamalar</option>
                {uniqueStages.map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
              
              <select
                className="form-input"
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                style={{ width: 160, fontSize: 13 }}
              >
                <option value="">Tüm Ekipler</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.ad}</option>
                ))}
              </select>
              
              <select
                className="form-input"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ width: 160, fontSize: 13 }}
              >
                <option value="">Tüm İş Kolları</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              
              {(stageFilter || teamFilter || roleFilter) && (
                <button 
                  className="btn btn-sm btn-ghost"
                  onClick={() => { setStageFilter(''); setTeamFilter(''); setRoleFilter(''); }}
                  style={{ fontSize: 12 }}
                >
                  ✕ Filtreleri Temizle
                </button>
              )}
            </div>

            {/* Gün Başlıkları */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
              {(viewMode === 'week' ? weekDaysFull : weekDays).map(day => (
                <div 
                  key={day} 
                  style={{ 
                    textAlign: 'center', 
                    fontWeight: 700, 
                    fontSize: viewMode === 'week' ? 14 : 13, 
                    padding: viewMode === 'week' ? 12 : 10,
                    color: 'var(--color-text-secondary)',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 8
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Takvim Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
              {calendarDays.map((dayInfo, idx) => {
                const dateKey = formatDateKey(dayInfo.date);
                const dayTasks = tasksByDate[dateKey] || [];
                const isToday = dateKey === today;
                const isPast = dayInfo.date < new Date(today);
                const isOverLimit = dayTasks.length >= DAILY_LIMIT;
                
                const cellHeight = viewMode === 'week' ? 320 : 160;
                const maxVisible = viewMode === 'week' ? 5 : 2;

                return (
                  <div
                    key={idx}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnCalendar(e, dayInfo.date)}
                    style={{
                      minHeight: cellHeight,
                      padding: viewMode === 'week' ? 12 : 10,
                      background: isToday 
                        ? 'rgba(59, 130, 246, 0.1)' 
                        : isPast && dayInfo.isCurrentMonth
                        ? 'rgba(0,0,0,0.02)'
                        : 'var(--color-bg-secondary)',
                      borderRadius: 10,
                      border: isToday 
                        ? '2px solid var(--color-primary)' 
                        : isOverLimit 
                        ? '2px solid var(--color-warning)'
                        : '1px solid var(--color-border)',
                      opacity: dayInfo.isCurrentMonth ? 1 : 0.4,
                      transition: 'background 0.2s',
                    }}
                    onDragEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.style.background = isToday 
                        ? 'rgba(59, 130, 246, 0.1)' 
                        : isPast && dayInfo.isCurrentMonth
                        ? 'rgba(0,0,0,0.02)'
                        : 'var(--color-bg-secondary)';
                    }}
                  >
                    {/* Gün Numarası */}
                    <div style={{ 
                      fontWeight: isToday ? 700 : 600, 
                      fontSize: viewMode === 'week' ? 18 : 14, 
                      marginBottom: 8,
                      color: isToday ? 'var(--color-primary)' : 'inherit',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>{dayInfo.date.getDate()}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isOverLimit && (
                          <span title="Günlük limit aşıldı (5 iş)" style={{ fontSize: 12, color: 'var(--color-warning)' }}>⚠️</span>
                        )}
                        {dayTasks.length > 0 && (
                          <span style={{ 
                            background: isOverLimit ? 'var(--color-warning)' : 'var(--color-primary)', 
                            color: '#fff', 
                            borderRadius: '50%', 
                            width: 22, 
                            height: 22, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700
                          }}>
                            {dayTasks.length}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Görev Bar'ları */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {dayTasks.slice(0, maxVisible).map(task => {
                        const stageColor = getStageColor(task.stageName);
                        const isCompleted = task.status === 'completed';
                        const isInProgress = task.status === 'in_progress';
                        
                        return (
                          <div
                            key={task.id}
                            draggable={!isCompleted}
                            onDragStart={(e) => handleDragStart(e, task)}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => {
                              e.stopPropagation();
                              openTaskDetail(task);
                            }}
                            style={{
                              padding: viewMode === 'week' ? '10px 12px' : '8px 10px',
                              background: stageColor,
                              color: 'white',
                              borderRadius: 8,
                              cursor: isCompleted ? 'default' : 'grab',
                              transition: 'transform 0.1s, box-shadow 0.1s',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                              opacity: isCompleted ? 0.5 : 1,
                              borderLeft: isInProgress ? '4px solid white' : undefined,
                              textDecoration: isCompleted ? 'line-through' : 'none',
                            }}
                            onMouseEnter={(e) => {
                              if (!isCompleted) {
                                e.currentTarget.style.transform = 'scale(1.03)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.25)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
                            }}
                            title={`${task.customerName} - ${task.jobTitle}\n${task.stageName} (${task.roleName})\nDurum: ${STATUS_LABELS[task.status] || task.status}`}
                          >
                            {/* Durum ikonu */}
                            {isCompleted && <span style={{ marginRight: 4 }}>✓</span>}
                            {isInProgress && <span style={{ marginRight: 4 }}>🔄</span>}
                            
                            {/* Müşteri Adı */}
                            <div style={{ 
                              fontWeight: 700, 
                              fontSize: viewMode === 'week' ? 14 : 13,
                              marginBottom: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {task.customerName || 'Müşteri'}
                            </div>
                            
                            {/* İş Başlığı */}
                            <div style={{ 
                              fontSize: viewMode === 'week' ? 12 : 11,
                              opacity: 0.9,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginBottom: 2
                            }}>
                              {task.jobTitle || task.jobId}
                            </div>
                            
                            {/* İş Kolu */}
                            <div style={{ 
                              fontSize: viewMode === 'week' ? 11 : 10,
                              opacity: 0.75,
                              fontStyle: 'italic'
                            }}>
                              {task.roleName}
                            </div>
                          </div>
                        );
                      })}
                      
                      {dayTasks.length > maxVisible && (
                        <div 
                          style={{ 
                            fontSize: 11, 
                            color: 'var(--color-primary)', 
                            textAlign: 'center',
                            padding: 6,
                            background: 'rgba(59, 130, 246, 0.1)',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                          onClick={() => openTaskDetail(dayTasks[maxVisible])}
                        >
                          +{dayTasks.length - maxVisible} daha
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend - Aşama Renkleri */}
          <div className="card" style={{ marginTop: 16, padding: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', marginRight: 8 }}>MONTAJ AŞAMALARI:</span>
              {Object.entries(STAGE_COLORS).slice(0, 6).map(([stage, color]) => (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: color }} />
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{stage}</span>
                </div>
              ))}
            </div>
            <div style={{ 
              display: 'flex', 
              gap: 20, 
              marginTop: 12, 
              paddingTop: 12, 
              borderTop: '1px solid var(--color-border)',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', marginRight: 8 }}>DURUM:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: '#3b82f6' }} />
                <span style={{ fontSize: 12 }}>Planlandı</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: '#3b82f6', borderLeft: '3px solid white' }} />
                <span style={{ fontSize: 12 }}>🔄 Devam Ediyor</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: '#3b82f6', opacity: 0.5 }} />
                <span style={{ fontSize: 12 }}>✓ Tamamlandı</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12 }}>⚠️ 5+ iş = Günlük limit</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Görev Detay Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Montaj Görevi Detayı"
        size="md"
      >
        {selectedTask && (
          <div style={{ padding: 8 }}>
            {/* Başlık */}
            <div style={{ 
              background: `linear-gradient(135deg, ${getStageColor(selectedTask.stageName)} 0%, ${getStageColor(selectedTask.stageName)}dd 100%)`, 
              padding: 20, 
              borderRadius: 12, 
              marginBottom: 20,
              color: '#fff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>
                    👤 {selectedTask.customerName || 'Müşteri Yok'}
                  </div>
                  <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>
                    {selectedTask.jobTitle || selectedTask.jobId}
                  </div>
                  <div style={{ 
                    display: 'inline-block',
                    background: 'rgba(255,255,255,0.2)', 
                    padding: '4px 12px', 
                    borderRadius: 16, 
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    {selectedTask.stageName} • {selectedTask.roleName}
                  </div>
                </div>
                <span 
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  {STATUS_LABELS[selectedTask.status] || selectedTask.status}
                </span>
              </div>
            </div>

            {/* Detaylar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ background: 'var(--color-bg-secondary)', padding: 14, borderRadius: 10 }}>
                <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Ekip</div>
                <div style={{ fontWeight: 600 }}>{selectedTask.teamName || 'Atanmadı'}</div>
              </div>
              <div style={{ background: 'var(--color-bg-secondary)', padding: 14, borderRadius: 10 }}>
                <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Planlanan Tarih</div>
                <div style={{ fontWeight: 600, color: selectedTask.plannedDate ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                  {selectedTask.plannedDate ? formatDate(selectedTask.plannedDate) : 'Planlanmadı'}
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-secondary)', padding: 14, borderRadius: 10 }}>
                <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Müşteri Termini</div>
                <div style={{ fontWeight: 600, color: 'var(--color-info)' }}>
                  {selectedTask.estimatedDate ? formatDate(selectedTask.estimatedDate) : '-'}
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-secondary)', padding: 14, borderRadius: 10 }}>
                <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Konum</div>
                <div style={{ fontWeight: 600 }}>{selectedTask.location || '-'}</div>
              </div>
            </div>

            {/* Bekleyen Sorunlar */}
            {selectedTask.issues?.filter(i => i.status === 'pending').length > 0 && (
              <div style={{ 
                marginBottom: 16, 
                padding: 12, 
                background: 'rgba(239, 68, 68, 0.1)', 
                borderRadius: 8,
                border: '1px solid var(--color-danger)'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: 8 }}>
                  ⚠️ Bekleyen Sorunlar
                </div>
                {selectedTask.issues.filter(i => i.status === 'pending').map(issue => (
                  <div key={issue.id} style={{ fontSize: 13, marginBottom: 4 }}>
                    • {issue.item} ({issue.quantity} adet) - {issue.note}
                  </div>
                ))}
              </div>
            )}

            {/* Aksiyonlar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
              {/* Durum bazlı butonlar */}
              {selectedTask.status === 'planned' && (
                <button 
                  className="btn btn-primary"
                  style={{ padding: '12px 20px', width: '100%' }}
                  onClick={() => handleStartTask(selectedTask)}
                  disabled={actionLoading}
                >
                  {actionLoading ? '...' : '▶️ Görevi Başlat'}
                </button>
              )}
              
              {selectedTask.status === 'in_progress' && (
                <>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button 
                      className="btn btn-success"
                      style={{ padding: '12px 20px', flex: 1 }}
                      onClick={() => openCompleteModal(selectedTask)}
                      disabled={actionLoading || selectedTask.issues?.filter(i => i.status === 'pending').length > 0}
                      title={selectedTask.issues?.filter(i => i.status === 'pending').length > 0 ? 'Önce sorunları çözün' : ''}
                    >
                      ✅ Tamamla
                    </button>
                    <button 
                      className="btn btn-warning"
                      style={{ padding: '12px 20px', flex: 1 }}
                      onClick={() => openIssueModal(selectedTask)}
                      disabled={actionLoading}
                    >
                      ⚠️ Sorun Bildir
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    📷 Tamamlamak için montaj öncesi/sonrası fotoğraf zorunludur
                    {isLastStage(selectedTask) && <><br/>✍️ Son aşama: Müşteri imzası da zorunlu</>}
                  </div>
                </>
              )}
              
              {selectedTask.status === 'blocked' && selectedTask.issues?.filter(i => i.status === 'pending').length === 0 && (
                <button 
                  className="btn btn-primary"
                  style={{ padding: '12px 20px', width: '100%' }}
                  onClick={() => handleStartTask(selectedTask)}
                  disabled={actionLoading}
                >
                  {actionLoading ? '...' : '▶️ Devam Et'}
                </button>
              )}

              {selectedTask.status === 'completed' && (
                <div style={{ 
                  padding: 12, 
                  background: 'rgba(34, 197, 94, 0.1)', 
                  borderRadius: 8,
                  textAlign: 'center',
                  color: 'var(--color-success)',
                  fontWeight: 600
                }}>
                  ✅ Bu görev tamamlandı
                </div>
              )}

              {/* Alt butonlar */}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)} style={{ flex: 1 }}>
                  Kapat
                </button>
                <button 
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setShowDetailModal(false);
                    navigate(`/isler/list?job=${selectedTask.jobId}&stage=5`);
                  }}
                >
                  İşe Git →
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Tamamlama Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="✅ Görevi Tamamla"
        size="md"
      >
        {selectedTask && (
          <div style={{ padding: 8 }}>
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--color-bg-secondary)', borderRadius: 8 }}>
              <div><strong>Görev:</strong> {selectedTask.stageName} - {selectedTask.roleName}</div>
              <div><strong>Müşteri:</strong> {selectedTask.customerName}</div>
              {isLastStage(selectedTask) && (
                <div style={{ marginTop: 8, color: 'var(--color-warning)', fontSize: 13 }}>
                  ⚠️ Bu iş kolunun son aşaması - Müşteri imzası zorunlu
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">📷 Montaj Öncesi Fotoğraf <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'before')}
                className="form-input"
                disabled={uploading}
              />
              {completeForm.photosBefore.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {completeForm.photosBefore.map((url, i) => (
                    <img key={i} src={url} alt="Öncesi" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} />
                  ))}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">📷 Montaj Sonrası Fotoğraf <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'after')}
                className="form-input"
                disabled={uploading}
              />
              {completeForm.photosAfter.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {completeForm.photosAfter.map((url, i) => (
                    <img key={i} src={url} alt="Sonrası" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} />
                  ))}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">
                ✍️ Müşteri İmzası {isLastStage(selectedTask) && <span style={{ color: 'var(--color-danger)' }}>*</span>}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'signature')}
                className="form-input"
                disabled={uploading}
              />
              {completeForm.customerSignature && (
                <img src={completeForm.customerSignature} alt="İmza" style={{ maxWidth: 150, marginTop: 8, borderRadius: 4 }} />
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Not (Opsiyonel)</label>
              <textarea
                className="form-input"
                value={completeForm.note}
                onChange={(e) => setCompleteForm({ ...completeForm, note: e.target.value })}
                rows={2}
                placeholder="Ek notlar..."
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowCompleteModal(false)} style={{ flex: 1 }}>
                İptal
              </button>
              <button 
                className="btn btn-success" 
                onClick={handleCompleteTask}
                disabled={actionLoading || uploading || 
                  completeForm.photosBefore.length === 0 || 
                  completeForm.photosAfter.length === 0 ||
                  (isLastStage(selectedTask) && !completeForm.customerSignature)
                }
                style={{ flex: 1 }}
              >
                {actionLoading ? 'Kaydediliyor...' : '✅ Tamamla'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Sorun Bildirimi Modal */}
      <Modal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title="⚠️ Sorun Bildir"
        size="md"
      >
        {selectedTask && (
          <div style={{ padding: 8 }}>
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--color-bg-secondary)', borderRadius: 8 }}>
              <div><strong>Görev:</strong> {selectedTask.stageName} - {selectedTask.roleName}</div>
              <div><strong>Müşteri:</strong> {selectedTask.customerName}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Sorun Türü</label>
                <select
                  className="form-input"
                  value={issueForm.issueType}
                  onChange={(e) => setIssueForm({ ...issueForm, issueType: e.target.value })}
                >
                  {issueTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.icon || ''} {t.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Adet</label>
                <input
                  type="number"
                  className="form-input"
                  value={issueForm.quantity}
                  onChange={(e) => setIssueForm({ ...issueForm, quantity: parseInt(e.target.value) || 1 })}
                  min={1}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Sorunlu Ürün/Malzeme <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input
                type="text"
                className="form-input"
                value={issueForm.item}
                onChange={(e) => setIssueForm({ ...issueForm, item: e.target.value })}
                placeholder="Örn: Cam 80x120, PVC Profil..."
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Hata Kaynağı</label>
              <select
                className="form-input"
                value={issueForm.faultSource}
                onChange={(e) => setIssueForm({ ...issueForm, faultSource: e.target.value })}
              >
                {faultSources.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">📷 Sorun Fotoğrafı <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'issue')}
                className="form-input"
                disabled={uploading}
              />
              {issueForm.photoUrl && (
                <img src={issueForm.photoUrl} alt="Sorun" style={{ maxWidth: 150, marginTop: 8, borderRadius: 4 }} />
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Açıklama</label>
              <textarea
                className="form-input"
                value={issueForm.note}
                onChange={(e) => setIssueForm({ ...issueForm, note: e.target.value })}
                rows={2}
                placeholder="Ne oldu? Nasıl oldu?"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={issueForm.createReplacement}
                  onChange={(e) => setIssueForm({ ...issueForm, createReplacement: e.target.checked })}
                />
                <span>🔄 Yedek sipariş oluştur (Üretim Takip'e düşer)</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowIssueModal(false)} style={{ flex: 1 }}>
                İptal
              </button>
              <button 
                className="btn btn-danger" 
                onClick={handleReportIssue}
                disabled={actionLoading || uploading || !issueForm.item || !issueForm.photoUrl}
                style={{ flex: 1 }}
              >
                {actionLoading ? 'Kaydediliyor...' : '⚠️ Sorunu Bildir'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Gecikme Nedeni Modal */}
      <DelayReasonModal
        isOpen={showDelayModal}
        onClose={handleDelayCancel}
        onConfirm={handleDelayConfirm}
        originalDate={pendingReschedule?.oldDate}
        newDate={pendingReschedule?.newDate}
        delayDays={pendingReschedule?.delayDays || 0}
        title="Montaj Erteleme - Gecikme Nedeni Gerekli"
      />
    </div>
  );
};

export default MontajTakvim;
