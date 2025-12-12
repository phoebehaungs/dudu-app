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
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';

// 引入圖片
import duduLogo from './dudu-logo.png'; 

// --- 常數設定 ---
const DUDU_BIRTHDAY = "2025-04-01";

// --- 型別定義 ---
type CategoryType = 'canned' | 'pouch' | 'dry' | 'litter' | 'raw';
type TabType = 'food' | 'weight' | 'shopping'; // 新增 shopping 頁籤

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
  weight: number;    
  date: string;      
  timestamp: number;
}

// 新增：待買清單的資料格式
interface ShoppingItem {
  id: string;
  category: CategoryType;
  name: string;      // 產品名稱
  note: string;      // 備註 (例如：等特價再買)
  isBought: boolean; // 是否已購買
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

// --- 工具函式 ---
const calculateAgeLabel = (dateString: string) => {
  const birth = new Date(DUDU_BIRTHDAY);
  const target = new Date(dateString);
  const diffTime = Math.abs(target.getTime() - birth.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  if (diffDays < 30) return `${diffDays}天`;
  const months = Math.floor(diffDays / 30);
  const days = diffDays % 30;
  if (days < 5) return `${months}個月`;
  return `${months}個月${days}天`;
};

// --- 主元件 ---
function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('food');
  
  // 飲食紀錄狀態
  const [foodRecords, setFoodRecords] = useState<FoodRecord[]>([]);
  const [category, setCategory] = useState<CategoryType>('canned');
  const [brand, setBrand] = useState<string>('');
  const [flavor, setFlavor] = useState<string>('');
  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<CategoryType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'brand' | 'rating'>('date');
  
  // 體重紀錄狀態
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [weightInput, setWeightInput] = useState<string>('');
  const [measureDate, setMeasureDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // 待買清單狀態
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [shopName, setShopName] = useState('');
  const [shopNote, setShopNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 監聽飲食資料
  useEffect(() => {
    const q = query(collection(db, "records"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: FoodRecord[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as FoodRecord));
      setFoodRecords(data);
    });
    return () => unsubscribe();
  }, []);

  // 監聽體重資料
  useEffect(() => {
    const q = query(collection(db, "weight_records"), orderBy("date", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: WeightRecord[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as WeightRecord));
      setWeightRecords(data);
    });
    return () => unsubscribe();
  }, []);

  // 監聽待買清單資料 (依照時間排序，新加入的在上面)
  useEffect(() => {
    const q = query(collection(db, "shopping_list"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: ShoppingItem[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as ShoppingItem));
      setShoppingList(data);
    });
    return () => unsubscribe();
  }, []);

  const availableBrands = Array.from(new Set([
    ...defaultBrandData[category], 
    ...foodRecords.filter(r => r.category === category).map(r => r.brand) 
  ]));

  // --- 送出功能區 ---

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
    } catch (error) {
      console.error(error);
      alert("體重上傳失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShoppingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName) {
      alert("請輸入想買的東西名稱");
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "shopping_list"), {
        category,
        name: shopName,
        note: shopNote,
        isBought: false, // 預設還沒買
        timestamp: Date.now()
      });
      setShopName('');
      setShopNote('');
    } catch (error) {
      console.error(error);
      alert("新增失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 操作功能區 ---

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

  // 切換「已購買」狀態
  const toggleBought = async (item: ShoppingItem) => {
    try {
      await updateDoc(doc(db, "shopping_list", item.id), {
        isBought: !item.isBought
      });
    } catch (error) {
      console.error(error);
    }
  };

  // --- 圖表資料 ---
  const chartData = weightRecords.map(rec => ({
    ...rec,
    ageLabel: calculateAgeLabel(rec.date),
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
        <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img 
            src={duduLogo} 
            alt="肚肚的Logo" 
            style={{ 
              width: '60px', height: '60px', borderRadius: '50%', 
              objectFit: 'cover', marginRight: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' 
            }} 
          />
          肚肚の記錄
        </h1>
        <p className="subtitle">生日：2025/04/01</p>
        
        <div className="tab-container">
          <button 
            className={`tab-btn ${currentTab === 'food' ? 'active' : ''}`}
            onClick={() => setCurrentTab('food')}
          >
            🥫各類用品
          </button>
          <button 
            className={`tab-btn ${currentTab === 'shopping' ? 'active' : ''}`}
            onClick={() => setCurrentTab('shopping')}
          >
            🛍️ 待買好物
          </button>
          <button 
            className={`tab-btn ${currentTab === 'weight' ? 'active' : ''}`}
            onClick={() => setCurrentTab('weight')}
          >
            ⚖️ 體重趨勢
          </button>
        </div>
      </header>

      {/* 頁面 1: 各類用品 */}
      {currentTab === 'food' && (
        <>
          <div className={`input-card card-elevation ${editingId ? 'editing-mode' : ''}`}>
            <div className="form-header">
              {editingId ? (
                 <h3 style={{color: '#e67e22', margin: 0}}>✏️ 修改記錄</h3>
               ) : (
                 <h3 style={{margin: 0}}>新增一筆記錄</h3>
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

      {/* 頁面 2: 待買清單 (新增功能) */}
      {currentTab === 'shopping' && (
        <div className="shopping-section">
          <div className="input-card card-elevation">
            <h3 style={{margin: 0, marginBottom: '15px'}}>🛍️ 新增待買好物</h3>
            <form onSubmit={handleShoppingSubmit}>
              <div className="form-row">
                <div className="form-group" style={{flex: 1}}>
                  <label>種類</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as CategoryType)} className="styled-input">
                    {categoryOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{flex: 2}}>
                  <label>產品名稱</label>
                  <input 
                    type="text" 
                    value={shopName} 
                    onChange={(e) => setShopName(e.target.value)} 
                    placeholder="例如：巔峰牛肉罐" 
                    className="styled-input"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>備註 (可選)</label>
                <input 
                  type="text" 
                  value={shopNote} 
                  onChange={(e) => setShopNote(e.target.value)} 
                  placeholder="例如：看到特價再買" 
                  className="styled-input"
                />
              </div>
              <button type="submit" className="submit-btn" disabled={isSubmitting}>
                {isSubmitting ? "新增中..." : "加入清單 ➕"}
              </button>
            </form>
          </div>

          <div className="records-section">
            <h3>購物清單 ({shoppingList.filter(i => !i.isBought).length} 項待買)</h3>
            <ul className="record-list">
              {shoppingList.length === 0 ? (
                <p className="empty-state">目前清單空空的，沒有想買的東西嗎？</p>
              ) : (
                shoppingList.map((item) => (
                  <li 
                    key={item.id} 
                    className={`record-card card-elevation ${item.isBought ? 'bought-item' : ''}`}
                    style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}
                  >
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', flex: 1}}>
                      {/* 打勾框框 */}
                      <input 
                        type="checkbox" 
                        checked={item.isBought} 
                        onChange={() => toggleBought(item)}
                        style={{width: '20px', height: '20px', cursor: 'pointer'}}
                      />
                      
                      <div style={{opacity: item.isBought ? 0.5 : 1}}>
                        <span className={`category-tag tag-${item.category}`} style={{marginRight: '8px'}}>
                          {getCategoryLabel(item.category)}
                        </span>
                        <span className="card-title" style={{textDecoration: item.isBought ? 'line-through' : 'none'}}>
                          {item.name}
                        </span>
                        {item.note && (
                          <div style={{fontSize: '0.85rem', color: '#7f8c8d', marginTop: '4px'}}>
                            {item.note}
                          </div>
                        )}
                      </div>
                    </div>

                    <button className="delete-btn" onClick={() => handleDelete(item.id, "shopping_list")}>×</button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {/* 頁面 3: 體重追蹤 */}
      {currentTab === 'weight' && (
        <div className="weight-section">
          <div className="chart-card card-elevation">
            <h3 className="chart-title">📈 成長曲線 (體重 vs 年齡)</h3>
            {chartData.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid stroke="#f5f5f5" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => calculateAgeLabel(date)}
                      stroke="#95a5a6"
                      fontSize={12}
                    />
                    <YAxis unit="kg" stroke="#95a5a6" domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
                      labelFormatter={(date) => `${date} (${calculateAgeLabel(date as string)})`}
                    />
                    <Line type="monotone" dataKey="weight" name="體重" stroke="#e67e22" strokeWidth={3} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="empty-state">還沒有體重紀錄，快輸入第一筆資料吧！</p>
            )}
          </div>

          <div className="input-card card-elevation">
            <h3>⚖️ 紀錄體重</h3>
            <form onSubmit={handleWeightSubmit} className="weight-form">
              <div className="form-row">
                <div className="form-group" style={{flex: 1}}>
                  <label>測量日期</label>
                  <input type="date" value={measureDate} onChange={(e) => setMeasureDate(e.target.value)} className="styled-input" />
                </div>
                <div className="form-group" style={{flex: 1}}>
                  <label>體重 (kg)</label>
                  <input type="number" step="0.01" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} placeholder="例如 1.5" className="styled-input" />
                </div>
              </div>
              <button type="submit" className="submit-btn" disabled={isSubmitting}>
                {isSubmitting ? "上傳中..." : "新增體重紀錄 ➕"}
              </button>
            </form>
          </div>

          <div className="records-section">
            <h4>詳細數據 ({weightRecords.length})</h4>
            <ul className="record-list">
              {[...weightRecords].reverse().map((rec) => (
                <li key={rec.id} className="record-card card-elevation" style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                  <div>
                    <span className="date">{rec.date} ({calculateAgeLabel(rec.date)})</span>
                    <div className="card-title" style={{fontSize: '1.2rem', color: '#e67e22'}}>{rec.weight} kg</div>
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
