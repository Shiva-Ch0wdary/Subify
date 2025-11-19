# **Remotion Captioning Platform – Full Architecture & Implementation Plan**

This document contains the **complete end-to-end architecture plan** for building the *Remotion Captioning Platform* exactly according to the official task requirements.
Strictly follows: upload → auto-captioning → Hinglish support → caption styles → Remotion preview → export/CLI render.
Designed for agents to create the full project without missing anything.

---

## 🚀 **1. Project Goal & Constraints**

**Goal:** Build a full-stack hosted web app that can:

1. Upload `.mp4` video
2. Auto-generate captions using Speech-to-Text (STT)
3. Support Hinglish (Devanagari + English) captions
4. Render captions onto video using **Remotion**
5. Show real-time preview
6. Allow export via **MP4 or Remotion CLI render**
7. Deploy live (Vercel/Render/Netlify)

**Mandatory Requirements:**
✔ Remotion integration
✔ Video upload UI
✔ Auto-generate captions (using Whisper API)
✔ Hinglish support
✔ 2–3 caption style presets
✔ Real-time preview
✔ Export via CLI or MP4
✔ Hosted live
✔ Sample input + output videos included

**Important:**

* Use **OpenAI Whisper API** (best for accuracy + Hinglish + reliability).
* Offline Whisper is **optional**, should only be mentioned in README (bonus).

---

## 🧰 **2. Tech Stack**

| Layer             | Technology                       |
| ----------------- | -------------------------------- |
| Frontend          | Next.js + TypeScript             |
| Caption Rendering | Remotion (composition + player)  |
| STT Engine        | OpenAI Whisper API               |
| Styling           | TailwindCSS or simple CSS        |
| Fonts             | Noto Sans + Noto Sans Devanagari |
| Deployment        | Vercel                           |
| Node Version      | 20.x                             |

---

## 🏗️ **3. High-Level Architecture**

### **3.1. Frontend – Next.js (App Router)**

Pages:

* `/` – Upload video, generate captions, select style, preview
* `/docs` – Optional documentation of flow

Main UI Flow:

1. User uploads `.mp4`
2. Frontend stores video as temporary Object URL
3. User clicks **Auto-Generate Captions**
4. Backend returns caption segments
5. User chooses **caption style preset**
6. Preview rendered via **Remotion Player**
7. User sees export instructions (CLI render)

---

### **3.2. Backend – Next.js API Route**

`POST /api/generate-captions`

* Accepts `.mp4` via `multipart/form-data`
* Sends audio/video to **OpenAI Whisper API**
* Receives transcript segments with timestamps
* Normalizes into format:

```ts
type CaptionSegment = {
  id: number;
  start: number; 
  end: number;
  text: string; // Hinglish supported
};
```

* Returns `{ segments: CaptionSegment[] }`
* No database or storage needed

---

### **3.3. Remotion Integration**

Files inside `/remotion`:

#### **Remotion Root**

* Register the main composition

#### **CaptionComposition.tsx**

Props:

```ts
{
  captions: CaptionSegment[];
  videoSrc: string;
  stylePreset: "standard" | "topBar" | "karaoke";
}
```

Composition:

* `<Video />` for base video
* `<CaptionLayer />` overlay for captions
* Uses `useCurrentFrame()` + `fps` to calculate current time

#### **Caption Styles**

At least 3:

1. **Standard Bottom**

   * Bottom-center subtitle
   * Black semi-transparent box
   * White bold text

2. **Top Bar (News-style)**

   * Full-width bar
   * Strong background color

3. **Karaoke Style**

   * Words appear with progressive highlight
   * Simple time-based word indexing

#### **Fonts**

Install:

* Noto Sans
* Noto Sans Devanagari

Ensure correct rendering of mixed Hindi + English.

---

### **3.4. Preview & Export**

#### **Preview**

* Use `<Player>` from `@remotion/player`
* Pass `captions`, `stylePreset`, `videoSrc`

#### **Export (CLI Mode for Developers)**

The task allows:
✔ MP4 export OR
✔ a clear CLI render command

We implement CLI export:

Add sample assets:

* `/assets/sample-input.mp4`
* `/assets/sample-captions.json`

Command in `package.json`:

```
"render:sample": "remotion render remotion/Root.tsx CaptionComposition out/sample-output.mp4 --props=./assets/sample-captions.json"
```

Document usage in README.

---

## 🧩 **4. Detailed Implementation Plan**

### **4.1. Project Setup**

1. Create Next.js + TS project
2. Install packages:

```
npm install remotion @remotion/player openai tailwindcss
```

3. Create `/remotion` folder
4. Create `/app/api/generate-captions/route.ts` (if App Router)

---

### **4.2. Environment Variables**

`.env.local`

```
OPENAI_API_KEY=YOUR_KEY
```

---

### **4.3. API Route Implementation**

Steps:

1. Parse uploaded file
2. Send to Whisper API
3. Normalize timestamps
4. Return caption segments

---

### **4.4. Main UI (Home Page)**

Components:

* Upload input
* Generate captions button
* Loading state
* Style preset selector
* Preview section
* Export instructions

Flow:

* Store file → generate object URL
* Call API → store captions
* Pass props into Remotion Player

---

### **4.5. Remotion Composition**

#### `CaptionComposition.tsx`

* Renders video
* Calculates current caption
* Renders `CaptionLayer` based on style

#### `CaptionLayer.tsx`

* Three variants:

  * Standard
  * TopBar
  * Karaoke

---

### **4.6. CLI Render Implementation**

Provide:

* One sample input video
* One sample captions file
* Command:

```
npm run render:sample
```

Generates:
`/out/sample-output.mp4`

This satisfies the export requirement.

---

## 📘 **5. README Requirements**

`README.md` must include:

### **5.1. Overview**

* Purpose of app
* Main features

### **5.2. Tech Stack**

* Next.js
* Remotion
* Whisper API

### **5.3. Setup**

* Clone repo
* `npm install`
* Add `.env.local`
* `npm run dev`

### **5.4. Caption Generation Method**

* Explain Whisper API
* Explain timestamp mapping
* Explain Hinglish support
* Provide sample response format

### **5.5. How to Use**

* Upload video
* Generate captions
* Choose style
* Preview

### **5.6. Export Instructions**

* Full CLI command
* Expected output file

### **5.7. Deployment**

* Steps for Vercel deployment
* Add environment variable
* Push code to GitHub

### **5.8. Sample Videos**

* Include:

  * `/assets/sample-input.mp4`
  * `/assets/sample-output.mp4`

---

## 🧪 **6. Final Testing Checklist**

Before marking project complete:

* [ ] Upload `.mp4` works
* [ ] Whisper generates accurate captions
* [ ] Hinglish displays correctly
* [ ] All 3 caption styles visibly change output
* [ ] Remotion Player preview works
* [ ] CLI export works
* [ ] README fully documented
* [ ] Deployment works on Vercel
* [ ] Sample videos included

---

## 🎯 **7. Final Deliverables**

1. **Full working Next.js + Remotion app**
2. **API route for Whisper**
3. **3 caption style presets**
4. **Remotion Player preview**
5. **CLI-based MP4 export**
6. **Sample input/output videos**
7. **README with full documentation**
8. **Live Vercel deployment URL**

---