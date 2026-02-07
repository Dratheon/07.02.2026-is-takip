import React, { useState, useEffect, useMemo } from 'react';
import { getActivities, getActivitySummary, getUsers } from '../services/dataService';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Loader from '../components/Loader';

const Aktiviteler = () => {
  const [activities, setActivities] = useState([]);
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtreler
  const [filters, setFilters] = useState({
    userId: '',
    targetType: '',
    action: '',
    dateFrom: '',
    dateTo: '',
  });
  
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
  });

  useEffect(() => {
    loadData();
  }, [filters, pagination.offset, pagination.limit]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [activitiesRes, summaryRes, usersRes] = await Promise.all([
        getActivities({
          ...filters,
          limit: pagination.limit,
          offset: pagination.offset,
        }),
        getActivitySummary(7),
        getUsers().catch(() => []),
      ]);
      
      setActivities(activitiesRes.items || []);
      setPagination((p) => ({ ...p, total: activitiesRes.total || 0 }));
      setSummary(summaryRes);
      setUsers(usersRes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const targetTypeLabels = {
    job: 'İş',
    customer: 'Müşteri',
    personnel: 'Personel',
    task: 'Görev',
    stock: 'Stok',
    purchase: 'Satınalma',
    supplier: 'Tedarikçi',
    document: 'Belge',
    invoice: 'Fatura',
    payment: 'Ödeme',
    planning: 'Planlama',
    team: 'Ekip',
    auth: 'Giriş/Çıkış',
    user: 'Kullanıcı',
    settings: 'Ayarlar',
    assembly: 'Montaj',
    production: 'Üretim',
  };

  const actionLabels = {
    create: 'Oluşturma',
    update: 'Güncelleme',
    delete: 'Silme',
    view: 'Görüntüleme',
    login: 'Giriş',
    logout: 'Çıkış',
    job_create: 'İş Oluşturma',
    job_status_change: 'Durum Değişikliği',
    job_assign: 'Atama',
    upload: 'Yükleme',
    approve: 'Onaylama',
    reject: 'Reddetme',
    complete: 'Tamamlama',
    cancel: 'İptal',
    schedule: 'Planlama',
    reschedule: 'Yeniden Planlama',
    move: 'Taşıma',
  };

  const columns = [
    {
      accessor: 'timestamp',
      label: 'Tarih/Saat',
      render: (value, row) => {
        const date = new Date(value);
        return (
          <div>
            <div style={{ fontWeight: 500 }}>{date.toLocaleDateString('tr-TR')}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        );
      },
    },
    {
      accessor: 'icon',
      label: '',
      render: (value) => (
        <span style={{ fontSize: 20 }}>{value || '📝'}</span>
      ),
    },
    {
      accessor: 'userName',
      label: 'Kullanıcı',
      render: (value) => (
        <div>
          <div style={{ fontWeight: 500 }}>{value || 'Sistem'}</div>
        </div>
      ),
    },
    {
      accessor: 'action',
      label: 'İşlem',
      render: (value) => (
        <span className="badge badge-info">
          {actionLabels[value] || value}
        </span>
      ),
    },
    {
      accessor: 'targetType',
      label: 'Alan',
      render: (value) => (
        <span className="badge badge-secondary">
          {targetTypeLabels[value] || value}
        </span>
      ),
    },
    {
      accessor: 'targetName',
      label: 'Hedef',
      render: (value, row) => (
        <div>
          {value && <div style={{ fontWeight: 500 }}>{value}</div>}
          {row.targetId && (
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
              {row.targetId}
            </div>
          )}
        </div>
      ),
    },
    {
      accessor: 'details',
      label: 'Detay',
      render: (value) => (
        <div style={{ maxWidth: 300, whiteSpace: 'pre-wrap', fontSize: 13 }}>
          {value}
        </div>
      ),
    },
  ];

  const uniqueTargetTypes = useMemo(() => {
    const types = new Set(activities.map((a) => a.targetType).filter(Boolean));
    return Array.from(types).sort();
  }, [activities]);

  const uniqueActions = useMemo(() => {
    const actions = new Set(activities.map((a) => a.action).filter(Boolean));
    return Array.from(actions).sort();
  }, [activities]);

  if (loading && activities.length === 0) {
    return <Loader text="Aktiviteler yükleniyor..." />;
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Aktivite Logları"
        subtitle="Sistem üzerindeki tüm kullanıcı hareketleri"
        icon="📊"
      />

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Özet Kartları */}
      {summary && (
        <div className="grid grid-5" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <div className="stat-value">{summary.totalActivities}</div>
              <div className="stat-label">Son 7 Gün</div>
            </div>
          </div>
          {summary.userCounts?.slice(0, 4).map((uc, idx) => (
            <div key={idx} className="stat-card">
              <div className="stat-icon">👤</div>
              <div className="stat-content">
                <div className="stat-value">{uc.count}</div>
                <div className="stat-label">{uc.name}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtreler */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: 16 }}>
          <div className="grid grid-5" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Kullanıcı</label>
              <select
                className="form-select"
                value={filters.userId}
                onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
              >
                <option value="">Tümü</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.displayName}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Alan</label>
              <select
                className="form-select"
                value={filters.targetType}
                onChange={(e) => setFilters((f) => ({ ...f, targetType: e.target.value }))}
              >
                <option value="">Tümü</option>
                {uniqueTargetTypes.map((t) => (
                  <option key={t} value={t}>{targetTypeLabels[t] || t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">İşlem</label>
              <select
                className="form-select"
                value={filters.action}
                onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
              >
                <option value="">Tümü</option>
                {uniqueActions.map((a) => (
                  <option key={a} value={a}>{actionLabels[a] || a}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Başlangıç</label>
              <input
                type="date"
                className="form-control"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Bitiş</label>
              <input
                type="date"
                className="form-control"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Aktivite Tablosu */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">Aktiviteler ({pagination.total})</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-small"
              disabled={pagination.offset === 0}
              onClick={() => setPagination((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
            >
              ← Önceki
            </button>
            <span style={{ padding: '6px 12px', fontSize: 13 }}>
              {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} / {pagination.total}
            </span>
            <button
              className="btn btn-secondary btn-small"
              disabled={pagination.offset + pagination.limit >= pagination.total}
              onClick={() => setPagination((p) => ({ ...p, offset: p.offset + p.limit }))}
            >
              Sonraki →
            </button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Loader size="small" />
            </div>
          ) : activities.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              Aktivite bulunamadı
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={activities}
              keyField="id"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Aktiviteler;
