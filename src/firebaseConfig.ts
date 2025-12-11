import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// 🔴 請將下方的字串替換成你在 Firebase Console 拿到的設定值
const firebaseConfig = {
  apiKey: 'AIzaSyCdn9uheMKqZS-_YxM8FeGozdhyXtDAEP0',
  authDomain: 'dudu-food-app.firebaseapp.com',
  projectId: 'dudu-food-app',
  storageBucket: 'dudu-food-app.firebasestorage.app',
  messagingSenderId: '1083886510732',
  appId: '1:1083886510732:web:a4279bc3d0cd93c396d1a9',
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
// 匯出資料庫實體，讓其他檔案可以使用
export const db = getFirestore(app);
