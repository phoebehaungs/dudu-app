import { useState, useEffect } from 'react';
import './App.css';
import { db } from './firebaseConfig';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  updateDoc,
  doc, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
// 引入圖表套件 
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Label
} from 'recharts';

// --- 常數設定 ---
// 🎂 肚肚的生日
const DUDU_BIRTHDAY = "2025-04-01";

// --- 型別定義 ---
type CategoryType = 'canned' | 'pouch' | 'dry' | 'litter' | 'raw';
type TabType = 'food' | 'weight'; // 分頁狀態

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

interface WeightRecord {
  id: string;
  weight: number;     // 公斤
  date: string;       // 測量日期 (YYYY-MM-DD)
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

const defaultBrandData: BrandDatabase = {
  canned: ["ZiwiPeak 巔峰", "K9 Natural", "Wellness", "Instinct 原點", "Thrive 脆樂芙", "Weruva 唯美味"],
  raw: ["Big Dog 大狗", "Primal", "K9 Natural (生食)", "汪喵星球", "卡尼", "心莫"], 
  pouch: ["Ciao", "Sheba", "Natural Balance", "Wellness"],
  dry: ["Orijen 渴望", "Acana 愛肯拿", "Nutrience 紐崔斯", "Halo"],
  litter: ["EverClean 藍鑽", "Boxiecat", "OdourLock", "鐵鎚牌"]
};

// --- 工具函式：計算年齡 (回傳字串，例如 "2個月") ---
const calculateAgeLabel = (dateString: string) => {
  const birth = new Date(DUDU_BIRTHDAY);
  const target = new Date(dateString);
  
  const diffTime = Math.abs(target.getTime() - birth.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  if (diffDays < 30) return `${diffDays}天`;
  
  const months = Math.floor(diffDays / 30);
  const days = diffDays % 30;
  
  // 如果天數很少，只顯示月
  if (days < 5) return `${months}個月`;
  return `${months}個月${days}天`;
};

// --- 主元件 ---
function App() {
  // 分頁狀態
  const [currentTab, setCurrentTab] = useState<TabType>('food');

  // --- 飲食紀錄狀態 ---
  const [foodRecords, setFoodRecords] = useState<FoodRecord[]>([]);
  const [category, setCategory] = useState<CategoryType>('canned');
  const [brand, setBrand] = useState<string>('');
  const [flavor, setFlavor] = useState<string>('');
  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<CategoryType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'brand' | 'rating'>('date');
  
  // --- 體重紀錄狀態 ---
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [weightInput, setWeightInput] = useState<string>('');
  const [measureDate, setMeasureDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // 通用狀態
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- 監聽雲端資料 (飲食) ---
  useEffect(() => {
    const q = query(collection(db, "records"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: FoodRecord[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as FoodRecord));
      setFoodRecords(data);
    });
    return () => unsubscribe();
  }, []);

  // --- 監聽雲端資料 (體重) ---
  useEffect(() => {
    // 體重我們要依照日期「由舊到新」排序，這樣折線圖才會從左畫到右
    const q = query(collection(db, "weight_records"), orderBy("date", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: WeightRecord[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as WeightRecord));
      setWeightRecords(data);
    });
    return () => unsubscribe();
  }, []);

  // 計算飲食用的品牌清單
  const availableBrands = Array.from(new Set([
    ...defaultBrandData[category], 
    ...foodRecords
      .filter(r => r.category === category) 
      .map(r => r.brand) 
  ]));

  // --- 飲食紀錄送出 ---
  const handleFoodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !flavor || rating === 0) {
      alert("請填寫品牌、口味並給予評分喔！");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "records", editingId), { category, brand, flavor, rating, notes });
        setEditingId(null);
        alert("修改成功！");
      } else {
        await addDoc(collection(db, "records"), {
          category, brand, flavor, rating, notes,
          date: new Date().toLocaleDateString(),
          timestamp: Date.now()
        });
      }
      setBrand(''); setFlavor(''); setRating(0); setNotes('');
      if (!editingId) setCategory('canned'); 
    } catch (error) {
      console.error(error);
      alert("上傳失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 體重紀錄送出 ---
  const handleWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weightInput || !measureDate) {
      alert("請輸入體重和日期");
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "weight_records"), {
        weight: parseFloat(weightInput),
        date: measureDate,
        timestamp: new Date(measureDate).getTime()
      });
      setWeightInput('');
      // 日期維持不動，方便連續輸入
    } catch (error) {
      console.error(error);
      alert("體重上傳失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 編輯/刪除相關函式
  const handleEdit = (rec: FoodRecord) => {
    setEditingId(rec.id);
    setCategory(rec.category);
    setBrand(rec.brand);
    setFlavor(rec.flavor);
    setRating(rec.rating);
    setNotes(rec.notes);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setBrand(''); setFlavor(''); setRating(0); setNotes('');
  };

  const handleDelete = async (id: string, colName: string) => {
    if (window.confirm("確定要刪除這筆紀錄嗎？")) {
      await deleteDoc(doc(db, colName, id));
      if (editingId === id) handleCancelEdit();
    }
  };

  // --- 準備圖表資料 ---
  // 把資料轉換成圖表看得懂的格式，並加上年齡標籤
  const chartData = weightRecords.map(rec => ({
    ...rec,
    ageLabel: calculateAgeLabel(rec.date), // 計算當下的年齡
  }));

  const getCategoryLabel = (val: CategoryType) => categoryOptions.find(c => c.value === val)?.label;

  const displayedRecords = foodRecords
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
        <h1>✨ 肚肚成長日記 (雲端版) ✨</h1>
        <p className="subtitle">生日：2025/04/01</p>
        
        {/* 分頁切換按鈕 */}
        <div className="tab-container">
          <button 
            className={`tab-btn ${currentTab === 'food' ? 'active' : ''}`}
            onClick={() => setCurrentTab('food')}
          >
            🍽️ 飲食紀錄
          </button>
          <button 
            className={`tab-btn ${currentTab === 'weight' ? 'active' : ''}`}
            onClick={() => setCurrentTab('weight')}
          >
            ⚖️ 體重趨勢
          </button>
        </div>
      </header>

      {/* --- 頁面 1: 飲食紀錄 --- */}
      {currentTab === 'food' && (
        <>
          <div className={`input-card card-elevation ${editingId ? 'editing-mode' : ''}`}>
            <div className="form-header">
              {editingId ? (
                 <h3 style={{color: '#e67e22', margin: 0}}>✏️ 修改飲食紀錄</h3>
               ) : (
                 <h3 style={{margin: 0}}>📝 新增飲食紀錄</h3>
               )}
               {editingId && (
                 <button type="button" onClick={handleCancelEdit} className="cancel-btn">取消</button>
               )}
            </div>

            <form onSubmit={handleFoodSubmit}>
              <div className="form-row">
                <div className="form-group" style={{flex: 1}}>
                  <label>種類</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as CategoryType)} className="styled-input">
                    {categoryOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{flex: 2}}>
                  <label>品牌</label>
                  <input list="brand-list" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="選擇或輸入品牌" className="styled-input"/>
                  <datalist id="brand-list">{availableBrands.map((b) => <option key={b} value={b} />)}</datalist>
                </div>
              </div>
              <div className="form-group">
                <label>口味 / 款式</label>
                <input type="text" value={flavor} onChange={(e) => setFlavor(e.target.value)} placeholder="例如：雞肉佐南瓜 / 無塵礦砂" className="styled-input"/>
              </div>
              <div className="form-group">
                <label>肚肚喜歡程度</label>
                <div className="star-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className={`star ${star <= rating ? 'filled' : ''}`} onClick={() => setRating(star)}>★</span>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>備註</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="styled-input"/>
              </div>
              <button type="submit" className="submit-btn" disabled={isSubmitting} style={{ backgroundColor: editingId ? '#e67e22' : 'var(--primary-color)' }}>
                {isSubmitting ? "處理中..." : (editingId ? "更新紀錄 ✅" : "記錄下來 📝")}
              </button>
            </form>
          </div>

          <div className="records-section">
            <div className="section-header">
              <h3>歷史紀錄 ({displayedRecords.length})</h3>
              <div className="filter-controls">
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as CategoryType | 'all')} className="filter-select">
                  <option value="all">全部種類</option>
                  {categoryOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="filter-select">
                  <option value="date">按日期 (新→舊)</option>
                  <option value="rating">按評分 (高→低)</option>
                  <option value="brand">按品牌名稱</option>
                </select>
              </div>
            </div>
            <ul className="record-list">
              {displayedRecords.map((rec) => (
                <li key={rec.id} className={`record-card card-elevation ${editingId === rec.id ? 'being-edited' : ''}`}>
                  <div className="card-actions">
                    <button className="edit-btn" onClick={() => handleEdit(rec)}>✎</button>
                    <button className="delete-btn" onClick={() => handleDelete(rec.id, "records")}>×</button>
                  </div>
                  <div className="card-header">
                    <span className={`category-tag tag-${rec.category}`}>{getCategoryLabel(rec.category)}</span>
                    <span className="date">{rec.date}</span>
                  </div>
                  <div className="card-main">
                    <div className="card-title">{rec.brand}<span className="flavor">{rec.flavor}</span></div>
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
          </div>
        </>
      )}

      {/* --- 頁面 2: 體重追蹤 --- */}
      {currentTab === 'weight' && (
        <div className="weight-section">
          
          {/* 1. 圖表區域 */}
          <div className="chart-card card-elevation">
            <h3 className="chart-title">📈 成長曲線 (體重 vs 年齡)</h3>
            {chartData.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid stroke="#f5f5f5" />
                    {/* X軸顯示年齡 */}
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => calculateAgeLabel(date)}
                      stroke="#95a5a6"
                      fontSize={12}
                    />
                    <YAxis 
                      unit="kg" 
                      stroke="#95a5a6"
                      domain={['auto', 'auto']} // 自動調整範圍
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
                      labelFormatter={(date) => `${date} (${calculateAgeLabel(date as string)})`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="weight" 
                      name="體重"
                      stroke="#e67e22" 
                      strokeWidth={3}
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="empty-state">還沒有體重紀錄，快輸入第一筆資料吧！</p>
            )}
          </div>

          {/* 2. 輸入區域 */}
          <div className="input-card card-elevation">
            <h3>⚖️ 紀錄體重</h3>
            <form onSubmit={handleWeightSubmit} className="weight-form">
              <div className="form-row">
                <div className="form-group" style={{flex: 1}}>
                  <label>測量日期</label>
                  <input 
                    type="date" 
                    value={measureDate}
                    onChange={(e) => setMeasureDate(e.target.value)}
                    className="styled-input"
                  />
                </div>
                <div className="form-group" style={{flex: 1}}>
                  <label>體重 (kg)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="例如 1.5"
                    className="styled-input"
                  />
                </div>
              </div>
              <button type="submit" className="submit-btn" disabled={isSubmitting}>
                {isSubmitting ? "上傳中..." : "新增體重紀錄 ➕"}
              </button>
            </form>
          </div>

          {/* 3. 歷史列表 (方便刪除) */}
          <div className="records-section">
            <h4>詳細數據 ({weightRecords.length})</h4>
            <ul className="record-list">
              {[...weightRecords].reverse().map((rec) => ( // 列表這邊倒序顯示，最新的在上面
                <li key={rec.id} className="record-card card-elevation" style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                  <div>
                    <span className="date">{rec.date} ({calculateAgeLabel(rec.date)})</span>
                    <div className="card-title" style={{fontSize: '1.2rem', color: '#e67e22'}}>
                      {rec.weight} kg
                    </div>
                  </div>
                  <button className="delete-btn" onClick={() => handleDelete(rec.id, "weight_records")}>×</button>
                </li>
              ))}
            </ul>
          </div>

        </div>
      )}
    </div>
  );
}

export default App;
