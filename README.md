# SmartFocus.AI – Dynamic Subject Tracking & Smart Auto Focus System

SmartFocus.AI is an AI-powered real-time subject tracking system built using  
**React.js + Vite + TensorFlow.js**, designed to automatically maintain focus  
on a selected person in a video or live camera stream by **blurring the background**
and keeping the chosen subject sharp.

This project is ideal for:
- AI/ML competitions  
- Computer Vision learning  
- Real-time subject tracking  
- Smart camera simulation  
- Object detection demos  

---

## 🚀 Features

### 🎯 **1. Tap/Click to Select Person**
Select any person in the video, and the system instantly focuses on them.

### 🧠 **2. Real-Time Person Detection**
Uses the **COCO-SSD TensorFlow.js model** for detecting humans in each frame.

### 🎥 **3. Tracks the Same Person Across Frames**
Even if multiple people are present.

### 🔍 **4. Smart Auto Focus**
- The selected person remains sharp  
- All other areas become blurred dynamically  
- Background blur level is adjustable

### 🔄 **5. Smooth Tracking**
Handles:
- Movement  
- Multiple people  
- Temporary occlusion  
- Low-light video  
- Camera input or uploaded video

### 💻 **6. Runs Entirely in the Browser**
No backend required.

---

## 🛠️ Tech Stack

| Component | Technology |
|----------|------------|
| Frontend | React.js (Vite) |
| AI Model | TensorFlow.js (COCO-SSD) |
| UI Library | TailwindCSS + ShadCN |
| State Management | React Hooks |
| Video Processing | HTML5 Canvas |
| Tracking | Custom Person Tracker |

---

## 📂 Project Structure