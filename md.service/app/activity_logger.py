"""
Aktivite Log Helper - Tüm router'larda kullanılabilir
"""
from datetime import datetime
import secrets
from .data_loader import load_json, save_json


def log_activity(
    user_id: str,
    user_name: str,
    action: str,
    target_type: str,
    target_id: str = None,
    target_name: str = None,
    details: str = None,
    icon: str = "📝",
    extra_data: dict = None
):
    """
    Aktivite log kaydet
    
    Args:
        user_id: Kullanıcı ID (users.json id)
        user_name: Kullanıcı görünen adı
        action: İşlem tipi (create, update, delete, view, status_change, upload, assign, approve, reject, vb.)
        target_type: Hedef tipi (job, customer, personnel, task, document, invoice, stock, planning, vb.)
        target_id: Hedef ID (opsiyonel)
        target_name: Hedef açıklama/isim (opsiyonel)
        details: Detaylı açıklama (opsiyonel)
        icon: Emoji/ikon (varsayılan 📝)
        extra_data: Ekstra veriler dict (opsiyonel)
    """
    try:
        activities = load_json("activities.json")
    except:
        activities = []
    
    activity = {
        "id": f"act_{datetime.now().strftime('%Y%m%d%H%M%S')}_{secrets.token_hex(4)}",
        "timestamp": datetime.now().isoformat(),
        "userId": user_id,
        "userName": user_name,
        "action": action,
        "targetType": target_type,
        "targetId": target_id,
        "targetName": target_name,
        "details": details,
        "icon": icon
    }
    
    if extra_data:
        activity["extraData"] = extra_data
    
    activities.insert(0, activity)
    
    # Son 2000 aktiviteyi tut
    activities = activities[:2000]
    
    save_json("activities.json", activities)
    return activity


# Action türleri ve ikonları
ACTION_ICONS = {
    # Auth
    "login": "🔐",
    "logout": "🚪",
    
    # CRUD
    "create": "➕",
    "update": "✏️",
    "delete": "🗑️",
    "view": "👁️",
    
    # İş/Job işlemleri
    "job_create": "📋",
    "job_status_change": "🔄",
    "job_assign": "👤",
    "job_role_add": "📦",
    "job_role_remove": "📦",
    "job_measure_schedule": "📅",
    "job_measure_complete": "📐",
    "job_technical_upload": "📏",
    "job_offer_create": "💰",
    "job_offer_update": "💰",
    "job_offer_approve": "✅",
    "job_offer_reject": "❌",
    "job_contract_upload": "📄",
    "job_production_start": "🏭",
    "job_production_complete": "✅",
    "job_assembly_schedule": "🔧",
    "job_assembly_complete": "🔧",
    "job_delivery": "🚚",
    "job_complete": "🎉",
    "job_cancel": "❌",
    
    # Planlama
    "planning_create": "📅",
    "planning_update": "📅",
    "planning_delete": "📅",
    "planning_move": "↔️",
    
    # Görev
    "task_create": "📌",
    "task_update": "✏️",
    "task_assign": "👤",
    "task_status_change": "🔄",
    "task_complete": "✅",
    
    # Müşteri
    "customer_create": "👤",
    "customer_update": "✏️",
    "customer_delete": "🗑️",
    
    # Personel
    "personnel_create": "👨‍💼",
    "personnel_update": "✏️",
    "personnel_delete": "🗑️",
    "user_create": "🔑",
    
    # Ekip
    "team_create": "👥",
    "team_update": "✏️",
    "team_member_add": "➕",
    "team_member_remove": "➖",
    
    # Rol
    "role_create": "🏷️",
    "role_update": "✏️",
    "role_delete": "🗑️",
    
    # Stok
    "stock_create": "📦",
    "stock_update": "✏️",
    "stock_add": "📈",
    "stock_remove": "📉",
    "stock_movement": "🔄",
    
    # Satınalma
    "purchase_create": "🛒",
    "purchase_update": "✏️",
    "purchase_receive": "📥",
    "purchase_complete": "✅",
    
    # Üretim siparişi
    "production_order_create": "🏭",
    "production_order_update": "✏️",
    "production_order_receive": "📥",
    "production_order_complete": "✅",
    "production_order_cancel": "❌",
    "production_create": "🏭",
    
    # Montaj
    "assembly_create": "🔩",
    "assembly_complete": "✅",
    
    # Tedarikçi
    "supplier_create": "🏢",
    "supplier_update": "✏️",
    "supplier_delete": "🗑️",
    "supplier_transaction": "💳",
    
    # Finans
    "invoice_create": "🧾",
    "invoice_update": "✏️",
    "payment_create": "💵",
    "payment_update": "✏️",
    
    # Belge
    "document_upload": "📤",
    "document_delete": "🗑️",
    
    # Arşiv
    "archive_upload": "📁",
    "archive_delete": "🗑️",
    
    # Ayarlar
    "settings_update": "⚙️",
    
    # Servis
    "service_create": "🔧",
    "service_update": "✏️",
    "service_complete": "✅",
    
    # Montaj
    "assembly_task_create": "🔩",
    "assembly_task_update": "✏️",
    "assembly_task_complete": "✅",
    "assembly_photo_upload": "📷",
    
    # Genel
    "approve": "✅",
    "reject": "❌",
    "cancel": "🚫",
    "complete": "🎉",
    "assign": "👤",
    "unassign": "👤",
    "upload": "📤",
    "download": "📥",
    "export": "📊",
    "import": "📥",
    "move": "↔️",
    "copy": "📋",
    "schedule": "📅",
    "reschedule": "📅",
    "note_add": "📝",
}


def get_action_icon(action: str) -> str:
    """Aksiyon için ikon döndür"""
    return ACTION_ICONS.get(action, "📝")
