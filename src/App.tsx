import { useState, useEffect } from 'react';
import './App.css';
// 引入 Firebase 相關功能
import { db } from './firebaseConfig';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';

// --- 型別定義 ---

type CategoryType = 'canned' | 'pouch' | 'dry' | 'litter' | 'raw';

interface FoodRecord {
  id: string; // Firebase 的 ID 是字串
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

const brandData: BrandDatabase = {
  canned: [
    'ZiwiPeak 巔峰',
    'K9 Natural',
    'Wellness',
    'Instinct 原點',
    'Thrive 脆樂芙',
    'Weruva 唯美味',
  ],
  raw: [
    'Big Dog 大狗',
    'Primal',
    'K9 Natural (生食)',
    '汪喵星球',
    '卡尼',
    '心莫',
  ],
  pouch: ['Ciao', 'Sheba', 'Natural Balance', 'Wellness'],
  dry: ['Orijen 渴望', 'Acana 愛肯拿', 'Nutrience 紐崔斯', 'Halo'],
  litter: ['EverClean 藍鑽', 'Boxiecat', 'OdourLock', '鐵鎚牌'],
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
  const [isSubmitting, setIsSubmitting] = useState(false); // 避免重複送出

  // 篩選與排序狀態
  const [filterCategory, setFilterCategory] = useState<CategoryType | 'all'>(
    'all'
  );
  const [sortBy, setSortBy] = useState<'date' | 'brand' | 'rating'>('date');

  // --- 🔥 關鍵改變：監聽雲端資料庫 ---
  useEffect(() => {
    // 建立查詢：去 'records' 集合抓資料，並依照 timestamp 排序
    const q = query(collection(db, 'records'), orderBy('timestamp', 'desc'));

    // onSnapshot 會建立一個「即時監聽器」
    // 只要雲端資料有變動（別人新增了），這裡會馬上收到通知並更新畫面
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const cloudData: FoodRecord[] = [];
      querySnapshot.forEach((doc) => {
        cloudData.push({ id: doc.id, ...doc.data() } as FoodRecord);
      });
      setRecords(cloudData);
    });

    // 當元件移除時，取消監聽
    return () => unsubscribe();
  }, []);

  // --- 新增資料到雲端 ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!brand || !flavor || rating === 0) {
      alert('請填寫品牌、口味並給予評分喔！');
      return;
    }

    setIsSubmitting(true);

    try {
      // 使用 addDoc 新增資料到 'records' 集合
      await addDoc(collection(db, 'records'), {
        category,
        brand,
        flavor,
        rating,
        notes,
        date: new Date().toLocaleDateString(),
        timestamp: Date.now(),
      });

      // 重置表單
      setBrand('');
      setFlavor('');
      setRating(0);
      setNotes('');
    } catch (error) {
      console.error('Error adding document: ', error);
      alert('上傳失敗，請檢查網路或是 Firebase 設定');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 從雲端刪除資料 ---
  const handleDelete = async (id: string) => {
    if (window.confirm('確定要刪除這筆紀錄嗎？（所有人都不會再看到囉）')) {
      try {
        await deleteDoc(doc(db, 'records', id));
      } catch (error) {
        console.error('Error removing document: ', error);
        alert('刪除失敗');
      }
    }
  };

  const getCategoryLabel = (val: CategoryType) =>
    categoryOptions.find((c) => c.value === val)?.label;

  // 前端顯示時的二次排序與篩選
  const displayedRecords = records
    .filter((rec) =>
      filterCategory === 'all' ? true : rec.category === filterCategory
    )
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

      <div className="input-card card-elevation">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>種類</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="styled-input"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 2 }}>
              <label>品牌</label>
              <input
                list="brand-list"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="選擇或輸入品牌"
                className="styled-input"
              />
              <datalist id="brand-list">
                {brandData[category].map((b) => (
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

          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? '紀錄上傳中...' : '記錄下來 📝'}
          </button>
        </form>
      </div>

      <div className="records-section">
        <div className="section-header">
          <h3>歷史紀錄 ({displayedRecords.length})</h3>

          <div className="filter-controls">
            <select
              value={filterCategory}
              onChange={(e) =>
                setFilterCategory(e.target.value as CategoryType | 'all')
              }
              className="filter-select"
            >
              <option value="all">全部種類</option>
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
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
            {records.length === 0
              ? '目前雲端沒有紀錄，快去貢獻罐罐吧！'
              : '這個分類沒有紀錄喔！'}
          </p>
        ) : (
          <ul className="record-list">
            {displayedRecords.map((rec) => (
              <li key={rec.id} className="record-card card-elevation">
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(rec.id)}
                >
                  ×
                </button>
                <div className="card-header">
                  <span className={`category-tag tag-${rec.category}`}>
                    {getCategoryLabel(rec.category)}
                  </span>
                  <span className="date">{rec.date}</span>
                </div>
                <div className="card-main">
                  <div className="card-title">
                    {rec.brand}
                    <span className="flavor">{rec.flavor}</span>
                  </div>
                  <div className="card-rating">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className="star-small"
                        style={{
                          color:
                            i < rec.rating
                              ? 'var(--gold)'
                              : 'var(--muted-gray)',
                        }}
                      >
                        ★
                      </span>
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
