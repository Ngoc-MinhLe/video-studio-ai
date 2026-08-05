import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  collection, 
  getDocs, 
  onSnapshot 
} from "firebase/firestore";
import { auth, googleProvider, db } from "./firebase";

// Danh sách Email mặc định có quyền Quản trị viên tối cao
export const ADMIN_EMAILS = ['admin@gmail.com'];

export const isUserAdmin = (userData) => {
  if (!userData) return false;
  const email = (userData.email || '').toLowerCase();
  return ADMIN_EMAILS.includes(email) || email.includes('admin@') || userData.role === 'admin';
};

const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Xử lý thành công sau khi xác thực thành công (tạo hoặc lấy profile từ Firestore)
 */
const handleAuthSuccess = async (user) => {
  if (!user) return null;
  const today = getTodayString();
  const userRef = doc(db, "users", user.uid);
  const isAdmin = isUserAdmin({ email: user.email });

  let userData = {
    uid: user.uid,
    displayName: user.displayName || (user.email || 'User').split('@')[0],
    email: user.email || '',
    photoURL: user.photoURL || '',
    coins: isAdmin ? 9999 : 20,
    dailyFreeExports: 2,
    lastDailyDate: today,
    role: isAdmin ? 'admin' : 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      userData = userSnap.data();
      if (userData.lastDailyDate !== today) {
        userData.dailyFreeExports = 2;
        userData.lastDailyDate = today;
        try {
          await updateDoc(userRef, {
            dailyFreeExports: 2,
            lastDailyDate: today,
            updatedAt: new Date().toISOString()
          });
        } catch (e) {}
      }
    } else {
      try {
        await setDoc(userRef, userData);
      } catch (e) {}
    }
  } catch (firestoreErr) {
    console.warn("Firestore access warning:", firestoreErr);
  }

  return userData;
};

/**
 * Đăng nhập bằng Email & Mật khẩu (Dành cho tài khoản đã khởi tạo trên Firebase Auth)
 */
export const signInWithEmail = async (email, password) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error('Vui lòng nhập đầy đủ Email và Mật khẩu.');
  }

  let userCredential;
  try {
    userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
  } catch (err) {
    console.error("Firebase Email Auth Error:", err);
    if (
      err.code === 'auth/wrong-password' || 
      err.code === 'auth/invalid-credential'
    ) {
      throw new Error('Mật khẩu không chính xác.');
    } else if (err.code === 'auth/user-not-found') {
      throw new Error('Tài khoản này chưa tồn tại. Vui lòng tạo tài khoản trên Firebase Console hoặc đăng nhập bằng Google.');
    } else {
      throw new Error(err.message || 'Không thể đăng nhập bằng Email này.');
    }
  }

  return await handleAuthSuccess(userCredential.user);
};

/**
 * Đăng nhập bằng Google
 */
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return await handleAuthSuccess(result.user);
  } catch (error) {
    console.error("Lỗi Đăng Nhập Google:", error);
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Cửa sổ Google Popup bị đóng hoặc bị trình duyệt Cốc Cốc ngắt kết nối. Vui lòng bấm Đăng Nhập lại hoặc dùng Đăng Nhập Email.');
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error('Tên miền này chưa được thêm vào Authorized Domains trên Firebase Console.');
    } else {
      throw new Error(error.message || 'Không thể đăng nhập bằng Google.');
    }
  }
};

/**
 * Kiểm tra kết quả sau khi đăng nhập bằng Google Redirect
 */
export const checkRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      return await handleAuthSuccess(result.user);
    }
  } catch (err) {
    console.error("Lỗi getRedirectResult:", err);
  }
  return null;
};

/**
 * Lắng nghe thông tin số dư xu & lượt free của User theo thời gian thực
 */
export const subscribeUserData = (uid, callback) => {
  if (!uid) return () => {};
  const userRef = doc(db, "users", uid);
  return onSnapshot(userRef, async (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const today = getTodayString();
      const isAdmin = isUserAdmin(data);

      if (isAdmin && data.role !== 'admin') {
        data.role = 'admin';
        try {
          await updateDoc(userRef, { role: 'admin' });
        } catch (e) {}
      }

      // Tự động làm mới 2 lượt free mỗi ngày khi qua ngày mới
      if (data.lastDailyDate !== today) {
        try {
          await updateDoc(userRef, {
            dailyFreeExports: 2,
            lastDailyDate: today,
            updatedAt: new Date().toISOString()
          });
          data.dailyFreeExports = 2;
          data.lastDailyDate = today;
        } catch (e) {
          console.warn("Lỗi cập nhật daily free:", e);
        }
      }
      callback(data);
    } else {
      // Document chưa tồn tại trên Firestore (VD: User vừa tạo trực tiếp từ Firebase Console) -> Tự động khởi tạo
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === uid) {
        const today = getTodayString();
        const isAdmin = isUserAdmin({ email: currentUser.email });
        const initialData = {
          uid: currentUser.uid,
          displayName: (currentUser.email || 'User').split('@')[0],
          email: currentUser.email || '',
          photoURL: currentUser.photoURL || '',
          coins: isAdmin ? 9999 : 20,
          dailyFreeExports: 2,
          lastDailyDate: today,
          role: isAdmin ? 'admin' : 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        try {
          await setDoc(userRef, initialData);
          callback(initialData);
        } catch (err) {
          console.error("Lỗi tự động tạo Firestore doc:", err);
          callback(initialData);
        }
      }
    }
  });
};

/**
 * Xử lý trừ lượt Free hoặc trừ Xu khi xuất video
 * @param {string} uid 
 * @param {object} userData 
 * @param {number} costPerExport 
 */
export const deductForVideoExport = async (uid, userData, costPerExport = 5) => {
  if (!uid || !userData) {
    return { success: false, error: 'NOT_LOGGED_IN' };
  }

  const userRef = doc(db, "users", uid);
  const freeLeft = userData.dailyFreeExports || 0;
  const coinsLeft = userData.coins || 0;

  if (freeLeft > 0) {
    // Sử dụng 1 lượt xuất miễn phí hàng ngày
    await updateDoc(userRef, {
      dailyFreeExports: increment(-1),
      updatedAt: new Date().toISOString()
    });
    return {
      success: true,
      usedFree: true,
      remainingFree: freeLeft - 1,
      remainingCoins: coinsLeft
    };
  } else if (coinsLeft >= costPerExport) {
    // Trừ xu khi đã hết lượt miễn phí
    await updateDoc(userRef, {
      coins: increment(-costPerExport),
      updatedAt: new Date().toISOString()
    });
    return {
      success: true,
      usedFree: false,
      remainingCoins: coinsLeft - costPerExport
    };
  } else {
    // Không đủ lượt miễn phí & không đủ xu
    return {
      success: false,
      error: 'INSUFFICIENT_FUNDS',
      requiredCoins: costPerExport,
      currentCoins: coinsLeft
    };
  }
};

/**
 * Lấy danh sách tất cả người dùng (Dành cho Admin)
 */
export const getAllUsers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    const users = [];
    querySnapshot.forEach((docSnap) => {
      users.push(docSnap.data());
    });
    return users;
  } catch (error) {
    console.error("Lỗi lấy danh sách người dùng:", error);
    throw error;
  }
};

/**
 * Cập nhật số xu của người dùng (Admin)
 */
export const updateUserCoinsInDb = async (targetUid, newCoins) => {
  try {
    const userRef = doc(db, "users", targetUid);
    await updateDoc(userRef, {
      coins: Number(newCoins),
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error("Lỗi cập nhật xu:", error);
    throw error;
  }
};

/**
 * Đăng xuất
 */
export const logOutUser = async () => {
  await signOut(auth);
};

/**
 * Lắng nghe Cài đặt Hệ thống từ Firestore (Realtime Sync Video ID cho toàn bộ người dùng)
 */
export const subscribeSystemSettings = (callback) => {
  const localSaved = localStorage.getItem('featured_video_id');
  const defaultId = localSaved || "5qap5aO4i9A";

  const configRef = doc(db, "users", "admin_global_config");
  return onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists() && docSnap.data()?.featuredVideoId) {
      const vid = docSnap.data().featuredVideoId;
      localStorage.setItem('featured_video_id', vid);
      callback({ featuredVideoId: vid });
    } else {
      callback({ featuredVideoId: defaultId });
    }
  }, (err) => {
    console.warn("Lỗi đọc cài đặt hệ thống:", err);
    callback({ featuredVideoId: defaultId });
  });
};

/**
 * Cập nhật Video ID của Kênh trên Firestore & Local (Admin)
 */
export const updateFeaturedVideoIdInDb = async (adminUid, videoId) => {
  if (!videoId) return true;
  const cleanId = videoId.trim();
  localStorage.setItem('featured_video_id', cleanId);

  const globalRef = doc(db, "users", "admin_global_config");
  try {
    await setDoc(globalRef, {
      featuredVideoId: cleanId,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.warn("Lưu Firestore config toàn cục warning:", error);
  }

  if (adminUid) {
    try {
      const adminRef = doc(db, "users", adminUid);
      await updateDoc(adminRef, { featuredVideoId: cleanId });
    } catch (e) {}
  }

  return true;
};
