# Project Recovery State

**Last Updated:** 2026-10-28 10:05 AM (BST)
**Current Git Branch:** `main`
**Latest Fix:** ইনকাম ক্যাটাগরি থেকে 'বেতন' (Salary) বাদ দিয়ে 'পরিবার' (Family) এবং 'পকেটমানি' (Pocket Money) প্রধান ক্যাটাগরি হিসেবে যুক্তকরণ

---

## 📌 Summary of Latest Work Done

### 1. Mobile Action Buttons Sleek Redesign (মোবাইলে মোটা বাটন স্লিম করা হয়েছে)
- **User Request:** "dekho first ss e mobile e button gula beshi mota mota lagteche. thik kore dio."
- **Root Cause Identified:**
  - [style.css](file:///c:/xampp/htdocs/hisabtracker/style.css)-এ `.cash-btn`-এ `padding: 16px; border-radius: 16px; font-size: 15px;` নির্ধারিত ছিল।
  - মোবাইল স্ক্রিনে (৩৬০-৪০০ পিক্সেল) উইডথ সীমিত থাকায় "Deduct from Bank" টেক্সটটি ২টি লাইনে ভেঙে যাচ্ছিল। এর ফলে বাটনের উচ্চতা প্রায় ৭০-৭৫ পিক্সেল হয়ে একটি মোটা ও দৃষ্টিকটু ব্লক তৈরি করছিল।
- **Solution Applied:**
  1. `.cash-btn`-এর হাইট ও প্যাডিং স্লিম ফিনটেক স্টাইলে রূপান্তর:
     - `height: 40px; min-height: 40px; padding: 0 12px; border-radius: 12px; font-size: 13px; font-weight: 700; gap: 6px;`
     - মোবাইলের জন্য মিডিয়া কোয়েরি (`max-width: 420px`): `height: 38px; min-height: 38px; padding: 0 8px; border-radius: 10px; font-size: 12px; gap: 4px;`
  2. টেক্সট র‍্যাপিং প্রতিরোধ: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` যোগ করা হয়েছে, ফলে লেখা কখনো ২ লাইনে ভাঙবে না।
  3. আইকন স্কেলিং: [index.html](file:///c:/xampp/htdocs/hisabtracker/index.html) এবং [style.css](file:///c:/xampp/htdocs/hisabtracker/style.css)-এ বাটনের SVG আইকন ১৮px থেকে কমিয়ে ১৪px করা হয়েছে।
  4. প্রিমিয়াম গ্রেডিয়েন্ট ও শ্যাডো:
     - Add Button: `linear-gradient(135deg, #059669 0%, #10b981 100%)` সঙ্গে সফ্ট এমারেল্ড গ্লো।
     - Deduct Button: `linear-gradient(135deg, #dc2626 0%, #ef4444 100%)` সঙ্গে সফ্ট রেড গ্লো।

---

### 2. Elimination of 1-Second Login Screen Flash (লগইন স্ক্রিনের ১ সেকেন্ডের ফ্ল্যাশ রিমুভ)
- **User Request:** "and website e dhukle first e ei enter email password er eita 1 sec er jonno ashe eita bad dio. jate direct main page e niye jay oita koiro"
- **Root Cause Identified:**
  - [index.html](file:///c:/xampp/htdocs/hisabtracker/index.html)-এ `#auth-screen` ডিফল্টভাবে এইচটিএমএল-এ দৃশ্যমান ছিল এবং `#app` ছিল `style="display:none"`।
  - পেজ লোড হওয়ার পর সুপাবেস ক্লায়েন্ট অ্যাসিনক্রোনাসভাবে সেশন যাচাই করতে ~১ সেকেন্ড সময় নিত। ওই সময় জুড়ে ব্যবহারকারী লগইন বক্সটি দেখতে পেতেন, এরপর `showApp()` কল হলে মূল অ্যাপ দৃশ্যমান হতো।
- **Solution Applied:**
  1. **Instant Session Detection in `<head>`:**
     - [index.html](file:///c:/xampp/htdocs/hisabtracker/index.html)-এর `<head>` অংশে সম্পূর্ণ সিনক্রোনাস স্ক্রিপ্ট যুক্ত করা হয়েছে যা বডি রেন্ডার হওয়ার আগেই `localStorage`-এ সুপাবেস সেশন টোকেন বা `ht_has_session` চেক করে `document.documentElement`-এ `.has-session` ক্লাস বসিয়ে দেয়।
  2. **Zero-Delay CSS Routing:**
     - [style.css](file:///c:/xampp/htdocs/hisabtracker/style.css)-এ রুল যুক্ত করা হয়েছে:
       ```css
       #auth-screen { display: none; }
       html:not(.has-session) #auth-screen { display: flex; }
       html:not(.has-session) #app { display: none; }
       ```
     - এর ফলে লগইন করা ব্যবহারকারী পেজে প্রবেশ করা মাত্র ফ্রেম-০ (0ms)-তেই সরাসরি মূল পেইজ দেখতে পান, লগইন স্ক্রিনের কোনো ফ্ল্যাশ বা ঝলকানি ঘটে না।
     - যারা লগইন ছাড়া প্রথমবার আসবেন, তাদের ক্ষেত্রে `:not(.has-session)` স্বয়ংক্রিয়ভাবে কোনো ল্যাগ ছাড়াই অথ স্ক্রিন দেখাবে।
  3. **Fast Local Data Pre-hydration (`restoreCachedSession`):**
     - [script.js](file:///c:/xampp/htdocs/hisabtracker/script.js)-এ `restoreCachedSession()` ফাংশন যুক্ত করা হয়েছে, যা ব্রাউজার ক্যাশ থেকে সাথে সাথে লোকাল ডেটা রেন্ডার করে দেয় ক্লাউড চেক শেষ হওয়ার আগেই।
  4. **Proper Session Synchronization:**
     - `sb.auth.onAuthStateChange` এবং [signOut()](file:///c:/xampp/htdocs/hisabtracker/script.js)-এ `ht_has_session` ও `.has-session` ক্লাস ক্লিনআপ নিখুঁতভাবে সমন্বিত করা হয়েছে।

---

### 3. Income Category Customization (বেতন বাদ দিয়ে পরিবার ও পকেটমানি ডিফল্ট)
- **User Request:** "accha category te salary ekta option ache. ami to job korina. so amr to salary asbena. family te taka dey... family, pocket money eii rokom . salary bad diye deo"
- **Solution Applied:**
  1. `INCOME_CATEGORIES` থেকে `salary` (বেতন) সম্পূর্ণ সরিয়ে দেওয়া হয়েছে।
  2. এক নম্বরে যুক্ত করা হয়েছে `👨‍👩‍👧 পরিবার` (`Family`) এবং দুই নম্বরে `💵 পকেটমানি` (`Pocket Money`)।
  3. এর ফলে টাকা যোগ করার সময় স্বয়ংক্রিয়ভাবে ডিফল্ট নোট হিসেবে `"পরিবার"` / `"Family"` সিলেক্ট হবে।
  4. কুইক চিপস ও সেভ করা প্রোফাইল ক্যাটাগরি থেকেও `Salary` স্বয়ংক্রিয়ভাবে ক্লিন করে `Family` ও `Pocket Money` দিয়ে প্রতিস্থাপন করা হয়েছে।
  5. পূর্বের কোনো পুরনো লেনদেনে যদি Salary থেকে থাকে, তা ক্র্যাশ না করে নিরাপদে রেন্ডার হওয়ার জন্য `LEGACY_CATS` ফলব্যাক রাখা হয়েছে।

---

## 🧪 Verification & Testing
- ✅ **Syntax Verification:** `node -c script.js` executed with 0 errors.
- ✅ **Browser Subagent Test:**
  - লোকাল টেস্ট সার্ভারে মোবাইল ভিউপোর্টে (৩৯০x৮৪৪) ব্রাউজার সাবএজেন্ট চালিয়ে যাচাই করা হয়েছে।
  - টেস্টে প্রমাণিত হয়েছে:
    1. সেশন থাকা অবস্থায় পেজ লোড দিলে লগইন স্ক্রিন আর ০.১ সেকেন্ডের জন্যও ফ্ল্যাশ করে না, সরাসরি মেইন পেজে নিয়ে যায়।
    2. ব্যাংকে ক্লিক করার পর `+ Add to Bank` এবং `− Deduct from Bank` বাটন দুটি চমৎকারভাবে ৩৮-৪০px স্লিম পিল আকারে ১ লাইনে নিখুঁতভাবে প্রদর্শিত হয়েছে।
  - স্ক্রিনশট সংরক্ষিত: `bank_action_buttons_1793159118376.png`।
- ✅ **Cache & Service Worker Bump:**
  - `style.css?v=5.1` এবং `script.js?v=5.1` ইন [index.html](file:///c:/xampp/htdocs/hisabtracker/index.html)।
  - সার্ভিস ওয়ার্কার ক্যাশ নেম আপডেট: `hisab-v29` ইন [sw.js](file:///c:/xampp/htdocs/hisabtracker/sw.js)।

---

## 📁 Key Files Modified
- [index.html](file:///c:/xampp/htdocs/hisabtracker/index.html) (যুক্ত করা হয়েছে ইনলাইন সেশন ডিটেকশন স্ক্রিপ্ট, স্কেল করা হয়েছে অ্যাকশন বাটন আইকন, ক্যাশ বাস্টার `v=5.1`)
- [style.css](file:///c:/xampp/htdocs/hisabtracker/style.css) (যুক্ত করা হয়েছে জিরো-ডিলে সেশন সিএসএস রুলস এবং স্লিম রেসপন্সিভ `.cash-btn` স্টাইলিং)
- [script.js](file:///c:/xampp/htdocs/hisabtracker/script.js) (যুক্ত করা হয়েছে `restoreCachedSession()`, আপডেট করা হয়েছে `onAuthStateChange` ও `signOut`)
- [sw.js](file:///c:/xampp/htdocs/hisabtracker/sw.js) (ক্যাশ আপডেট করা হয়েছে `hisab-v29`)
- [project_recovery_state.md](file:///c:/xampp/htdocs/hisabtracker/project_recovery_state.md) (রিকাভারি স্টেট আপডেট করা হয়েছে)
