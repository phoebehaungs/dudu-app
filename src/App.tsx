import { useState, useEffect } from 'react';
import './App.css';
import { db } from './firebaseConfig';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  updateDoc, // 1. 新增這個：用來更新資料
  doc, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';

// --- 型別定義 ---

type CategoryType = 'canned' | 'pouch' | 'dry' | 'litter' | 'raw';

interface FoodRecord {
  id: string;
  category: CategoryType;
  brand: string;
  flavor: string;
  rating: number;
  notes: string;
  date: string;
  timestamp: number;
}

type BrandDatabase = {
  [key in CategoryType]: string[];
};

// --- 資料與常數 ---

const categoryOptions: { value: CategoryType; label: string }[] = [
  { value: 'canned', label: '主食/副食罐頭' },
  { value: 'raw', label: '生食' },
  { value: 'pouch', label: '餐包' },
  { value: 'dry', label: '乾飼料' },
  { value: 'litter', label: '貓砂' },
];

// 預設品牌清單
const defaultBrandData: BrandDatabase = {
  canned: ["ZiwiPeak 巔峰", "K9 Natural", "Wellness", "Instinct 原點", "Thrive 脆樂芙", "Weruva 唯美味"],
  raw: ["Big Dog 大狗", "Primal", "K9 Natural (生食)", "汪喵星球", "卡尼", "心莫"], 
  pouch: ["Ciao", "Sheba", "Natural Balance", "Wellness"],
  dry: ["Orijen 渴望", "Acana 愛肯拿", "Nutrience 紐崔斯", "Halo"],
  litter: ["EverClean 藍鑽", "Boxiecat", "OdourLock", "鐵鎚牌"]
};

// --- 主元件 ---

function App() {
  const [records, setRecords] = useState<FoodRecord[]>([]);
  
  // 表單狀態
  const [category, setCategory] = useState<CategoryType>('canned');
  const [brand, setBrand] = useState<string>('');
  const [flavor, setFlavor] = useState<string>('');
  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 2. 新增編輯狀態：用來記錄現在正在修改哪一筆資料 (null 代表沒有在修)
  const [editingId, setEditingId] = useState<string | null>(null);

  // 篩選與排序狀態
  const [filterCategory, setFilterCategory] = useState<CategoryType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'brand' | 'rating'>('date');

  // --- 監聽雲端資料 ---
  useEffect(() => {
    const q = query(collection(db, "records"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const cloudData: FoodRecord[] = [];
      querySnapshot.forEach((doc) => {
        cloudData.push({ id: doc.id, ...doc.data() } as FoodRecord);
      });
      setRecords(cloudData);
    });
    return () => unsubscribe();
  }, []);

  // 動態品牌清單
  const availableBrands = Array.from(new Set([
    ...defaultBrandData[category], 
    ...records
      .filter(r => r.category === category) 
      .map(r => r.brand) 
  ]));

  // --- 3. 處理表單送出 (新增 或 修改) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!brand || !flavor || rating === 0) {
      alert("請填寫品牌、口味並給予評分喔！");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingId) {
        // --- 這是修改舊資料 ---
        const recordRef = doc(db, "records", editingId);
        await updateDoc(recordRef, {
          category,
          brand,
          flavor,
          rating,
          notes,
          // 注意：我們不更新 date 和 timestamp，保留原始紀錄時間
        });
        setEditingId(null); // 修改完畢，退出編輯模式
        alert("修改成功！");
      } else {
        // --- 這是新增新資料 ---
        await addDoc(collection(db, "records"), {
          category,
          brand,
          flavor,
          rating,
          notes,
          date: new Date().toLocaleDateString(),
          timestamp: Date.now()
        });
      }

      // 重置表單
      setBrand('');
      setFlavor('');
      setRating(0);
      setNotes('');
      // 如果是在編輯模式下送出，不重置 category，方便使用者繼續操作
      if (!editingId) setCategory('canned'); 

    } catch (error) {
      console.error("Error adding/updating document: ", error);
      alert("上傳失敗，請檢查網路或是 Firebase 設定");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 4. 啟動編輯模式 ---
  const handleEdit = (rec: FoodRecord) => {
    setEditingId(rec.id); // 記住現在要改哪一筆
    // 把那筆資料填回表單
    setCategory(rec.category);
    setBrand(rec.brand);
    setFlavor(rec.flavor);
    setRating(rec.rating);
    setNotes(rec.notes);
    
    // 很貼心地幫使用者滾動到最上面，因為表單在上面
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- 取消編輯 ---
  const handleCancelEdit = () => {
    setEditingId(null);
    setBrand('');
    setFlavor('');
    setRating(0);
    setNotes('');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("確定要刪除這筆紀錄嗎？刪掉就救不回來囉！")) {
      try {
        await deleteDoc(doc(db, "records", id));
        // 如果剛好正在編輯這筆被刪掉的資料，要取消編輯狀態
        if (editingId === id) {
          handleCancelEdit();
        }
      } catch (error) {
        console.error("Error removing document: ", error);
        alert("刪除失敗");
      }
    }
  };

  const getCategoryLabel = (val: CategoryType) => categoryOptions.find(c => c.value === val)?.label;

  const displayedRecords = records
    .filter(rec => filterCategory === 'all' ? true : rec.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === 'date') return b.timestamp - a.timestamp;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'brand') return a.brand.localeCompare(b.brand, 'zh-TW');
      return 0;
    });

  return (
    <div className="container">
      <header>
        <h1>✨ 肚肚愛用物大集合 (雲端版) ✨</h1>
        <p className="subtitle">資料即時同步，全家一起紀錄</p>
      </header>

      <div className={`input-card card-elevation ${editingId ? 'editing-mode' : ''}`}>
        {/* 5. 提示使用者現在是在新增還是修改 */}
        <div className="form-header">
           {editingId ? (
             <h3 style={{color: '#e67e22', margin: 0}}>✏️ 正在修改紀錄</h3>
           ) : (
             <h3 style={{margin: 0}}>📝 新增紀錄</h3>
           )}
           {editingId && (
             <button type="button" onClick={handleCancelEdit} className="cancel-btn">
               取消修改
             </button>
           )}
        </div>

        <form onSubmit={handleSubmit}>
          
          <div className="form-row">
            <div className="form-group" style={{flex: 1}}>
              <label>種類</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="styled-input"
              >
                {categoryOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{flex: 2}}>
              <label>品牌</label>
              <input 
                list="brand-list" 
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="選擇或輸入品牌"
                className="styled-input"
              />
              <datalist id="brand-list">
                {availableBrands.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="form-group">
            <label>口味 / 款式</label>
            <input 
              type="text" 
              value={flavor}
              onChange={(e) => setFlavor(e.target.value)}
              placeholder="例如：雞肉佐南瓜 / 無塵礦砂"
              className="styled-input"
            />
          </div>

          <div className="form-group">
            <label>肚肚喜歡程度</label>
            <div className="star-rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`star ${star <= rating ? 'filled' : ''}`}
                  onClick={() => setRating(star)}
                >
                  ★
                </span>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>備註</label>
            <textarea 
              rows={3} 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例如：一口氣吃光、稍微有點軟便..."
              className="styled-input"
            />
          </div>

          <button 
            type="submit" 
            className="submit-btn" 
            disabled={isSubmitting}
            style={{ backgroundColor: editingId ? '#e67e22' : 'var(--primary-color)' }}
          >
            {isSubmitting ? "處理中..." : (editingId ? "更新紀錄 ✅" : "記錄下來 📝")}
          </button>
        </form>
      </div>

      <div className="records-section">
        <div className="section-header">
          <h3>歷史紀錄 ({displayedRecords.length})</h3>
          
          <div className="filter-controls">
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value as CategoryType | 'all')}
              className="filter-select"
            >
              <option value="all">全部種類</option>
              {categoryOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className="filter-select"
            >
              <option value="date">按日期 (新→舊)</option>
              <option value="rating">按評分 (高→低)</option>
              <option value="brand">按品牌名稱</option>
            </select>
          </div>
        </div>

        {displayedRecords.length === 0 ? (
          <p className="empty-state">
            {records.length === 0 ? "目前雲端沒有紀錄，快去貢獻罐罐吧！" : "這個分類沒有紀錄喔！"}
          </p>
        ) : (
          <ul className="record-list">
            {displayedRecords.map((rec) => (
              <li key={rec.id} className={`record-card card-elevation ${editingId === rec.id ? 'being-edited' : ''}`}>
                <div className="card-actions">
                  {/* 6. 這裡新增了修改按鈕 */}
                  <button className="edit-btn" onClick={() => handleEdit(rec)} title="修改">✎</button>
                  <button className="delete-btn" onClick={() => handleDelete(rec.id)} title="刪除">×</button>
                </div>
                
                <div className="card-header">
                  <span className={`category-tag tag-${rec.category}`}>{getCategoryLabel(rec.category)}</span>
                  <span className="date">{rec.date}</span>
                </div>
                <div className="card-main">
                  <div className="card-title">
                    {rec.brand}
                    <span className="flavor">{rec.flavor}</span>
                  </div>
                  <div className="card-rating">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className="star-small" style={{ color: i < rec.rating ? 'var(--gold)' : 'var(--muted-gray)' }}>★</span>
                    ))}
                  </div>
                </div>
                {rec.notes && <p className="card-notes">{rec.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;